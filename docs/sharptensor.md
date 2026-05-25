---
slug: sharptensor
title: SharpTensor
category: AI/ML
description: A local-first web app for preparing YOLO datasets with zero-setup AI inference in the browser and native file system access.

tech:
  - TypeScript
  - Vite
  - HTML5 Canvas
  - ONNX Runtime Web
  - YOLOv8n / RT-DETR
  - MobileSAM
  - Tailwind CSS
  - Web Workers
  - File System Access API
  - Vitest
  - Playwright
  - Cloudflare Workers

github: https://github.com/andhiyaulhaq/SharpTensor
demo: https://sharptensor.andhiyaulhaq.workers.dev/
thumbnail: '../../assets/projects/sharptensor.png'

featured: true
imageStyle: 'background: linear-gradient(135deg, #242c2e 0%, #2f383b 50%, #1e2527 100%);'

problem: >
  Preparing YOLO datasets means wrangling Python environments, configuring AI servers,
  and converting annotation formats — a slow, brittle workflow that wastes hours before
  a single label is drawn.
solution: >
  SharpTensor delivers a complete YOLO annotation workstation in a single URL. It runs
  YOLOv8n, RT-DETR, and MobileSAM inference entirely on the client via WebAssembly, so
  there are no servers or API keys to manage. It reads and writes YOLO's native .txt format
  directly to the local filesystem, making datasets immediately ready for training.

impact:
  - metric: '60'
    unit: 'FPS'
    context: 'sustained canvas framerate during pan/zoom on 4K+ images'
  - metric: '2'
    unit: 'detection models'
    context: 'YOLOv8n + RT-DETR, swappable at runtime'
  - metric: '0'
    unit: 'server costs'
    context: '100% client-side processing, no backend infrastructure'

decisions:
  - question: 'Why Web Workers instead of a backend AI server?'
    answer: 'Preserving the local-first promise. Running ONNX inference in a dedicated Worker keeps the UI at 60 FPS while the ~8.7s SAM encoder runs, all without requiring users to set up or pay for GPU infrastructure.'
  - question: 'Why the File System Access API over upload-based workflows?'
    answer: "Uploading datasets is slow, expensive, and raises privacy concerns. The File System Access API lets us read and write YOLO .txt files directly on the user's machine with zero data transfer."
  - question: 'Why YOLO-native I/O instead of a generic JSON format?'
    answer: "Proprietary JSON forces a conversion step before training. By reading and writing YOLO's normalized .txt format natively — including automatic classes.txt management and global class migration on deletion — we eliminate the most common pipeline friction point."

status: Completed
year: '2025'
platform: Web (Chrome, Edge)
license: AGPL-3.0
---

## Overview

Every computer vision engineer knows the ritual: install Python, debug PyQt5 dependencies, configure a labeling tool, then write a conversion script to turn proprietary JSON into YOLO `.txt` files. AI-assisted labeling adds another layer of pain — setting up GPU servers, managing API keys, or wrestling with CUDA versions.

SharpTensor collapses this to a single step. Open the URL, grant folder access, and start labeling. AI runs entirely in your browser via WebAssembly — YOLOv8n and RT-DETR for auto-detection, MobileSAM for interactive segmentation. The tool speaks YOLO natively: annotations land as `.txt` files on your local drive, ready for `yolo train` with zero conversion. No servers, no installs, no data ever leaves your machine.

## Key Features

- **Zero-setup AI inference**: YOLOv8n, RT-DETR, and MobileSAM run entirely in-browser via ONNX Runtime Web. Auto-label an entire directory without installing Python, configuring a GPU, or managing API keys.

- **Native YOLO file I/O**: Reads and writes YOLO-format `.txt` annotations and `classes.txt` directly to the local filesystem. No JSON intermediary, no conversion scripts — your dataset is training-ready instantly.

- **60 FPS canvas engine**: Hardware-accelerated HTML5 Canvas with smooth pan/zoom (0.1x–20x), HiDPI support, and responsive 60 FPS rendering even on 4K+ images.

- **Hotkey-driven workflow**: Draw (W), select (V), next/previous (D/A), quick class assign (1–9), delete (Del), undo/redo (Ctrl+Z/Y) — designed for high-throughput labeling sessions.

- **Interactive segmentation with MobileSAM**: Click positive and negative points to generate pixel-precise masks. An embedding cache (15 images) and neighborhood preloading (7 ahead, 7 behind) ensure instant revisit.

- **Global class migration**: Delete a class and SharpTensor re-indexes every annotation file across the entire dataset automatically — a critical workflow no other tool handles natively.

## Technical Architecture / How It Works

SharpTensor uses a dual-thread architecture. The main thread runs the UI (custom Web Components), the Canvas engine (Renderer, InteractionManager, HitTester), an Observer-pattern AppState with 50-level undo/redo, and the File System Access API bridge for local I/O. A dedicated Web Worker handles all AI inference — model loading, ONNX Runtime sessions, FP16 tensor preprocessing, and postprocessing (NMS for YOLO, Moore-Neighbor contour tracing for SAM).

Communication follows a structured `postMessage` protocol with discriminated union types. The `AIEngine` on the main thread maintains an MRU embedding cache (15 images) and a task queue, while the worker holds its own model registry. Image data flows as `ImageBitmap` objects transferred zero-copy via `OffscreenCanvas`. For file I/O, the `FileSystemManager` obtains a writable directory handle on first open, scans for supported image formats and existing `.txt` annotations, and maintains a debounced (1s) sequential write queue for auto-saving.

Batch auto-labeling runs at concurrency 4, dispatching images to the worker and collecting predictions. The `YoloHelper` handles coordinate normalization, class registry management, and the global migration engine that re-indexes all files when classes are deleted or renamed.

## Technology Stack

- **Language**: TypeScript 6 (strict mode, ES2022 target)
- **Build tool**: Vite 6
- **UI**: Vanilla TypeScript with Custom Elements (Web Components)
- **Styling**: Tailwind CSS 4 + custom CSS3 (glassmorphism, CSS custom properties)
- **AI inference**: ONNX Runtime Web 1.25 (WASM execution provider)
- **Models**: YOLOv8n, RT-DETR (detection), MobileSAM (segmentation) — FP16 ONNX
- **Canvas**: HTML5 Canvas 2D (hardware accelerated)
- **File system**: File System Access API (`showDirectoryPicker`, `FileSystemFileHandle`)
- **State management**: Custom Observer-pattern singleton (`AppState`)
- **Workers**: Web Workers (ESM, Vite-bundled)
- **Testing**: Vitest 4 (unit, V8 coverage), Playwright 1.60 (E2E, Chromium)
- **Linting/Formatting**: ESLint 10, Prettier 3, typescript-eslint
- **Deployment**: Cloudflare Workers (via Wrangler)
- **CI/CD**: GitHub Actions

## What I Learned

The hardest optimization in browser-based AI is not the model — it is managing asynchrony across threads. Coordinating model downloads, cache lookups, inference queues, and the main thread's render loop required a disciplined message protocol and careful backpressure handling. I also learned that the File System Access API has subtle gotchas: the writable handle can be silently revoked, and cross-origin isolation headers are mandatory for `SharedArrayBuffer`, which ONNX Runtime requires. If I were rebuilding today, I would explore WebGPU delegation for SAM encoding to push beyond the current 8.7s encoder time.
