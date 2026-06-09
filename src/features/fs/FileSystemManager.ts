import { state } from '../../core/state';
import { YoloHelper } from '../../utils/yolo';
import { BoundingBox, ClassDefinition, ImageEntry } from '../../core/types';

export interface FileSystemManagerConfig {
  onStatusUpdate: (msg: string, isError?: boolean) => void;
}

export class FileSystemManager {
  private _saveTimer: any = null;
  private _saveQueue: Promise<void> = Promise.resolve();
  private onStatusUpdate: (msg: string, isError?: boolean) => void;

  constructor(config: FileSystemManagerConfig) {
    this.onStatusUpdate = config.onStatusUpdate;
  }

  async handleOpenFolder(): Promise<void> {
    console.log('[FS] handleOpenFolder initiated');
    try {
      console.log('[FS] Requesting directory picker...');
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      console.log('[FS] Directory picker succeeded. Handle:', handle.name);

      state.set({ loading: true, statusMessage: 'Reading folder...' });

      console.log('[FS] Attempting to get/create "label" directory...');
      const labelDir = await handle.getDirectoryHandle('label', { create: true });
      const labelHandle = await labelDir.getDirectoryHandle('yolo', { create: true });
      console.log('[FS] "label/yolo" directory ready');

      console.log('[FS] Attempting to get/create "label-seg" directory...');
      const labelSegDir = await handle.getDirectoryHandle('label-seg', { create: true });
      const labelSegHandle = await labelSegDir.getDirectoryHandle('yolo', { create: true });
      console.log('[FS] "label-seg/yolo" directory ready');

      state.set({
        folderHandle: handle,
        labelFolderHandle: labelHandle,
        labelSegFolderHandle: labelSegHandle,
      });

      console.log('[FS] State updated with handles, loading classes...');
      await this.loadClasses();
      console.log('[FS] Classes loaded. Scanning for images...');

      const images: ImageEntry[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && /\.(jpe?g|png|webp)$/i.test(entry.name)) {
          images.push({ name: entry.name, handle: entry, status: 'pending' });
        }
      }
      console.log(`[FS] Scan complete. Found ${images.length} images directly in root.`);

      images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      state.set({
        images,
        currentImageIndex: images.length > 0 ? 0 : -1,
        loading: false,
        mode: 'select',
      });
      console.log('[FS] State updated with images array. End of handleOpenFolder.');

      // Perform initial sync of image statuses
      await this.syncImageStatuses();
    } catch (err: any) {
      console.error('[FS ERROR] Failed to open folder:', err);
      console.error('[FS ERROR] Error Name:', err.name);
      console.error('[FS ERROR] Error Message:', err.message);
      this.onStatusUpdate('Access denied or folder empty', true);
    }
  }

  async syncImageStatuses(): Promise<void> {
    const { labelFolderHandle, labelSegFolderHandle, images, currentTask } = state.data;
    const targetFolder = currentTask === 'segmentation' ? labelSegFolderHandle : labelFolderHandle;
    if (!targetFolder || images.length === 0) return;

    const newImages = [...images];
    let changed = false;

    console.log(
      `[FS] syncImageStatuses started. Images count: ${images.length}, currentTask: ${currentTask}`
    );

    const existingFiles = new Set<string>();
    try {
      for await (const entry of (targetFolder as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
          existingFiles.add(entry.name);
        }
      }
      console.log(
        `[FS] syncImageStatuses found ${existingFiles.size} .txt files using entries()`,
        Array.from(existingFiles)
      );
    } catch (e) {
      console.warn('[FS] Failed to read target folder with entries()', e);
    }

    for (const img of newImages) {
      const txtName1 = img.name.replace(/\.[^/.]+$/, '') + '.txt';
      const txtName2 = img.name + '.txt';
      const shouldBeLabeled = existingFiles.has(txtName1) || existingFiles.has(txtName2);
      const expectedStatus = shouldBeLabeled ? 'labeled' : 'pending';

      if (img.status !== expectedStatus) {
        img.status = expectedStatus;
        changed = true;
      }
    }

    console.log(`[FS] syncImageStatuses complete. Changed state? ${changed}`);

    if (changed) {
      state.set({ images: newImages });
    }
  }

  async loadClasses(): Promise<void> {
    const { folderHandle, labelFolderHandle, labelSegFolderHandle, currentTask } = state.data;
    if (!folderHandle) return;

    const targetFolder = currentTask === 'segmentation' ? labelSegFolderHandle : labelFolderHandle;
    if (!targetFolder) return;

    try {
      let fileHandle;
      try {
        fileHandle = await targetFolder.getFileHandle('classes.txt');
      } catch (e) {
        fileHandle = await folderHandle.getFileHandle('classes.txt');
      }

      const file = await fileHandle.getFile();
      const content = await file.text();
      const classes = YoloHelper.parseClasses(content);
      if (classes.length > 0) {
        state.set({ classes, selectedClassId: classes[0]!.id });
      } else {
        state.set({ classes: [], selectedClassId: null });
      }
    } catch (e) {
      state.set({ classes: [], selectedClassId: null });
    }
  }

  async loadAnnotations(imgName: string, bitmap: ImageBitmap): Promise<BoundingBox[]> {
    const txtName = imgName.replace(/\.[^/.]+$/, '') + '.txt';
    const isSeg = state.data.currentTask === 'segmentation';
    const folder = isSeg ? state.data.labelSegFolderHandle : state.data.labelFolderHandle;
    if (!folder) return [];

    try {
      let fileHandle;
      try {
        fileHandle = await folder.getFileHandle(txtName);
      } catch (e) {
        fileHandle = await folder.getFileHandle(imgName + '.txt');
      }
      const file = await fileHandle.getFile();
      const content = await file.text();
      return content
        .split(/\r?\n|\r/)
        .filter((l) => l.trim())
        .map((line) => YoloHelper.fromYolo(line, bitmap.width, bitmap.height))
        .filter((b): b is BoundingBox => b !== null);
    } catch (e) {
      return [];
    }
  }

  private _pendingSaveData: { 
    index: number; 
    annotations: BoundingBox[]; 
    bitmap: ImageBitmap | null;
    task: 'detection' | 'segmentation';
  } | null = null;

  debouncedSave(): void {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    
    // Capture the state at the exact moment the save was requested
    this._pendingSaveData = {
      index: state.data.currentImageIndex,
      annotations: [...state.data.annotations],
      bitmap: state.data.currentImageBitmap,
      task: state.data.currentTask,
    };
    
    this._saveTimer = setTimeout(() => {
      this.flushPendingSave();
    }, 1000);
  }

  flushPendingSave(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (this._pendingSaveData) {
      const { index, annotations, bitmap, task } = this._pendingSaveData;
      if (index !== -1) {
        this.saveAnnotations(index, annotations, bitmap, true, task);
      }
      this._pendingSaveData = null;
    }
  }

  clearPendingSaves(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._pendingSaveData = null;
  }

  async waitForSaves(): Promise<void> {
    await this._saveQueue;
  }

  async saveAnnotations(
    index: number,
    annotations: BoundingBox[],
    bitmap: ImageBitmap | null = state.data.currentImageBitmap,
    skipUI = false,
    task: 'detection' | 'segmentation' = state.data.currentTask
  ): Promise<void> {
    if (!state.data.folderHandle || !bitmap) return;

    this._saveQueue = this._saveQueue.then(async () => {
      const imgInfo = state.data.images[index];
      if (!imgInfo) return;
      const txtName = imgInfo.name.replace(/\.[^/.]+$/, '') + '.txt';
      const isSeg = task === 'segmentation';
      const folder = isSeg ? state.data.labelSegFolderHandle : state.data.labelFolderHandle;
      if (!folder) return;

      try {
        if (annotations.length === 0) {
          try {
            await folder.removeEntry(txtName);
          } catch (e) {
            // Ignore if file already doesn't exist
          }
          if (!skipUI) this.onStatusUpdate(`Cleared ${isSeg ? 'Seg' : 'Det'}: ${txtName}`);
          return;
        }

        const content = annotations
          .map((box) =>
            isSeg
              ? YoloHelper.toYoloSeg(box, bitmap.width, bitmap.height)
              : YoloHelper.toYolo(box, bitmap.width, bitmap.height)
          )
          .join('\n');

        const fileHandle = await folder.getFileHandle(txtName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        if (!skipUI) this.onStatusUpdate(`Saved ${isSeg ? 'Seg' : 'Det'}: ${txtName}`);
      } catch (err) {
        console.error('Failed to save:', err);
      }
    });

    return this._saveQueue;
  }

  async saveClasses(classesOverride: ClassDefinition[] | null = null): Promise<void> {
    const {
      labelFolderHandle,
      labelSegFolderHandle,
      currentTask,
      classes: stateClasses,
    } = state.data;
    const classes = classesOverride || stateClasses;
    const targetFolder = currentTask === 'segmentation' ? labelSegFolderHandle : labelFolderHandle;

    if (targetFolder && classes && classes.length > 0) {
      try {
        const fileHandle = await targetFolder.getFileHandle('classes.txt', { create: true });
        const writable = await fileHandle.createWritable();
        const content = classes.map((c) => c.name).join('\n');
        await writable.write(content);
        await writable.close();
      } catch (e) {
        console.error('Failed to save classes:', e);
      }
    }
  }

  async migrateDatasetOnDelete(deletedId: number): Promise<void> {
    const { labelFolderHandle, labelSegFolderHandle, currentTask, images } = state.data;
    const targetFolder = currentTask === 'segmentation' ? labelSegFolderHandle : labelFolderHandle;
    if (!targetFolder) return;

    for (const imgInfo of images) {
      const txtName = imgInfo.name.replace(/\.[^/.]+$/, '') + '.txt';
      try {
        const fileHandle = await targetFolder.getFileHandle(txtName);
        const file = await fileHandle.getFile();
        const content = await file.text();
        const newLines = content
          .split(/\r?\n|\r/)
          .filter((line) => line.trim().length > 0)
          .map((line) => {
            const parts = line.split(' ');
            const classId = parseInt(parts[0] || '0');
            if (classId === deletedId) return null;
            if (classId > deletedId) parts[0] = (classId - 1).toString();
            return parts.join(' ');
          })
          .filter((l): l is string => l !== null);
          
        if (newLines.length === 0) {
          await targetFolder.removeEntry(txtName);
        } else {
          const writable = await fileHandle.createWritable();
          await writable.write(newLines.join('\n'));
          await writable.close();
        }
      } catch (e) {}
    }
  }
}
