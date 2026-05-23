# Bring Your Own Model (BYOM) Implementation Plan

This plan bridges the gap between our feasibility study and the actual code execution required to enable BYOM in SharpTensor. It details the technical steps alongside a newly designed, premium UX/UI strategy for model management.

## 1. UX/UI Blueprint: The "Model Manager"
To provide an elite user experience, BYOM requires a polished interface where users can upload models and tweak postprocessing logic without leaving the browser.

### A. The Slide-Over Panel (Glassmorphism)
Instead of an intrusive full-screen block, we will implement a sleek, right-side slide-over panel toggled by the existing "Load Custom Model" button.
- **Aesthetic**: `bg-(--bg-card)` with a heavy `backdrop-blur-xl` and `bg-opacity-80` to keep the canvas visible underneath.
- **Animations**: A smooth horizontal slide-in transition (`translate-x-full` to `translate-x-0`).

### B. Drag-and-Drop Upload Zone
- **Visuals**: A dashed border area with a subtle, pulsating glow on drag-over.
- **Feedback**: Upon dropping an `.onnx` file, immediately display the file size and a green "Memory Validated" badge.

### C. The Configuration Editor
- **Smart Archetype Selector**: A styled dropdown for common models. Selecting an archetype automatically populates the required mathematical constants:
  - `YOLOv8 / YOLOv10 (Default)`: Auto-fills Mean = `0, 0, 0`, Std = `255, 255, 255`
  - `RT-DETR (Ultralytics)`: Auto-fills Mean = `0, 0, 0`, Std = `255, 255, 255`
  - `RT-DETR (Original/Paddle)`: Auto-fills ImageNet values Mean = `0.485, 0.456, 0.406`, Std = `0.229, 0.224, 0.225`
  - `Custom JS`: Reveals the custom sandbox and leaves fields exposed for manual entry.
- **Advanced Options Accordion**: To maintain a premium, user-friendly UI, the following highly technical fields are hidden by default:
  - **Input Dimensions**: Numeric inputs for Width/Height mapping to the ONNX tensor requirements.
  - **Normalization**: Fields to specify `Mean` and `Standard Deviation`.
- **Custom Sandbox Area**: If the "Custom JS" archetype is selected, reveal a dark-themed `<textarea>` with monospace font (`font-mono text-sm text-(--accent)`) for users to write their bespoke JavaScript decoder snippet.

### D. Progress Feedback
- When applying the model, the "Load Model" button will transition into a spinner.
- Existing bottom-left status texts will update in real-time: *“Reading ArrayBuffer...” ➔ “Caching to IndexedDB...” ➔ “Compiling WebAssembly...”*

---

## 2. Technical Implementation Roadmap

### Phase 1: Local Storage & State Management (IndexedDB)
We cannot ask the user to re-upload a 50MB model every time they refresh the page.
1. **Create `src/core/db.ts`**: Implement a lightweight wrapper around the browser's native `indexedDB` API.
2. **Schema**: Create an object store named `byom-store` that holds two keys:
   - `customModel` (The `.onnx` ArrayBuffer)
   - `customConfig` (The JSON config mapping)
3. **State Updates**: Add `byomConfig` and `customModelBuffer` to `AppStateData` in `types.ts`.

### Phase 2: Web Worker Protocol Upgrade
1. **Transferable Objects**: Update `AIEngine.initWorker()` to send the `ArrayBuffer` via `postMessage({ ... }, [buffer])`.
2. **Session Initialization**: Refactor `ai.worker.ts` so `ort.InferenceSession.create` accepts the raw byte array instead of a static URL string.

### Phase 3: Dynamic Preprocessing Engine
1. Pass the `byomConfig` input shape and normalization vectors into the worker.
2. Rewrite the `preprocess()` function in `ai.worker.ts`:
   - Dynamically resize the `OffscreenCanvas` based on the config input dimensions instead of the hardcoded `640x640`.
   - Apply user-defined Mean and Std variables during the Float32 array generation loop.

### Phase 4: Dynamic Decoding Engine & Sandboxing
1. Implement a `switch` statement in the worker's `detect` handler based on `byomConfig.decoder.type`.
2. Route default archetypes (`YOLOv8`, `RT-DETR`) to our existing optimized decoders.
3. **The Sandbox Runtime**:
   - If `decoder.type === 'custom_js'`, compile the user string:
     ```javascript
     const userDecoder = new Function('tensors', 'config', 'nms', byomConfig.decoder.code);
     const detections = userDecoder(results, byomConfig, nms);
     ```
   - Provide the native `nms` (Non-Maximum Suppression) utility function to the sandbox so users don't have to reinvent the wheel.

### Phase 5: End-to-End Integration
1. Wire the UI panel to the `db.ts` IndexedDB saver.
2. Ensure the "Clear All" or reset functions do not accidentally nuke the custom model cache unless explicitly requested.
