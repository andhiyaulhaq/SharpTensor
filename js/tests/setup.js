import { vi } from 'vitest';

global.HTMLCanvasElement.prototype.getContext = () => ({
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

global.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return global.HTMLCanvasElement.prototype.getContext();
  }
};

global.createImageBitmap = vi.fn().mockResolvedValue({ width: 100, height: 100 });

// Mock Web Worker
class WorkerMock {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(msg) {
    // We can intercept messages in tests
  }

  terminate() {}
}

global.Worker = WorkerMock;

const mockOrt = {
  InferenceSession: {
    create: vi.fn().mockResolvedValue({
      run: vi.fn().mockResolvedValue({}),
      inputNames: ['input'],
      outputNames: ['output']
    })
  },
  Tensor: class Tensor {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
  },
  env: { wasm: { wasmPaths: '' } }
};

// Mock ONNX Runtime Web to prevent loading actual models
vi.mock('onnxruntime-web', () => {
  return mockOrt;
});
globalThis.ort = mockOrt;
