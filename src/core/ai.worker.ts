import * as ort from 'onnxruntime-web';
import { WorkerInboundMessage, BoundingBox } from './types';

// Configure WASM paths
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.25.1/dist/';

let samEncoderSession: ort.InferenceSession | null = null;
let detSession: ort.InferenceSession | null = null;
let modelType: 'yolov8' | 'rtdetr' = 'yolov8'; // Default

self.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const { type, payload } = event.data;

  try {
    if (type === 'init') {
      const { samUrl, rtdetrUrl, modelType: typeFlag } = payload;
      modelType = typeFlag || 'yolov8';
      const numThreads = self.navigator.hardwareConcurrency || 4;

      const initTasks: Promise<void>[] = [];

      // 1. Initialize SAM Encoder (Self-contained FP16)
      if (samUrl && !samEncoderSession) {
        initTasks.push(
          (async () => {
            try {
              samEncoderSession = await ort.InferenceSession.create(
                samUrl as any,
                {
                  executionProviders: ['wasm'],
                  numThreads,
                  graphOptimizationLevel: 'basic',
                } as any
              );
            } catch (e: any) {
              throw new Error(`SAM Encoder failed: ${e.message}`, { cause: e });
            }
          })()
        );
      }

      // 2. Initialize Detection Engine (RT-DETR or YOLOv8)
      if (rtdetrUrl && !detSession) {
        initTasks.push(
          (async () => {
            try {
              detSession = await ort.InferenceSession.create(
                rtdetrUrl as any,
                {
                  executionProviders: ['wasm'],
                  numThreads,
                } as any
              );
            } catch (e: any) {
              throw new Error(`Detection Engine failed: ${e.message}`, { cause: e });
            }
          })()
        );
      }

      await Promise.all(initTasks);
      (self as any).postMessage({ type: 'initialized' });
    }

    if (type === 'encode') {
      if (!samEncoderSession) throw new Error('SAM Encoder not initialized');
      const { imageData, width, height, cacheKey } = payload;
      const start = performance.now();

      const canvas = new OffscreenCanvas(1024, 1024);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context for OffscreenCanvas');
      const bitmap = await createImageBitmap(imageData);

      const scale = 1024 / Math.max(height, width);
      const nw = width * scale;
      const nh = height * scale;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(bitmap, 0, 0, nw, nh);

      const samImageData = ctx.getImageData(0, 0, 1024, 1024);
      const input = preprocess(
        samImageData,
        1024,
        [123.675, 116.28, 103.53],
        [58.395, 57.12, 57.375]
      );

      const outputs = await samEncoderSession.run({ images: input });
      const outputName = samEncoderSession.outputNames[0];
      if (!outputName) throw new Error('SAM Encoder has no output names');
      const embeddings = outputs[outputName];
      if (!embeddings) throw new Error('Failed to get embeddings output');

      // The embedding data is Float32Array or Uint16Array. We pass it as-is.
      const buffer = (embeddings.data as any).buffer;

      (self as any).postMessage(
        {
          type: 'encoded',
          payload: {
            embeddings: embeddings.data as any,
            dims: embeddings.dims,
            cacheKey,
            latency: performance.now() - start,
          },
        },
        [buffer]
      );
    }

    if (type === 'detect') {
      if (!detSession) throw new Error('Detection session not initialized');
      const { imageData, width, height, requestId } = payload;
      const start = performance.now();

      // All detection models currently use 640x640 input
      const canvas = new OffscreenCanvas(640, 640);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context for OffscreenCanvas');
      const bitmap = await createImageBitmap(imageData);

      const r = Math.min(640 / width, 640 / height);
      const nw = width * r;
      const nh = height * r;
      const dw = (640 - nw) / 2;
      const dh = (640 - nh) / 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 640, 640);
      ctx.drawImage(bitmap, dw, dh, nw, nh);

      const detImageData = ctx.getImageData(0, 0, 640, 640);
      const input = preprocess(detImageData, 640, [0, 0, 0], [255.0, 255.0, 255.0]);

      const results = await detSession.run({ images: input });

      let detections: BoundingBox[] = [];
      if (modelType === 'yolov8') {
        detections = decodeYOLOv8(results, r, dw, dh);
      } else {
        detections = decodeRTDETR(results, r, dw, dh);
      }

      self.postMessage({
        type: 'detected',
        payload: { detections, requestId, latency: performance.now() - start },
      });
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', payload: err.message });
  }
};

/**
 * Shared Preprocessing (HWC to CHW)
 * Now supports Float16 for optimized models.
 */
function preprocess(
  imageData: ImageData,
  size: number,
  mean: [number, number, number],
  std: [number, number, number]
): ort.Tensor {
  const floatData = new Float32Array(size * size * 3);
  const { data } = imageData;

  for (let i = 0; i < data.length / 4; i++) {
    floatData[i] = (data[i * 4]! - mean[0]) / std[0];
    floatData[i + size * size] = (data[i * 4 + 1]! - mean[1]) / std[1];
    floatData[i + size * size * 2] = (data[i * 4 + 2]! - mean[2]) / std[2];
  }

  // Convert Float32Array to Uint16Array (containing Float16 bits)
  const float16Data = float32ToFloat16(floatData);
  return new ort.Tensor('float16', float16Data, [1, 3, size, size]);
}

/**
 * Utility: Convert Float32Array to Float16 (Uint16Array)
 */
function float32ToFloat16(float32Array: Float32Array): Uint16Array {
  const float16Array = new Uint16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const val = float32Array[i]!;

    // Manual bit conversion (IEEE 754)
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);
    floatView[0] = val;
    const x = int32View[0]!;

    let bits = (x >> 16) & 0x8000; // Get sign
    const m = (x >> 13) & 0x07ff; // Get mantissa
    let e = (x >> 23) & 0xff; // Get exponent

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

/**
 * ENGINE: RT-DETR Decoder
 */
function decodeRTDETR(
  results: ort.InferenceSession.ReturnType,
  r: number,
  dw: number,
  dh: number
): BoundingBox[] {
  if (!detSession) return [];
  const outputName0 = detSession.outputNames[0]!;
  const outputName1 = detSession.outputNames[1]!;
  const logits = results[outputName0]!.data as Float32Array;
  const boxesRaw = results[outputName1]!.data as Float32Array;
  const numPredictions = results[outputName1]!.dims[1]!;
  const numClasses = results[outputName0]!.dims[2]!;

  const candidates: BoundingBox[] = [];
  for (let i = 0; i < numPredictions; i++) {
    let maxScore = -1;
    let classId = -1;
    for (let c = 0; c < numClasses; c++) {
      const score = 1 / (1 + Math.exp(-logits[i * numClasses + c]!));
      if (score > maxScore) {
        maxScore = score;
        classId = c;
      }
    }

    if (maxScore > 0.5) {
      const cx = boxesRaw[i * 4]! * 640;
      const cy = boxesRaw[i * 4 + 1]! * 640;
      const w = boxesRaw[i * 4 + 2]! * 640;
      const h = boxesRaw[i * 4 + 3]! * 640;
      candidates.push({
        id: Math.random(),
        classId,
        x: (cx - w / 2 - dw) / r,
        y: (cy - h / 2 - dh) / r,
        width: w / r,
        height: h / r,
        score: maxScore,
      });
    }
  }
  return nms(candidates, 0.45);
}

/**
 * ENGINE: YOLOv8 Decoder
 */
function decodeYOLOv8(
  results: ort.InferenceSession.ReturnType,
  r: number,
  dw: number,
  dh: number
): BoundingBox[] {
  if (!detSession) return [];
  const outputName0 = detSession.outputNames[0]!;
  const output = results[outputName0]!.data as Float32Array; // [1, 84, 8400]
  const dims = results[outputName0]!.dims;
  const numClasses = dims[1]! - 4;
  const numAnchors = dims[2]!;

  const candidates: BoundingBox[] = [];
  for (let i = 0; i < numAnchors; i++) {
    let maxScore = -1;
    let classId = -1;

    for (let c = 0; c < numClasses; c++) {
      const score = output[(c + 4) * numAnchors + i]!;
      if (score > maxScore) {
        maxScore = score;
        classId = c;
      }
    }

    if (maxScore > 0.45) {
      // YOLOv8 returns [cx, cy, w, h]
      const cx_raw = output[0 * numAnchors + i]!;
      const cy_raw = output[1 * numAnchors + i]!;
      const w_raw = output[2 * numAnchors + i]!;
      const h_raw = output[3 * numAnchors + i]!;

      // Auto-sense if normalized or pixels
      const isNormalized = cx_raw <= 1.2 && cy_raw <= 1.2 && w_raw <= 1.2 && h_raw <= 1.2;
      const cx = isNormalized ? cx_raw * 640 : cx_raw;
      const cy = isNormalized ? cy_raw * 640 : cy_raw;
      const w = isNormalized ? w_raw * 640 : w_raw;
      const h = isNormalized ? h_raw * 640 : h_raw;

      candidates.push({
        id: Math.random(),
        classId,
        x: (cx - w / 2 - dw) / r,
        y: (cy - h / 2 - dh) / r,
        width: w / r,
        height: h / r,
        score: maxScore,
      });
    }
  }
  return nms(candidates, 0.45);
}

/**
 * UTILITY: Non-Maximum Suppression
 */
function nms(boxes: BoundingBox[], iouThreshold: number): BoundingBox[] {
  const sorted = boxes.sort((a, b) => (b.score || 0) - (a.score || 0));
  const selected: BoundingBox[] = [];
  const active = new Array(boxes.length).fill(true);

  for (let i = 0; i < sorted.length; i++) {
    if (!active[i]) continue;
    selected.push(sorted[i]!);

    for (let j = i + 1; j < sorted.length; j++) {
      if (!active[j]) continue;
      if (calculateIoU(sorted[i]!, sorted[j]!) > iouThreshold) {
        active[j] = false;
      }
    }
  }
  return selected;
}

function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const w = Math.max(0, x2 - x1);
  const y = Math.max(0, y2 - y1); // y is height delta
  const inter = w * y;
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  return inter / (area1 + area2 - inter);
}
