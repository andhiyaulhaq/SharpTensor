# Detailed Feasibility Study: Bring Your Own Model (BYOM) in SharpTensor

This document provides a highly detailed architectural analysis and implementation blueprint for integrating custom ONNX models (BYOM) into SharpTensor. Designed for visual comprehension, this study diagrams every component of the client-side, local-first ML pipeline.

---

## 1. Architectural Overview: Current vs. Proposed

Currently, SharpTensor relies on static paths and hardcoded model parameters. The proposed BYOM model introduces a runtime configuration layer that dynamically adapts preprocessing and postprocessing logic based on model metadata.

### Current Static Pipeline
```mermaid
flowchart LR
    Asset["Static Asset Folder (/models/*)"] -->|Loads Fixed ONNX| Engine["AIEngine (yolov8n_fp16.onnx)"]
    Canvas["Input Image (DOM Canvas)"] -->|Fixed 640x640 Resize| Engine
    Engine -->|Fixed Output Tensors| Output["decodeYOLOv8() Parser"]
    Output -->|Result| Bboxes["Canvas Render & State Update"]
```

### Proposed BYOM Pipeline
```mermaid
flowchart TD
    UserONNX["Custom Model File (.onnx)"] -->|1. File Upload / IndexedDB| Main["Main Thread (App UI)"]
    UserJSON["Model Config (JSON)"] -->|2. Configuration Schema| Main
    Main -->|3. Transferable ArrayBuffer & Config| Worker["Web Worker (ai.worker.ts)"]
    
    SubGraph1["Worker Inference Pipeline"]
    Image["Input Image Data"] -->|4. Dynamic Preprocess| OffscreenCanvas["OffscreenCanvas (Dynamic Resize/Norm)"]
    OffscreenCanvas -->|5. Float32/Float16 Tensor| SessionRun["ort.InferenceSession.run()"]
    SessionRun -->|6. Raw Output Tensors| DynamicDecoder{"Decoder Dispatcher"}
    
    DynamicDecoder -->|Type: YOLOv5/v8/RT-DETR| Preset["Preset Decode Engine"]
    DynamicDecoder -->|Type: Custom JS| Sandbox["Sandboxed Eval Runtime"]
    
    Preset -->|7. BoundingBoxes Array| OutMsg["Worker postMessage()"]
    Sandbox -->|7. BoundingBoxes Array| OutMsg
    
    OutMsg -->|8. Transfer Result| Main
    Main -->|9. Redraw Canvas| UI["Updated Bounding Boxes UI"]

    style SubGraph1 fill:#1e1e2e,stroke:#313244,stroke-width:2px;
```

---

## 2. Deep Dive: Memory-Safe Model Transfer (Transferable Objects)
Loading files up to 200MB in the browser can freeze the UI thread. The BYOM architecture mitigates this by bypassing the standard structured clone algorithm using **Transferable Objects**.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (ML Engineer)
    participant UI as Main Thread (UI)
    participant IDB as IndexedDB Storage
    participant Worker as Background Web Worker
    participant ORT as ONNX Runtime Web

    User->>UI: Selects model.onnx & config.json
    UI->>UI: Read File as ArrayBuffer (binary)
    Note over UI: Zero-Copy memory channel established
    UI->>Worker: postMessage({ type: 'init_byom', config }, [arrayBuffer])
    Note right of UI: ArrayBuffer memory is transferred,<br/>instantly cleared from Main Thread.
    Worker->>ORT: ort.InferenceSession.create(uint8array)
    ORT-->>Worker: Session Ready
    Worker-->>UI: initialized
    UI->>IDB: Cache ArrayBuffer & Config (For persistence)
```

---

## 3. Preprocessing Engine: Dynamic Offscreen Canvas
Different models require varying dimensions, color normalization factors, and normalization styles. Below is the proposed dynamic preprocessing pipeline mapping any image file input to a runtime-defined model input tensor.

```mermaid
graph TD
    RawImage["Raw Image Data (Variable Size)"] --> InputSize["Read Config: inputShape [W, H]"]
    InputSize --> Offscreen["Instantiate OffscreenCanvas (W x H)"]
    Offscreen --> Fill["Fill Black #000000 (Letterboxing)"]
    Fill --> Draw["Draw scaled Image (Maintain Aspect Ratio)"]
    Draw --> Pixels["Extract ImageData via getImageData()"]
    
    Pixels --> Norm{"Read Norm Config"}
    Norm -->|Mean / Std Deviation| Math["Normalize per Channel: (Pixel - Mean) / Std"]
    Math --> TypeConfig{"Read Tensor Format"}
    
    TypeConfig -->|float32| OutputF32["Create Float32 Tensor"]
    TypeConfig -->|float16| F32toF16["IEEE 754 float32 -> float16 converter"]
    F32toF16 --> OutputF16["Create Float16 Tensor"]
    
    OutputF32 --> Model["Feed to ONNX model.run()"]
    OutputF16 --> Model
```

---

## 4. The Extensible Decoder: Archetypes & JS Sandboxing
Once the model runs, the raw tensors must be converted to structured coordinates (`BoundingBox[]`).

```mermaid
stateDiagram-v2
    [*] --> RunInference : ONNX model output
    RunInference --> IdentifyOutputFormat : Read config.decoderType

    state IdentifyOutputFormat {
        [*] --> CheckType
        CheckType --> YOLOv8 : "yolov8"
        CheckType --> YOLOv5 : "yolov5"
        CheckType --> RTDETR : "rtdetr"
        CheckType --> CustomJS : "custom_js"
    }

    state YOLOv8 {
        [*] --> ParseYOLOv8Tensors : Extract [1, 84, 8400]
        ParseYOLOv8Tensors --> ApplyYOLOv8Math
    }

    state CustomJS {
        [*] --> CompileSandbox : new Function('tensors', 'config', userCode)
        CompileSandbox --> ExecuteSandbox : Run code inside Web Worker context
        ExecuteSandbox --> CatchErrors : Check for runtime exceptions
    }

    ApplyYOLOv8Math --> ApplyNMS : Filter overlaps
    CatchErrors --> ApplyNMS : Process custom array
    
    ApplyNMS --> ReturnBboxes : Output normalized boxes
    ReturnBboxes --> [*]
```

### JSON Configuration Schema Blueprint
To support this pipeline, users will configure their model using a JSON manifest like the one shown below:

```json
{
  "name": "Custom MobileNet-SSD",
  "task": "detection",
  "input": {
    "name": "input_tensor",
    "shape": [1, 3, 300, 300],
    "mean": [127.5, 127.5, 127.5],
    "std": [127.5, 127.5, 127.5],
    "format": "float32"
  },
  "decoder": {
    "type": "custom_js",
    "iouThreshold": 0.45,
    "scoreThreshold": 0.5,
    "code": "const boxes = tensors.output_boxes.data;\nconst scores = tensors.output_scores.data;\nconst detections = [];\n// Parse bounding boxes logic...\nreturn detections;"
  }
}
```

---

## 5. Local Persistence Architecture (IndexedDB Cache)
Large models shouldn't be re-uploaded on page reload. The local storage architecture relies on IndexedDB to cache custom `.onnx` binaries and configs.

```mermaid
flowchart TD
    Start["1. App Start"] --> CheckCached{"2. Check IndexedDB"}
    
    CheckCached -->|Model Found| LoadDB["3. Load ArrayBuffer from DB"]
    LoadDB --> InitSession["4. Initialize Inference Session"]
    
    CheckCached -->|No Model| ShowUpload["3. Show 'Load Custom Model' Button"]
    ShowUpload --> UserUpload["4. User Uploads .onnx File"]
    UserUpload --> SaveDB["5. Save ArrayBuffer to IndexedDB"]
    SaveDB --> InitSession
    
    InitSession --> AppReady["6. App Ready for Offline Inference"]
```

---

## 6. Implementation Stages & Estimated Effort

```mermaid
gantt
    title BYOM Implementation Timeline
    dateFormat  YYYY-MM-DD
    
    section Stage 1: Worker Core
    Modify AIEngine & Worker for ArrayBuffers :active, a1, 2026-05-24, 3d
    Implement Dynamic Preprocessing Pipeline :active, a2, after a1, 2d
    
    section Stage 2: Decoders
    Build YOLOv5/v8 Archetype Decoders : b1, after a2, 3d
    Build Custom JS Sandbox Execution Engine : b2, after b1, 2d
    
    section Stage 3: UI & Storage
    Design Upload and JSON Editor Panel : c1, after b2, 2d
    Implement IndexedDB Persistent Cache : c2, after c1, 2d
    E2E Testing & Verification : c3, after c2, 2d
```

---

## 7. Security Architecture of the JS Sandbox
Running user-submitted JavaScript inside the browser poses security risks. However, the Web Worker execution model acts as a natural boundary:

```mermaid
graph TD
    subgraph MainThread ["Browser Window"]
        DOM["DOM Tree API"]
        Cookies["Document Cookies"]
        LocalStorage["Local Storage"]
    end

    subgraph WorkerContext ["Web Worker Sandbox"]
        ort["ONNX Runtime WASM"]
        evalCode["Sandboxed Postprocessor"]
    end

    DOM -. Blocked .-> evalCode
    Cookies -. Blocked .-> evalCode
    LocalStorage -. Blocked .-> evalCode
    
    evalCode -->|Read Only| ort
    evalCode -->|Returns Array| DOM
```

- **Access Restriction**: The Web Worker has no access to the `window` object, the `document` object, DOM elements, cookies, or `localStorage`.
- **Network Isolation**: The sandboxed JS code can run purely arithmetic operations on typed arrays, making it impossible to perform Cross-Site Scripting (XSS) attacks or hijack user session data.
