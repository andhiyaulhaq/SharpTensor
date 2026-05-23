import * as ort from 'onnxruntime-web';
import { state } from './state';
import { ResizeLongestSide, PromptEncoder } from './sam_utils';
import { BoundingBox, EmbeddingCacheEntry, WorkerOutboundMessage } from './types';

// Set up ONNX Runtime Web WASM paths
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.25.1/dist/';

/**
 * SharpTensor AI Engine
 * Handles background model inference and embedding management.
 */
export class AIEngine {
  private samDecoderSession: ort.InferenceSession | null = null;
  private promptEncoder: PromptEncoder | null = null;
  private worker: Worker | null = null;

  public isLoaded = false;
  public isWorkerReady = false;

  // Context-specific state
  private activeKey: string | null = null; // The image currently being processed for segmentation
  private samTransform = new ResizeLongestSide(1024);
  private embeddingCache = new Map<string, EmbeddingCacheEntry>(); // Key -> { embeddings, width, height }
  private pendingCacheKeys = new Set<string>();
  private pendingDetections = new Map<string, (result: BoundingBox[]) => void>(); // requestId -> resolve

  constructor() {
    this.initWorker();
  }

  initWorker(): void {
    if (this.worker) return;
    this.worker = new Worker(new URL('./ai.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => this.handleWorkerMessage(e);
  }

  handleWorkerMessage(e: MessageEvent<WorkerOutboundMessage>): void {
    const msg = e.data;

    if (msg.type === 'initialized') {
      this.isWorkerReady = true;
      console.log('👷 AI Worker: Background engines ready');
      return;
    }

    if (msg.type === 'encoded') {
      const { embeddings, dims, cacheKey, latency } = msg.payload;
      if (cacheKey) this.pendingCacheKeys.delete(cacheKey);

      // Store in the isolated cache
      const tensor = new ort.Tensor('float16', embeddings as any, dims);

      // We need to know the original dimensions to store with the embeddings
      // These are retrieved from the pending task metadata or active state
      const metadata = this.embeddingCache.get(cacheKey) || { width: 1024, height: 1024 };

      this.embeddingCache.set(cacheKey, {
        ...metadata,
        embeddings: tensor,
      });

      // Update global state only if this is the ACTIVE image
      if (cacheKey === this.activeKey) {
        state.set({ modelStatus: 'ready' });
      }

      // Maintenance: keep cache at 15
      if (this.embeddingCache.size > 15) {
        const oldestKey = this.embeddingCache.keys().next().value;
        if (oldestKey) this.embeddingCache.delete(oldestKey);
      }

      this.log(`🖼️ ${cacheKey} encoded (${latency.toFixed(0)}ms)`);
    }

    if (msg.type === 'detected') {
      const { detections, requestId, latency } = msg.payload;
      const resolve = this.pendingDetections.get(requestId);
      if (resolve) {
        this.pendingDetections.delete(requestId);
        resolve(detections);
      }
      this.log(`🎯 Found ${detections.length} objects (${latency.toFixed(0)}ms)`);
    }

    if (msg.type === 'error') {
      this.log(`❌ Worker error: ${msg.payload}`, 'error');
      state.set({ modelStatus: 'error' });
    }
  }

  log(msg: string, type: 'info' | 'error' = 'info'): void {
    const event = new CustomEvent('ai-log', {
      detail: {
        message: msg,
        type: type,
        time: new Date().toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
    });
    window.dispatchEvent(event);
  }

  async loadModels(): Promise<void> {
    try {
      state.set({ modelStatus: 'loading' });
      // Root-absolute paths ensure compatibility between Main Thread and Worker
      const modelUrl = '/models/yolov8n_fp16.onnx';
      const modelType = 'yolov8';

      if (!this.worker) throw new Error('Worker is not initialized');

      this.worker.postMessage({
        type: 'init',
        payload: {
          samUrl: '/models/mobilesam_encoder_fp16.onnx',
          rtdetrUrl: modelUrl,
          modelType: modelType,
        },
      });

      const options = {
        executionProviders: ['wasm'],
        numThreads: self.navigator.hardwareConcurrency || 4,
        graphOptimizationLevel: 'basic' as const,
      };
      this.samDecoderSession = await ort.InferenceSession.create(
        '/models/mobilesam_decoder_fp16.onnx',
        options
      );

      const weightsResp = await fetch('/models/mobilesam_prompt_encoder_weights_fp16.json');
      const weights = await weightsResp.json();
      this.promptEncoder = new PromptEncoder(weights);

      this.isLoaded = true;
      state.set({
        modelStatus: 'ready',
        aiModel: { name: 'RT-DETR + MobileSAM (Worker Optimized)' },
      });
      this.log('✅ AI Engines Loaded (Hybrid Mode)');
    } catch (err: any) {
      this.log(`❌ Load error: ${err.message}`, 'error');
      state.set({ modelStatus: 'error' });
      throw err;
    }
  }

  detect(bitmap: ImageBitmap): Promise<BoundingBox[]> {
    if (!this.isLoaded || !this.worker) return Promise.resolve([]);
    const requestId = Math.random().toString(36).substring(2, 11);

    return new Promise((resolve) => {
      this.pendingDetections.set(requestId, resolve);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve([]);
        return;
      }
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

      this.worker!.postMessage(
        {
          type: 'detect',
          payload: { imageData, width: bitmap.width, height: bitmap.height, requestId },
        },
        [imageData.data.buffer]
      );
    });
  }

  /**
   * Prepare SAM for a specific image (can be active or background warmup)
   */
  async setSAMImage(bitmap: ImageBitmap, cacheKey: string): Promise<void> {
    if (!this.isLoaded || !cacheKey || !this.worker) return;

    // 1. If we are setting the ACTIVE image, update the key
    const current = state.currentImage;
    const isActive = current && current.name === cacheKey;
    if (isActive) {
      this.activeKey = cacheKey;
    }

    // 2. Check if already in cache
    const cacheEntry = this.embeddingCache.get(cacheKey);
    if (cacheEntry) {
      if (cacheEntry.embeddings && isActive) {
        state.set({ modelStatus: 'ready' });
      }
      return;
    }

    // 3. Prevent redundant tasks
    if (this.pendingCacheKeys.has(cacheKey)) return;

    // 4. Register metadata (dims) before sending to worker
    this.embeddingCache.set(cacheKey, { width: bitmap.width, height: bitmap.height });
    this.pendingCacheKeys.add(cacheKey);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

    const isPreload = !isActive;
    this.log(`${isPreload ? '💤 Warmup' : '🍳 Active'} encoding: ${cacheKey}...`);

    if (isActive) {
      state.set({ modelStatus: 'processing' });
    }

    this.worker.postMessage(
      {
        type: 'encode',
        payload: { imageData, width: bitmap.width, height: bitmap.height, cacheKey },
      },
      [imageData.data.buffer]
    );
  }

  /**
   * Run prediction using the context-specific embeddings from cache
   */
  async predictSAMMask(
    points: { coords: [number, number][]; labels: number[] } | null = null,
    boxes: [number, number, number, number][] | null = null
  ): Promise<number[] | null> {
    if (!this.activeKey || !this.promptEncoder || !this.samDecoderSession) return null;

    const entry = this.embeddingCache.get(this.activeKey);
    if (!entry || !entry.embeddings) return null;

    const origSize: [number, number] = [entry.height, entry.width];

    let tp: { coords: [number, number][]; labels: number[] } | null = null;
    if (points) {
      tp = {
        coords: this.samTransform.applyCoords(points.coords, origSize),
        labels: points.labels,
      };
    }
    let tb: [number, number, number, number][] | null = null;
    if (boxes) tb = this.samTransform.applyBoxes(boxes, origSize);

    const { sparse, sparseDims, dense, denseDims } = this.promptEncoder.encode(tp, tb);

    // 🚀 FP16 Transition: Convert sparse and dense embeddings to Float16 bits
    const sparseF16 = float32ToFloat16(sparse);
    const denseF16 = float32ToFloat16(dense);

    const results = await this.samDecoderSession.run({
      image_embeddings: entry.embeddings,
      sparse_embeddings: new ort.Tensor('float16', sparseF16, sparseDims),
      dense_embeddings: new ort.Tensor('float16', denseF16, denseDims),
    });

    const outputName = this.samDecoderSession.outputNames[0];
    if (!outputName) throw new Error('SAM Decoder output names empty');
    const maskOnnx = results[outputName];
    if (!maskOnnx) throw new Error('Failed to get mask output from SAM Decoder');

    const mask = this.postprocessMask(
      maskOnnx.data as Float32Array,
      maskOnnx.dims,
      origSize[0],
      origSize[1]
    );
    return mask;
  }

  postprocessMask(data: Float32Array, dims: readonly number[], h: number, w: number): number[] {
    const maskSize = 256;
    const longSide = Math.max(h, w);
    const scale = 1024 / longSide;
    const nh = h * scale;
    const nw = w * scale;
    const maskW = (nw / 1024) * maskSize;
    const maskH = (nh / 1024) * maskSize;

    const canvas = document.createElement('canvas');
    canvas.width = maskSize;
    canvas.height = maskSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    const imgData = ctx.createImageData(maskSize, maskSize);

    for (let i = 0; i < data.length; i++) {
      const val = data[i]! > 0 ? 255 : 0;
      imgData.data[i * 4] = val;
      imgData.data[i * 4 + 1] = val;
      imgData.data[i * 4 + 2] = val;
      imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = w;
    finalCanvas.height = h;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return [];
    fctx.drawImage(canvas, 0, 0, maskW, maskH, 0, 0, w, h);

    const finalImgData = fctx.getImageData(0, 0, w, h);
    const binaryMask: number[] = [];
    for (let i = 0; i < finalImgData.data.length; i += 4) {
      const v = finalImgData.data[i]!;
      binaryMask.push(v > 128 ? 1 : 0);
    }
    return binaryMask;
  }
}

/**
 * Utility: Convert Float32Array to Float16 (Uint16Array)
 */
function float32ToFloat16(float32Array: Float32Array): Uint16Array {
  const float16Array = new Uint16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const val = float32Array[i]!;
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);
    floatView[0] = val;
    const x = int32View[0]!;
    let bits = (x >> 16) & 0x8000;
    const m = (x >> 13) & 0x07ff;
    let e = (x >> 23) & 0xff;
    if (e === 0) {
      bits |= m >> 10;
    } else if (e === 0xff) {
      bits |= 0x7c00;
      bits |= m ? m >> 10 || 1 : 0;
    } else {
      e = e - 127 + 15;
      if (e >= 31) {
        bits |= 0x7c00;
      } else if (e <= 0) {
        bits |= (m | 0x0800) >> (1 - e);
      } else {
        bits |= (e << 10) | (m >> 1);
      }
    }
    float16Array[i] = bits;
  }
  return float16Array;
}

export const ai = new AIEngine();
