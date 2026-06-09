# ADR 002: Web Worker AI Inference Pipeline

## Status
**Accepted**

## Context
SharpTensor is designed as a local-first, privacy-respecting instance segmentation tool. To achieve automatic bounding box and mask generation without a backend server, we utilize deep learning models running directly in the browser via the ONNX Runtime Web API. 

The two primary models are:
1. **MobileSAM**: For "Magic Box" semantic segmentation.
2. **RT-DETR** (or YOLOv8): For auto-labeling bulk datasets.

Running tensor mathematics and neural network inferences natively on the browser's Main UI Thread causes significant frame drops. Encoding a 1024x1024 image with MobileSAM can take anywhere from 300ms to 2000ms depending on hardware. If executed on the Main Thread, the browser freezes completely, halting CSS animations, rendering, and making the application feel completely unresponsive, destroying the premium user experience.

## Decision
We decided to offload all heavy neural network inferences (ONNX Runtime sessions) to a dedicated **Web Worker**.

1. **Worker Thread Isolation:** A background `worker.ts` script is responsible for instantiating the ONNX models (`onnxruntime-web`) and executing inference logic.
2. **Asynchronous Message Passing:** The Main UI Thread communicates with the Web Worker via standard `postMessage` protocol. We structured this using discriminated unions (e.g., `type: 'encode' | 'detect' | 'init'`).
3. **ArrayBuffer Transfers:** Because serializing massive image arrays across thread boundaries is slow, we extract raw `ImageData` pixel buffers via Canvas 2D and pass them to the Worker as zero-copy `ArrayBuffer` transfers when possible.
4. **Main Thread Decoder:** While the heavy *Encoder* (MobileSAM backbone) runs in the Worker, the lightweight *Decoder* (prompt processing) executes on the Main Thread. The Decoder takes ~10ms, allowing real-time interactive "Magic Box" generation during mouse drag events without asynchronous latency overhead.

## Consequences

### Positive
- **Fluid UI:** The canvas, animations, and buttons remain 100% responsive while deep learning models process in the background.
- **Improved UX:** We can safely display loading spinners and progress bars that actually animate smoothly during complex inferences.
- **Architectural Clarity:** The `AIOrchestrator` on the Main Thread acts purely as a coordinator, completely decoupled from the specific low-level tensor logic handling.

### Negative / Risks
- **Complexity:** Debugging Web Workers can be tedious as they do not share the exact same global scope or console output flow as the Main Thread.
- **Memory Overhead:** Passing `Float32Array` embeddings back from the worker to the Main Thread requires memory allocation overhead, requiring strict cache management (evicting older embeddings).
- **Bundle Size/Setup:** Requires Vite-specific worker instantiation logic (`?worker`) to ensure the ONNX WebAssembly binaries are correctly mapped and served.
