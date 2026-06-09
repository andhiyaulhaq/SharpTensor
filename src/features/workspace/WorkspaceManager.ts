import { state } from '../../core/state';
import { ImageCacheEntry } from '../../core/types';
import { FileSystemManager } from '../fs/FileSystemManager';
import { CanvasEngine } from '../../engine/canvas';
import { ai } from '../../core/ai';

export interface WorkspaceManagerConfig {
  fileSystemManager: FileSystemManager;
  canvasEngine: CanvasEngine;
  onUpdateStatus: (msg: string, isError?: boolean) => void;
}

export class WorkspaceManager {
  private imageCache = new Map<number, ImageCacheEntry>();
  private fileSystemManager: FileSystemManager;
  private canvasEngine: CanvasEngine;
  private updateStatus: (msg: string, isError?: boolean) => void;

  constructor(config: WorkspaceManagerConfig) {
    this.fileSystemManager = config.fileSystemManager;
    this.canvasEngine = config.canvasEngine;
    this.updateStatus = config.onUpdateStatus;
  }

  async loadImage(index: number): Promise<void> {
    if (index < 0 || index >= state.data.images.length) return;
    const imageInfo = state.data.images[index];
    if (!imageInfo) return;

    // 1. Check Cache for Instant Render
    const cached = this.imageCache.get(index);
    if (cached) {
      const taskAnnos = state.data.currentTask === 'detection' ? cached.detAnnos : cached.segAnnos;

      state.set({
        currentImageIndex: index,
        currentImageBitmap: cached.bitmap,
        annotations: taskAnnos || [],
        loading: false,
        activeMask: null,
        promptPoints: [],
        activePromptBox: null,
      });

      this.fitImageToCanvas(cached.bitmap);
      this.canvasEngine.draw();

      // Background SAM Warmup (with cache key)
      if (state.data.currentTask === 'segmentation') {
        setTimeout(() => ai.setSAMImage(cached.bitmap, imageInfo.name), 50);
      }

      this.preloadNeighborhood(index);
      return;
    }

    // 2. Fallback to Slow Load
    try {
      state.set({ loading: true, statusMessage: `Loading ${imageInfo.name}...` });
      const file = await (imageInfo.handle as any).getFile();
      const bitmap = await createImageBitmap(file);
      const annotations = await this.fileSystemManager.loadAnnotations(imageInfo.name, bitmap);
      
      this.fitImageToCanvas(bitmap);

      // Store in Cache
      const cacheEntry: ImageCacheEntry = { bitmap };
      if (state.data.currentTask === 'detection') cacheEntry.detAnnos = annotations;
      else cacheEntry.segAnnos = annotations;

      this.imageCache.set(index, cacheEntry);
      if (this.imageCache.size > 15) {
        const oldestIndex = this.imageCache.keys().next().value;
        if (oldestIndex !== undefined) this.imageCache.delete(oldestIndex);
      }

      state.clearHistory(true);
      state.saveHistory();

      state.set({
        currentImageIndex: index,
        currentImageBitmap: bitmap,
        annotations: annotations || [],
        loading: false,
        statusMessage: `Loaded: ${imageInfo.name}`,
        activeMask: null,
        promptPoints: [],
        activePromptBox: null,
      });

      if (state.data.currentTask === 'segmentation') {
        setTimeout(() => ai.setSAMImage(bitmap, imageInfo.name), 50);
      }

      this.preloadNeighborhood(index);
    } catch (err) {
      console.error('Failed to load image:', err);
      this.updateStatus('Error loading image', true);
    }
  }

  async preloadNeighborhood(currentIndex: number): Promise<void> {
    const range = 7; // Preload 7 images before and after
    const { images } = state.data;
    console.log(
      `🔍 Explorer: Triggering neighborhood warmup for index ${currentIndex} (range: ${range})`
    );

    for (let i = 1; i <= range; i++) {
      const nextIdx = currentIndex + i;
      const prevIdx = currentIndex - i;

      if (nextIdx < images.length) this.preloadImage(nextIdx);
      if (prevIdx >= 0) this.preloadImage(prevIdx);
    }
  }

  async preloadImage(index: number): Promise<void> {
    const cached = this.imageCache.get(index);
    if (cached) {
      if (state.data.currentTask === 'segmentation') {
        const imageInfo = state.data.images[index];
        if (imageInfo) ai.setSAMImage(cached.bitmap, imageInfo.name);
      }
      return;
    }

    try {
      const imageInfo = state.data.images[index];
      if (!imageInfo) return;
      const file = await (imageInfo.handle as any).getFile();
      const bitmap = await createImageBitmap(file);
      const annotations = await this.fileSystemManager.loadAnnotations(imageInfo.name, bitmap);

      const cacheEntry: ImageCacheEntry = { bitmap };
      if (state.data.currentTask === 'detection') cacheEntry.detAnnos = annotations;
      else cacheEntry.segAnnos = annotations;

      this.imageCache.set(index, cacheEntry);

      if (this.imageCache.size > 15) {
        const oldestIndex = this.imageCache.keys().next().value;
        if (oldestIndex !== undefined) this.imageCache.delete(oldestIndex);
      }

      if (state.data.currentTask === 'segmentation') {
        console.log(`🧠 Explorer: Warming up AI for neighbor: ${imageInfo.name}`);
        ai.setSAMImage(bitmap, imageInfo.name);
      }
    } catch (err) {
      console.warn(`⚠️ Explorer: Preload failed for index ${index}:`, err);
    }
  }

  async syncTaskAnnotations(): Promise<void> {
    const { currentImageIndex, images, currentImageBitmap, currentTask } = state.data;
    if (currentImageIndex === -1 || !currentImageBitmap) return;

    const imageInfo = images[currentImageIndex];
    if (!imageInfo) return;
    const cacheEntry = this.imageCache.get(currentImageIndex);

    // 1. Instant Cache Switch
    if (cacheEntry) {
      const taskAnnos = currentTask === 'detection' ? cacheEntry.detAnnos : cacheEntry.segAnnos;
      if (taskAnnos) {
        state.set({
          annotations: taskAnnos,
          activeMask: null,
          promptPoints: [],
          activePromptBox: null,
        });

        if (currentTask === 'segmentation') {
          setTimeout(() => ai.setSAMImage(currentImageBitmap, imageInfo.name), 50);
        }
        return;
      }
    }

    // 2. Optimistic Clear for Responsiveness
    state.set({ annotations: [], activeMask: null, promptPoints: [], activePromptBox: null });
    this.updateStatus(`Syncing ${currentTask.toUpperCase()}...`);

    try {
      const annotations = await this.fileSystemManager.loadAnnotations(imageInfo.name, currentImageBitmap);

      if (cacheEntry) {
        if (currentTask === 'detection') cacheEntry.detAnnos = annotations;
        else cacheEntry.segAnnos = annotations;
      }

      state.set({ annotations: annotations || [] });
      
      if (currentTask === 'segmentation') {
        setTimeout(() => ai.setSAMImage(currentImageBitmap, imageInfo.name), 50);
      }
      
      this.updateStatus(`Ready`);
    } catch (err) {
      console.error(err);
      this.updateStatus('Failed to load task annotations', true);
    }
  }

  fitImageToCanvas(bitmap: ImageBitmap): void {
    const workspace = document.getElementById('workspace');
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();

    const scaleX = (rect.width - 40) / bitmap.width;
    const scaleY = (rect.height - 40) / bitmap.height;
    const scale = Math.min(scaleX, scaleY, 1);

    const panX = (rect.width - bitmap.width * scale) / 2;
    const panY = (rect.height - bitmap.height * scale) / 2;

    state.set({ zoom: scale, pan: { x: panX, y: panY } });
  }

  nextImage(): void {
    if (state.data.images.length === 0) return;
    const nextIdx = (state.data.currentImageIndex + 1) % state.data.images.length;
    this.loadImage(nextIdx);
  }

  prevImage(): void {
    if (state.data.images.length === 0) return;
    let prevIdx = state.data.currentImageIndex - 1;
    if (prevIdx < 0) prevIdx = state.data.images.length - 1;
    this.loadImage(prevIdx);
  }

  updateCacheForCurrentTask(annotations: any[]): void {
    const { currentImageIndex, currentTask } = state.data;
    if (currentImageIndex !== -1) {
      this.updateCacheForIndex(currentImageIndex, annotations, currentTask);
    }
  }

  updateCacheForIndex(index: number, annotations: any[], task: 'detection' | 'segmentation'): void {
    const cached = this.imageCache.get(index);
    if (cached) {
      if (task === 'detection') cached.detAnnos = annotations;
      else cached.segAnnos = annotations;
    }
  }

  clearCache(): void {
    this.imageCache.clear();
  }

  getImageCache() {
    return this.imageCache;
  }
}
