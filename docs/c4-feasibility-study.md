# Feasibility Study: Documenting SharpTensor using the C4 Model

## 1. Executive Summary

This document evaluates the feasibility and value of adopting the **C4 Model** (Context, Containers, Components, and Code) to architecturally document the **SharpTensor** codebase. 

**Recommendation:** It is **highly feasible and strongly recommended** to implement the C4 model for SharpTensor, focusing specifically on Levels 1 (System Context), Level 2 (Containers), and Level 3 (Components). Level 4 (Code) is deemed unnecessary as it provides diminishing returns and requires high maintenance.

## 2. Introduction

SharpTensor is a high-performance, local-first web application for YOLO image dataset preparation. As the project scales to include complex features like Web Workers for AI inference (MobileSAM, YOLOv8n) and local file system integrations, maintaining clear architectural boundaries becomes critical. 

The C4 model provides a hierarchical, map-like approach to software architecture, making it easier for new contributors to understand the system at various levels of abstraction.

## 3. Codebase Analysis in the Context of C4

SharpTensor's architecture is uniquely positioned as a "Local-First Web App." This introduces interesting paradigms that map well to C4:

### Level 1: System Context Diagram
*   **Feasibility:** High.
*   **Purpose:** Shows the big picture.
*   **Actors/Systems:**
    *   **User:** Computer Vision Engineer / Data Annotator.
    *   **System:** SharpTensor Web Application.
    *   **External System:** Local File System (via File System Access API).
    *   **External System:** AI Model Hosting (Cloudflare/CDN or Local Models).
*   **Value:** Easily communicates that SharpTensor is a completely client-side application with zero backend server dependency for data storage.

### Level 2: Container Diagram
*   **Feasibility:** High.
*   **Purpose:** Shows the high-level technical building blocks.
*   **Containers:**
    *   **Main Application Thread (Single-Page App):** Handles UI, Canvas rendering, state management (Vanilla JS + Vite).
    *   **AI Web Worker(s):** Background threads running ONNX Runtime Web for YOLOv8n and MobileSAM inference. prevents UI blocking.
    *   **Browser Storage Container:** (If applicable for settings/IndexedDB).
*   **Value:** Highlights the critical separation between the rendering thread and the heavy AI computation threads.

### Level 3: Component Diagram
*   **Feasibility:** Medium-High.
*   **Purpose:** Zooms into the Main Application Thread to show internal structure.
*   **Components (Hypothetical based on standard architecture):**
    *   **Canvas Engine:** Handles 60FPS panning, zooming, and bounding box rendering.
    *   **State Manager:** Manages current image, annotations, and UI state.
    *   **File Explorer Module:** Interfaces with the File System Access API.
    *   **YOLO Serializer/Deserializer:** Converts internal state to/from YOLO `.txt` format and `classes.txt`.
    *   **Worker Bridge:** Manages communication via `postMessage` to the AI Workers.
*   **Value:** Crucial for developers working on specific features. It defines the boundaries and responsibilities of the Vanilla JS modules.

### Level 4: Code (Class/Object Diagram)
*   **Feasibility:** Low Value / High Maintenance.
*   **Recommendation:** Skip. The C4 model creator (Simon Brown) often recommends skipping this level unless explicitly needed. In a dynamic language like Vanilla JS, maintaining UML class diagrams manually is anti-productive. Code-level documentation should rely on JSDoc and standard Vitest unit tests.

## 4. Implementation Strategy & Tooling

To implement the C4 model effectively without significant overhead, "Diagrams as Code" is recommended.

1.  **Tool of Choice: Mermaid.js or PlantUML.**
    *   Since SharpTensor already uses Markdown for documentation, embedding Mermaid.js diagrams directly into the `docs/` folder or `README.md` is the most frictionless approach. GitHub natively supports Mermaid.
2.  **Location:** Create an `architecture/` directory within `docs/` or `reference/` to house the `.mmd` (Mermaid) files or embed them in markdown.
3.  **Maintenance:** Integrate diagram updates into the Definition of Done (DoD) for major architectural Pull Requests.

## 5. Pros and Cons

### Advantages (Pros)
*   **Accelerated Onboarding:** Radically reduces the time it takes for new contributors to understand how the Canvas Engine interacts with the AI Workers.
*   **Clear Boundaries:** Helps prevent "spaghetti code" by visually enforcing module boundaries (e.g., ensuring the UI doesn't directly parse YOLO text files without going through the Serializer).
*   **Stakeholder Communication:** Level 1 and 2 diagrams are excellent for explaining the "Local-First" privacy benefits to non-technical users or clients.

### Disadvantages (Cons)
*   **Maintenance Overhead:** Architectural diagrams can become outdated if not treated as a first-class citizen during code reviews.
*   **Initial Setup Time:** Requires time to map out the current components and write the initial Mermaid code.

## 6. Conclusion

Documenting SharpTensor using the C4 Model (Levels 1-3) is highly feasible and will bring significant clarity to the project's architecture. Given the complexities of managing hardware-accelerated canvases alongside background AI inference workers in a browser environment, having a structured architectural map is a vital step toward long-term maintainability. 
