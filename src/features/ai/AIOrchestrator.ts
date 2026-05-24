import { state } from '../../core/state';
import { ai } from '../../core/ai';
import { BoundingBox, ClassDefinition, ImageEntry } from '../../core/types';
import { FileSystemManager } from '../fs/FileSystemManager';

export interface AIOrchestratorConfig {
  fileSystemManager: FileSystemManager;
  onUpdateStatus: (msg: string, isError?: boolean) => void;
  onDrawCanvas: () => void;
  onAdvanceTour: (step: 'step2-interact' | 'complete') => void;
  onShowModal: (params: any) => void;
  modalDom: HTMLElement;
  onRenderImageList: (images: ImageEntry[]) => void;
  onLoadImage: (idx: number) => Promise<void>;
  onUpdateCache: (idx: number, annotations: BoundingBox[]) => void;
}

export class AIOrchestrator {
  private config: AIOrchestratorConfig;

  constructor(config: AIOrchestratorConfig) {
    this.config = config;
  }

  async handleAutoLabelDataset(): Promise<void> {
    // If we have no folder handle but we have an image, we are in the mock demo workspace.
    const isDemoWorkspace = !state.data.folderHandle && state.data.images.length > 0;

    if (state.data.tourActive || isDemoWorkspace) {
      this.config.onUpdateStatus('🎯 AI Analyzing demo scene...');
      const image = state.data.images[0];
      if (!image) return;
      const file = await (image.handle as any).getFile();
      const bitmap = await createImageBitmap(file);
      const predictions = await ai.detect(bitmap);

      const { mapped, classesChanged, updatedClasses } = this.mapPredictionsToClasses(
        predictions,
        state.data.classes
      );

      if (classesChanged) {
        state.set({ classes: updatedClasses });
      }

      state.saveHistory();
      state.set({ annotations: mapped });
      this.config.onDrawCanvas();
      this.config.onUpdateStatus(`✅ Demo Ready: Found ${mapped.length} objects`);
      this.config.onAdvanceTour('step2-interact');
      return;
    }

    if (!state.data.folderHandle) {
      this.config.onUpdateStatus('❌ Open a folder first', true);
      return;
    }
    this.config.onShowModal({
      title: 'AI Batch Inference Confirmation',
      message:
        '🤖 SHARPTENSOR AI: You are initiating a batch processing task. The current model will scan every image to automatically generate bounding boxes. Continue?',
      confirmText: 'Start AI Task',
      onConfirm: () => this.startAutoLabelBatch(),
    });
  }

  private async startAutoLabelBatch(): Promise<void> {
    const modal = this.config.modalDom;
    const progressContainer = modal.querySelector('.modal-progress-container') as HTMLElement;
    const fill = modal.querySelector('.modal-progress-fill') as HTMLElement;
    const text = modal.querySelector('.modal-progress-text') as HTMLElement;
    const confirmBtn = modal.querySelector('.modal-confirm') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('.modal-cancel') as HTMLButtonElement;

    this.config.onShowModal({
      title: 'AI Batch Processing',
      message: 'Initializing AI models and scanning dataset...',
      confirmText: 'Processing...',
      cancelText: 'Stop Task',
    });

    if (progressContainer) progressContainer.classList.remove('hidden');
    confirmBtn.disabled = true;
    confirmBtn.classList.add('opacity-50');

    let cancelled = false;
    cancelBtn.onclick = () => {
      cancelled = true;
      modal.classList.add('hidden');
    };

    const images = state.data.images;
    state.set({ isAutoLabeling: true });

    let completedCount = 0;
    const totalImages = images.length;

    requestAnimationFrame(() => {
      text.textContent = `⚡ Preparing: Scanning ${totalImages} images...`;
      fill.style.width = `0%`;
    });

    let batchClasses = [...state.data.classes];

    const updateUI = (imgName: string) => {
      requestAnimationFrame(() => {
        text.textContent = `⚡ Processing: ${imgName} (${completedCount} / ${totalImages})`;
        fill.style.width = `${(completedCount / totalImages) * 100}%`;
      });
    };

    const CONCURRENCY = 4;
    for (let i = 0; i < totalImages; i += CONCURRENCY) {
      if (cancelled) break;

      const chunk = images.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (img, chunkOffset) => {
          const idx = i + chunkOffset;
          if (idx >= totalImages || cancelled) return;

          try {
            const file = await (img.handle as any).getFile();
            const bitmap = await createImageBitmap(file);
            const existingAnnotations = await this.config.fileSystemManager.loadAnnotations(img.name, bitmap);
            const predictions = await ai.detect(bitmap);

            if (predictions.length > 0) {
              const { mapped, classesChanged, updatedClasses } = this.mapPredictionsToClasses(
                predictions,
                batchClasses
              );
              batchClasses = updatedClasses;

              if (classesChanged) {
                state.set({ classes: [...batchClasses] });
                await this.config.fileSystemManager.saveClasses(batchClasses);
              }

              const merged = [...existingAnnotations, ...mapped];
              await this.config.fileSystemManager.saveAnnotations(idx, merged, bitmap, true);

              this.config.onUpdateCache(idx, merged);

              if (idx === state.data.currentImageIndex) {
                state.set({ annotations: merged });
                this.config.onDrawCanvas();
              }
              img.status = 'labeled';
            }
          } catch (err) {
            console.error(`Failed to auto-label ${img.name}:`, err);
          } finally {
            completedCount++;
            updateUI(img.name);
          }
        })
      );
    }

    modal.classList.add('hidden');
    confirmBtn.disabled = false;
    confirmBtn.classList.remove('opacity-50');
    state.set({ isAutoLabeling: false });

    this.config.onRenderImageList(state.data.images);
    if (state.data.currentImageIndex !== -1) {
      await this.config.onLoadImage(state.data.currentImageIndex);
    }
    this.config.onUpdateStatus(cancelled ? '⚠️ AI Batch Cancelled' : '✅ AI Batch Complete');
  }

  /**
   * Maps raw AI class IDs (COCO 80) to the project's local class registry.
   */
  mapPredictionsToClasses(
    predictions: BoundingBox[],
    currentClasses: ClassDefinition[]
  ): {
    mapped: BoundingBox[];
    classesChanged: boolean;
    updatedClasses: ClassDefinition[];
  } {
    let classesChanged = false;
    const updatedClasses = [...currentClasses];

    const cocoNames = [
      'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
      'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
      'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
      'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
      'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
      'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
      'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
      'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
      'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
      'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ];

    const mapped = predictions.map((pred) => {
      const globalClassId = pred.classId;
      const originalName = cocoNames[globalClassId] || `class_${globalClassId}`;
      const titleCaseName = originalName.charAt(0).toUpperCase() + originalName.slice(1);

      let localClassId = updatedClasses.find((c) => c.name.toLowerCase() === titleCaseName.toLowerCase())?.id;

      if (localClassId === undefined) {
        localClassId = updatedClasses.length > 0 ? Math.max(...updatedClasses.map((c) => c.id)) + 1 : 0;
        updatedClasses.push({
          id: localClassId,
          name: titleCaseName,
          color: this.generateColor(localClassId),
        });
        classesChanged = true;
      }

      return {
        ...pred,
        classId: localClassId,
      };
    });

    return { mapped, classesChanged, updatedClasses };
  }

  private generateColor(id: number): string {
    const colors = [
      '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA',
      '#007AFF', '#5856D6', '#FF2D55', '#AF52DE', '#FF1493',
      '#00CED1', '#32CD32', '#FF4500', '#DA70D6', '#20B2AA'
    ];
    return colors[id % colors.length] || '#FF3B30';
  }
}
