import { vi } from 'vitest';

(globalThis as any).HTMLCanvasElement.prototype.getContext = () => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(10), width: 10, height: 10 })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(10), width: 10, height: 10 })),
  drawImage: vi.fn(),
  setTransform: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  closePath: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  font: '',
});

(globalThis as any).OffscreenCanvas = class OffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return (globalThis as any).HTMLCanvasElement.prototype.getContext();
  }
};

(globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({ width: 100, height: 100 });

// Mock Web Worker
class WorkerMock {
  url: string;
  onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null;

  constructor(stringUrl: string) {
    this.url = stringUrl;
  }

  postMessage(msg: any) {
    // We can intercept messages in tests
  }

  terminate() {}
}

(globalThis as any).Worker = WorkerMock;

const mockOrt = {
  InferenceSession: {
    create: vi.fn().mockResolvedValue({
      run: vi.fn().mockResolvedValue({}),
      inputNames: ['input'],
      outputNames: ['output'],
    }),
  },
  Tensor: class Tensor {
    type: string;
    data: any;
    dims: number[];
    constructor(type: string, data: any, dims: number[]) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
  },
  env: { wasm: { wasmPaths: '' } },
};

// Mock ONNX Runtime Web to prevent loading actual models
vi.mock('onnxruntime-web', () => {
  return mockOrt;
});
(globalThis as any).ort = mockOrt;
