# SharpTensor Architecture (C4 Model)

This document provides an architectural overview of the SharpTensor application using the [C4 model for visualizing software architecture](https://c4model.com/). 

## Level 1: System Context Diagram

The System Context diagram provides a high-level overview of SharpTensor, showing how the system fits into the world around it and how it interacts with external entities.

```mermaid
C4Context
  title System Context Diagram for SharpTensor

  Person(annotator, "Computer Vision Engineer", "A user who needs to prepare image datasets for YOLO training.")
  
  System(sharptensor, "SharpTensor", "Local-first web application for high-speed YOLO bounding box and mask annotation.")

  System_Ext(local_fs, "Local File System", "The user's local hard drive where images and YOLO .txt labels are stored.")
  System_Ext(model_cdn, "AI Model Provider (CDN)", "Provides pre-trained ONNX models (e.g., YOLOv8n, MobileSAM) on initial load.")

  Rel(annotator, sharptensor, "Annotates images, runs AI auto-labeling", "Web Browser")
  Rel(sharptensor, local_fs, "Reads images, reads/writes YOLO .txt and classes.txt", "File System Access API")
  Rel(sharptensor, model_cdn, "Downloads ONNX models (cached locally after)", "HTTPS")

  UpdateElementStyle(sharptensor, $bgColor="#007ACC", $fontColor="#FFFFFF")
```

---

## Level 2: Container Diagram

The Container diagram zooms into the SharpTensor system to show the high-level technical building blocks.

```mermaid
C4Container
  title Container Diagram for SharpTensor

  Person(annotator, "Computer Vision Engineer", "A user who needs to prepare image datasets for YOLO training.")
  
  System_Boundary(c1, "SharpTensor Application (Browser)") {
    Container(spa, "Single-Page Application", "Vanilla JS, Vite, HTML5 Canvas", "Provides the user interface, renders the high-performance canvas, and handles application state.")
    Container(ai_worker, "AI Web Worker", "Web Worker, ONNX Runtime Web", "Runs heavy AI inference tasks in the background to prevent UI blocking.")
    ContainerDb(browser_cache, "Browser Cache / IndexedDB", "Browser Storage", "Caches downloaded ONNX models and local application settings.")
  }

  System_Ext(local_fs, "Local File System", "The user's local hard drive.")
  System_Ext(model_cdn, "AI Model Provider (CDN)", "Provides pre-trained ONNX models.")

  Rel(annotator, spa, "Interacts with UI (Draws, Pans, Zooms)", "Mouse/Keyboard")
  Rel(spa, local_fs, "Reads images, reads/writes annotations", "File System Access API")
  Rel(spa, ai_worker, "Sends image data for inference, receives predictions", "postMessage API")
  Rel(ai_worker, model_cdn, "Fetches ONNX models (if not cached)", "HTTPS")
  Rel(ai_worker, browser_cache, "Reads/Writes cached models", "IndexedDB API")
```

---

## Level 3: Component Diagrams

The Component diagrams zoom into individual containers to show their internal structure.

### 3.1 Components: Single-Page Application (Main UI Thread)

```mermaid
C4Component
  title Component Diagram for Single-Page Application

  Container_Boundary(spa, "Single-Page Application") {
    Component(ui_controller, "UI Controller", "js/main.js, js/components/*", "Manages DOM elements, event listeners (hotkeys), and modal dialogs.")
    Component(state_manager, "State Manager", "js/core/state.js", "Holds the centralized source of truth for the current session (images loaded, annotations, selected classes).")
    Component(canvas_engine, "Canvas Engine", "js/engine/canvas.js", "Handles 60FPS rendering, spatial transformations (pan/zoom), and hit-testing for bounding boxes.")
    Component(file_explorer, "File System Explorer", "js/main.js", "Interfaces with the OS to stream directory contents and read image blobs via the File System Access API.")
    Component(yolo_serializer, "YOLO IO Manager", "js/utils/yolo.js", "Serializes and deserializes internal annotation state to/from standard YOLO .txt formats and maintains classes.txt.")
    Component(worker_bridge, "AI Worker Bridge", "js/core/ai.js", "Abstracts the complexity of messaging the AI Web Worker, managing promises and task queues.")
  }

  Container(ai_worker, "AI Web Worker", "Web Worker", "Background AI Inference.")
  System_Ext(local_fs, "Local File System", "The user's local hard drive.")

  Rel(ui_controller, state_manager, "Reads/Updates state")
  Rel(ui_controller, canvas_engine, "Forwards interaction coordinates")
  Rel(canvas_engine, state_manager, "Reads annotations for rendering")
  Rel(file_explorer, state_manager, "Populates image lists")
  Rel(file_explorer, local_fs, "Reads files/directories")
  Rel(yolo_serializer, state_manager, "Syncs annotation data")
  Rel(yolo_serializer, local_fs, "Reads/Writes .txt files")
  Rel(worker_bridge, state_manager, "Triggers AI state updates")
  Rel(worker_bridge, ai_worker, "Dispatches tasks", "postMessage")
```

### 3.2 Components: AI Web Worker

```mermaid
C4Component
  title Component Diagram for AI Web Worker

  Container_Boundary(ai_worker, "AI Web Worker") {
    Component(message_handler, "Worker Message Router", "js/core/ai.worker.js", "Receives messages from the main thread and routes to appropriate processing pipelines.")
    Component(model_loader, "Model Loader", "js/core/ai.worker.js (ONNX API)", "Downloads (or loads from cache) and initializes the ONNX inference sessions.")
    Component(inference_engine, "ONNX Inference Session", "ONNX Runtime Web (WASM)", "Executes the neural network graph on provided tensors.")
    Component(preprocessor, "Image Preprocessor", "js/core/ai.worker.js", "Resizes, normalizes, and converts image data into Float16 tensors.")
    Component(postprocessor, "Result Postprocessor", "js/core/ai.worker.js, js/core/sam_utils.js", "Performs Non-Maximum Suppression (NMS) for YOLO and contour tracing for SAM masks.")
  }

  Container(spa, "Single-Page Application", "Vanilla JS", "Main UI Thread.")
  ContainerDb(browser_cache, "Browser Cache / IndexedDB", "Browser Storage", "Local model storage.")

  Rel(spa, message_handler, "Sends tasks (Image Data, Prompts)", "postMessage")
  Rel(message_handler, preprocessor, "Passes raw image data")
  Rel(message_handler, model_loader, "Requests model initialization")
  Rel(model_loader, browser_cache, "Loads models")
  Rel(preprocessor, inference_engine, "Passes formatted tensors")
  Rel(inference_engine, postprocessor, "Passes raw tensor outputs")
  Rel(postprocessor, message_handler, "Returns formatted predictions")
  Rel(message_handler, spa, "Returns predictions", "postMessage")
```
