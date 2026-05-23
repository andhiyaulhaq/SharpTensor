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
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      state.set({ loading: true, statusMessage: 'Reading folder...' });

      const labelHandle = await handle.getDirectoryHandle('label', { create: true });
      const labelSegHandle = await handle.getDirectoryHandle('label-seg', { create: true });

      state.set({
        folderHandle: handle,
        labelFolderHandle: labelHandle,
        labelSegFolderHandle: labelSegHandle,
      });

      await this.loadClasses();

      const images: ImageEntry[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && /\\.(jpe?g|png|webp)$/i.test(entry.name)) {
          images.push({ name: entry.name, handle: entry, status: 'pending' });
        }
      }
      images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      state.set({
        images,
        currentImageIndex: images.length > 0 ? 0 : -1,
        loading: false,
        mode: 'select',
      });
    } catch (err) {
      console.error('Failed to open folder:', err);
      this.onStatusUpdate('Access denied or folder empty', true);
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
    const txtName = imgName.replace(/\\.[^/.]+$/, '') + '.txt';
    const isSeg = state.data.currentTask === 'segmentation';
    const folder = isSeg ? state.data.labelSegFolderHandle : state.data.labelFolderHandle;
    if (!folder) return [];

    try {
      const fileHandle = await folder.getFileHandle(txtName);
      const file = await fileHandle.getFile();
      const content = await file.text();
      return content
        .split('\\n')
        .filter((l) => l.trim())
        .map((line) => YoloHelper.fromYolo(line, bitmap.width, bitmap.height))
        .filter((b): b is BoundingBox => b !== null);
    } catch (e) {
      return [];
    }
  }

  debouncedSave(): void {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      if (state.data.currentImageIndex !== -1) {
        this.saveAnnotations(
          state.data.currentImageIndex,
          state.data.annotations,
          state.data.currentImageBitmap,
          true
        );
      }
    }, 1000);
  }

  async saveAnnotations(
    index: number,
    annotations: BoundingBox[],
    bitmap: ImageBitmap | null = state.data.currentImageBitmap,
    skipUI = false
  ): Promise<void> {
    if (!state.data.folderHandle || !bitmap) return;

    this._saveQueue = this._saveQueue.then(async () => {
      const imgInfo = state.data.images[index];
      if (!imgInfo) return;
      const txtName = imgInfo.name.replace(/\\.[^/.]+$/, '') + '.txt';
      const isSeg = state.data.currentTask === 'segmentation';
      const folder = isSeg ? state.data.labelSegFolderHandle : state.data.labelFolderHandle;
      if (!folder) return;

      try {
        const content = annotations
          .map((box) =>
            isSeg
              ? YoloHelper.toYoloSeg(box, bitmap.width, bitmap.height)
              : YoloHelper.toYolo(box, bitmap.width, bitmap.height)
          )
          .join('\\n');

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
        const content = classes.map((c) => c.name).join('\\n');
        await writable.write(content);
        await writable.close();
      } catch (e) {
        console.error('Failed to save classes:', e);
      }
    }
  }

  async migrateDatasetOnDelete(deletedId: number): Promise<void> {
    const { labelFolderHandle, images } = state.data;
    if (!labelFolderHandle) return;

    for (const imgInfo of images) {
      const txtName = imgInfo.name.replace(/\\.[^/.]+$/, '') + '.txt';
      try {
        const fileHandle = await labelFolderHandle.getFileHandle(txtName);
        const file = await fileHandle.getFile();
        const content = await file.text();
        const newLines = content
          .split('\\n')
          .map((line) => {
            const parts = line.split(' ');
            const classId = parseInt(parts[0] || '0');
            if (classId === deletedId) return null;
            if (classId > deletedId) parts[0] = (classId - 1).toString();
            return parts.join(' ');
          })
          .filter((l): l is string => l !== null);
        const writable = await fileHandle.createWritable();
        await writable.write(newLines.join('\\n'));
        await writable.close();
      } catch (e) {}
    }
  }
}
