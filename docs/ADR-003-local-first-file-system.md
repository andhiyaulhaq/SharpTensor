# ADR 003: Local-First File System Architecture

## Status
**Accepted**

## Context
Standard web applications operate on a client-server architecture. Users upload images to a remote database, annotate them via the web UI, and export the resulting data back. 

However, computer vision datasets are often massive (gigabytes of images) and highly sensitive (proprietary company data or personal information). Forcing users to upload these datasets introduces severe latency bottlenecks, bandwidth costs, and privacy/compliance risks.

SharpTensor's core value proposition is speed and privacy. We need a way to allow a web-based UI to read and write directly to a user's local hard drive without requiring them to install a desktop application (like an Electron app).

## Decision
We adopted a pure **Local-First Architecture** utilizing the experimental HTML5 **File System Access API** (`window.showDirectoryPicker`).

1. **Direct Disk Access:** When a user opens a folder, the browser requests native file system permissions. Once granted, SharpTensor maintains persistent file handles to the local directory.
2. **No Backend Database:** There is no SQLite, IndexedDB, or cloud database acting as the source of truth for annotation data. The user's actual `.txt` files on their hard drive *are* the database.
3. **Debounced Auto-Save:** To ensure data integrity without annoying the user with "Save" buttons, every structural mutation to the Zustand global state (e.g., drawing a box, deleting a polygon node) triggers a 1-second `debouncedSave()`. When the timer pops, the `FileSystemManager` silently overwrites the corresponding `.txt` file on the disk using a `FileSystemWritableFileStream`.
4. **Cache Synchronization:** Because reading image bitmaps from the disk for every frame is expensive, the `WorkspaceManager` maintains a sliding window cache (preloading N+1 and N-1 images) into RAM, mapping them directly from the local file handles.

## Consequences

### Positive
- **Zero Latency:** Images load instantaneously since there is no network transit time.
- **Absolute Privacy:** User data literally never leaves their machine.
- **Zero Infrastructure Costs:** We don't have to pay for S3 buckets, databases, or backend servers to host user datasets.
- **Seamless Workflow:** Users can edit the `.txt` annotation files in VS Code or Notepad externally, and SharpTensor will reflect the changes upon reloading the directory.

### Negative / Risks
- **Browser Compatibility:** The File System Access API is currently a Chromium-only feature (Chrome, Edge, Brave). Firefox and Safari users cannot use the core functionality of the app natively.
- **Permission Fatigue:** The browser requires the user to explicitly grant read/write permission to the directory on every hard refresh, which can be slightly annoying.
- **Concurrency Risks:** If another application aggressively modifies the `.txt` files while SharpTensor is running and auto-saving, there is a theoretical risk of file corruption or race conditions.
