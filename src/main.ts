import { state } from './core/state';
import { CanvasEngine } from './engine/canvas';
import { YoloHelper } from './utils/yolo';
import { ai } from './core/ai';
import { ContourTracer } from './core/sam_utils';
import './components';
import { TourManager } from './features/tour/TourManager';
import { ImageListManager } from './features/ui/ImageListManager';
import { ClassListManager } from './features/ui/ClassListManager';
import { FileSystemManager } from './features/fs/FileSystemManager';
import { AIOrchestrator } from './features/ai/AIOrchestrator';
import { UIManager } from './features/ui/UIManager';
import { KeyboardManager } from './features/ui/KeyboardManager';
import { WorkspaceManager } from './features/workspace/WorkspaceManager';
import './components/index';
import { BoundingBox, ClassDefinition, ImageEntry, ImageCacheEntry } from './core/types';

class App {
  private canvasEngine!: CanvasEngine;
  private tourManager!: TourManager;
  private imageListManager!: ImageListManager;
  private classListManager!: ClassListManager;
  private fileSystemManager!: FileSystemManager;
  private aiOrchestrator!: AIOrchestrator;
  private uiManager!: UIManager;
  private keyboardManager!: KeyboardManager;
  private workspaceManager!: WorkspaceManager;

  private _logInit = false;

  constructor() {
    this.initGlobalErrorHandling();
    this.initClickLogger();
    this.bootstrap();
  }

  async bootstrap() {
    this.canvasEngine = new CanvasEngine('main-canvas');

    this.fileSystemManager = new FileSystemManager({
      onStatusUpdate: (msg, isError) => this.uiManager.updateStatus(msg, isError)
    });

    this.uiManager = new UIManager({
      onOpenFolder: () => this.fileSystemManager.handleOpenFolder(),
      onAddClass: () => this.handleAddClass(),
      onLoadCustomModel: () => this.handleLoadCustomModel(),
      onAutoLabel: () => this.aiOrchestrator.handleAutoLabelDataset(),
      onClearAllAnnotations: () => this.handleClearAllAnnotations(),
      onNextImage: () => this.workspaceManager.nextImage(),
      onPrevImage: () => this.workspaceManager.prevImage(),
      onPromptForFirstClass: (e) => this.promptForFirstClass(e)
    });

    this.workspaceManager = new WorkspaceManager({
      fileSystemManager: this.fileSystemManager,
      canvasEngine: this.canvasEngine,
      onUpdateStatus: (msg, isError) => this.uiManager.updateStatus(msg, isError)
    });

    this.keyboardManager = new KeyboardManager({
      onUpdateStatus: (msg) => this.uiManager.updateStatus(msg),
      onNextImage: () => this.workspaceManager.nextImage(),
      onPrevImage: () => this.workspaceManager.prevImage(),
      onConfirmMagicMask: () => this.confirmMagicMask(),
      onResetMagicInteraction: () => this.resetMagicInteraction(),
      onDeleteSelectedBox: () => this.deleteSelectedBox(),
      onAssignClass: (idx) => this.classListManager.assignClassToSelected(idx)
    });

    this.imageListManager = new ImageListManager(this.uiManager.dom.imageList);
    
    this.classListManager = new ClassListManager({
      container: this.uiManager.dom.classList,
      onSaveClasses: (c) => state.set({ classes: c }),
      onDeleteClass: (id) => this.handleDeleteClass(id),
    });

    this.tourManager = new TourManager({
      dom: {
        btnAutoLabelAll: this.uiManager.dom.btnAutoLabelAll,
        btnDraw: this.uiManager.dom.btnDraw,
        btnSelect: this.uiManager.dom.btnSelect
      },
      onStatusUpdate: (msg) => this.uiManager.updateStatus(msg)
    });

    this.aiOrchestrator = new AIOrchestrator({
      fileSystemManager: this.fileSystemManager,
      onUpdateStatus: (msg, isError) => this.uiManager.updateStatus(msg, isError),
      onDrawCanvas: () => this.canvasEngine.draw(),
      onAdvanceTour: (step) => this.tourManager.advanceTour(step),
      onShowModal: (params) => this.uiManager.showModal(params),
      modalDom: this.uiManager.dom.modal,
      onRenderImageList: (images) => this.imageListManager.render(images),
      onLoadImage: (idx) => this.workspaceManager.loadImage(idx)
    });

    this.initStateListeners();

    ai.loadModels();

    const welcomeEl = document.getElementById('welcome-modal');
    if (welcomeEl) {
      welcomeEl.addEventListener('action', (e: Event) => {
        const action = (e as CustomEvent).detail;
        if (action === 'open') this.fileSystemManager.handleOpenFolder();
        else if (action === 'demo') this.handleTryDemo();
        else if (action === 'github') window.open('https://github.com/andhiyaulhaq/SharpTensor', '_blank');
      });
    }

    console.log('🚀 SharpTensor Initialized (YOLOv8 + MobileSAM)');
  }

  initGlobalErrorHandling(): void {
    window.onerror = (msg, url, line) => {
      this.uiManager?.updateStatus(`❌ Error: ${msg} (Line: ${line})`, true);
      return false;
    };
    window.onunhandledrejection = (event) => {
      this.uiManager?.updateStatus(`❌ Async Error: ${event.reason}`, true);
    };
  }

  initClickLogger(): void {
    window.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target) return;
        const logEntry = {
          timestamp: new Date().toISOString(),
          element: target.tagName,
          id: target.id || 'no-id',
          classes: Array.from(target.classList).join(' '),
          mode: state.data.mode,
          currentImage: state.data.images[state.data.currentImageIndex]?.name || 'none',
        };
        console.log('🖱️ Click Log:', logEntry);
      },
      true
    );
  }

  deleteSelectedBox(): void {
    const { selectedBoxId, annotations } = state.data;
    if (selectedBoxId === null) return;
    state.saveHistory();
    state.set({
      annotations: annotations.filter((b) => b.id !== selectedBoxId),
      selectedBoxId: null,
    });
  }

  initStateListeners(): void {
    state.subscribe((data, oldData) => {
      if (data.mode !== oldData.mode) {
        if (data.tourStep === 'step2-interact') {
          this.tourManager.advanceTour('complete');
        }

        this.uiManager.dom.workspace.className =
          data.mode === 'draw' || data.mode === 'magic'
            ? 'flex-1 bg-[#0a0b0e] relative overflow-hidden flex items-center justify-center cursor-crosshair'
            : 'flex-1 bg-[#0a0b0e] relative overflow-hidden flex items-center justify-center cursor-default';

        const isDrawOrMagic = data.mode === 'draw' || data.mode === 'magic';
        this.uiManager.dom.btnDraw.classList.toggle('active', isDrawOrMagic);
        this.uiManager.dom.btnSelect.classList.toggle('active', data.mode === 'select');
      }

      if (data.images !== oldData.images || data.currentImageIndex !== oldData.currentImageIndex) {
        const datasetChanged =
          data.folderHandle !== oldData.folderHandle ||
          data.images.length !== oldData.images.length ||
          (data.images.length > 0 && oldData.images.length > 0 && data.images[0]?.name !== oldData.images[0]?.name);

        if (datasetChanged) {
          this.workspaceManager.clearCache();
        }

        this.uiManager.dom.imageCounter.textContent = `${data.images.length > 0 ? data.currentImageIndex + 1 : 0} / ${data.images.length}`;
        this.uiManager.dom.fileCountBadge.textContent = `${data.images.length} items`;
        this.imageListManager.render(data.images);

        if (data.currentImageIndex !== oldData.currentImageIndex || datasetChanged) {
          if (data.currentImageIndex !== -1) {
            this.workspaceManager.loadImage(data.currentImageIndex);
          } else {
            state.set({ annotations: [], currentImageBitmap: null });
          }
        }
      }

      if (data.currentTask !== oldData.currentTask) {
        this.uiManager.updateTaskUI(data.currentTask);
        this.fileSystemManager.loadClasses();
        this.workspaceManager.syncTaskAnnotations();
      }

      if (
        data.classes !== oldData.classes || 
        data.selectedClassId !== oldData.selectedClassId ||
        data.annotations !== oldData.annotations
      ) {
        this.classListManager.render(data.classes, data.selectedClassId, data.annotations);
      }

      if (data.annotations !== oldData.annotations) {
        if (this.canvasEngine) this.canvasEngine.draw();
        this.workspaceManager.updateCacheForCurrentTask(data.annotations);
      }

      if (data.annotations !== oldData.annotations && !data.isAutoLabeling) {
        const newImages = [...data.images];
        const currentImg = newImages[data.currentImageIndex];
        if (currentImg) {
          const hasAnnos = data.annotations.length > 0;
          if (currentImg.status !== (hasAnnos ? 'labeled' : 'pending')) {
            currentImg.status = hasAnnos ? 'labeled' : 'pending';
            state.set({ images: newImages });
            this.imageListManager.render(newImages);
          }
        }
        this.fileSystemManager.debouncedSave();
      } else if (data.selectedBoxId !== oldData.selectedBoxId) {
        if (data.mode === 'magic' && data.selectedBoxId !== null) {
          const box = data.annotations.find((b) => b.id === data.selectedBoxId);
          if (box && !box.polygon) {
            this.canvasEngine.handleMagicBox(box.x, box.y, box.x + box.width, box.y + box.height);
          }
        } else if (data.selectedBoxId === null) {
          this.resetMagicInteraction();
        }
      }

      if (data.loading !== oldData.loading) {
        document.getElementById('loading-overlay')?.classList.toggle('hidden', !data.loading);
      }

      const isFolderLoaded = !!data.folderHandle || data.images.length > 0;
      this.uiManager.dom.btnSelect.disabled = !isFolderLoaded;
      this.uiManager.dom.btnDraw.disabled = !isFolderLoaded;
      this.uiManager.dom.btnPrev.disabled = !isFolderLoaded;
      this.uiManager.dom.btnNext.disabled = !isFolderLoaded;
      this.uiManager.dom.btnExport.disabled = !isFolderLoaded;
      this.uiManager.dom.btnAddClass.disabled = !isFolderLoaded;
      this.uiManager.dom.btnLoadModel.disabled = false;
      this.uiManager.dom.btnClearAll.disabled = !isFolderLoaded;
      this.uiManager.dom.btnTaskDet.disabled = !isFolderLoaded;
      this.uiManager.dom.btnTaskSeg.disabled = !isFolderLoaded;

      this.uiManager.dom.btnAutoLabelAll.disabled = data.modelStatus !== 'ready' || !isFolderLoaded;

      if (this.uiManager.dom.modelStatusBadge) {
        const badge = this.uiManager.dom.modelStatusBadge;
        badge.className = 'px-2 py-0.5 rounded-full text-[0.7rem] border transition-all';

        let modelName = 'Idle';
        if (data.modelStatus === 'loading') modelName = 'Loading...';
        else if (data.modelStatus === 'processing') modelName = 'Thinking...';
        else if (data.modelStatus === 'error') modelName = 'Error';
        else if (data.modelStatus === 'ready') {
          const isCustom = data.aiModel?.name?.startsWith('Custom:');
          if (isCustom) {
            modelName = data.aiModel!.name;
          } else {
            modelName = data.currentTask === 'detection' ? 'RT-DETR' : 'RT-DETR + MobileSAM';
          }
        }

        badge.textContent = modelName;

        if (data.modelStatus === 'idle') {
          badge.classList.add('bg-gray-500/20', 'text-gray-400', 'border-gray-500/30');
        } else if (data.modelStatus === 'loading') {
          badge.classList.add(
            'bg-yellow-500/20',
            'text-yellow-500',
            'border-yellow-500/30',
            'animate-pulse'
          );
        } else if (data.modelStatus === 'processing') {
          badge.classList.add(
            'bg-blue-500/20',
            'text-blue-400',
            'border-blue-500/30',
            'animate-pulse'
          );
        } else if (data.modelStatus === 'ready') {
          badge.classList.add('bg-green-500/20', 'text-green-500', 'border-green-500/30');
        } else if (data.modelStatus === 'error') {
          badge.classList.add('bg-red-500/20', 'text-red-500', 'border-red-500/30');
        }
      }

      this.initLogListener();
    });

    const initialMode = state.data.mode;
    const isDrawOrMagic = initialMode === 'draw' || initialMode === 'magic';
    this.uiManager.dom.btnDraw.classList.toggle('active', isDrawOrMagic);
    this.uiManager.dom.btnSelect.classList.toggle('active', initialMode === 'select');
  }

  initLogListener(): void {
    if (this._logInit) return;
    this._logInit = true;

    const logContainer = document.getElementById('ai-logs');
    if (!logContainer) return;

    window.addEventListener('ai-log', (e: Event) => {
      const customEvent = e as CustomEvent<{
        message: string;
        type: 'info' | 'error';
        time: string;
      }>;
      const { message, type, time } = customEvent.detail;

      const placeholder = logContainer.querySelector('.italic');
      if (placeholder) placeholder.remove();

      const logEntry = document.createElement('div');
      logEntry.className = `log-entry flex gap-2 leading-tight py-0.5 border-b border-white/5 last:border-0`;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'text-white/30 shrink-0 font-mono';
      timeSpan.textContent = time;

      const msgSpan = document.createElement('span');
      msgSpan.className = type === 'error' ? 'text-red-400' : 'text-(--text-primary)';
      msgSpan.textContent = message;

      logEntry.appendChild(timeSpan);
      logEntry.appendChild(msgSpan);
      logContainer.appendChild(logEntry);

      logContainer.scrollTop = logContainer.scrollHeight;

      while (logContainer.children.length > 50) {
        const first = logContainer.firstChild;
        if (first) logContainer.removeChild(first);
      }
    });
  }

  async handleTryDemo(): Promise<void> {
    try {
      this.uiManager.updateStatus('✨ Loading demo scene...');
      const response = await fetch('/sample.jpg');
      const blob = await response.blob();
      const file = new File([blob], 'sample_street.jpg', { type: 'image/jpeg' });

      const mockImages: ImageEntry[] = [
        {
          name: file.name,
          handle: { getFile: async () => file } as any,
          status: 'pending',
        },
      ];

      state.set({
        images: mockImages,
        currentImageIndex: 0,
        mode: 'select',
        loading: false,
        classes: [
          { id: 0, name: 'Person', color: '#ff0000' },
          { id: 2, name: 'Car', color: '#00ff00' },
        ],
      });

      await this.workspaceManager.loadImage(0);
      this.imageListManager.render(mockImages);

      const welcomeEl = document.getElementById('welcome-modal');
      if (welcomeEl) welcomeEl.remove();

      document.getElementById('app')!.style.visibility = 'visible';
      document.getElementById('app')!.style.opacity = '1';

      this.tourManager.startTour();
    } catch (err) {
      console.error(err);
      state.set({ loading: false });
      this.uiManager.updateStatus('❌ Demo failed to load', true);
    }
  }

  handleAddClass(): void {
    const name = prompt('Enter new class name:');
    if (!name) return;
    const { classes } = state.data;
    const exists = classes.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert('Class already exists!');
      return;
    }
    const newId = classes.length > 0 ? Math.max(...classes.map((c) => c.id)) + 1 : 0;
    const newClass: ClassDefinition = { id: newId, name, color: YoloHelper.generateColor(newId) };
    const newClasses = [...classes, newClass];
    state.set({ classes: newClasses, selectedClassId: newId });
    this.fileSystemManager.saveClasses(newClasses);
  }

  promptForFirstClass(e: CustomEvent<{ boxId?: number }>): void {
    const { boxId } = e.detail;
    this.uiManager.showModal({
      title: 'Define First Class',
      message: 'You just drew a box! What is the class name for this object? (e.g. "car", "defect")',
      inputPlaceholder: 'Class name...',
      confirmText: 'Create Class',
      cancelText: 'Cancel Box',
      onConfirm: (val) => {
        const name = val.trim();
        if (!name) {
          if (boxId !== undefined) {
            state.set({ annotations: state.data.annotations.filter((b) => b.id !== boxId) });
          }
          return;
        }
        const newClass: ClassDefinition = { id: 0, name, color: YoloHelper.generateColor(0) };
        state.set({ classes: [newClass], selectedClassId: 0 });
        this.fileSystemManager.saveClasses([newClass]);

        if (boxId !== undefined) {
          const newAnnos = state.data.annotations.map((b) =>
            b.id === boxId ? { ...b, classId: 0 } : b
          );
          state.set({ annotations: newAnnos });
          this.fileSystemManager.debouncedSave();
        }
      },
      onCancel: () => {
        if (boxId !== undefined) {
          state.set({ annotations: state.data.annotations.filter((b) => b.id !== boxId) });
        }
      },
    });
  }

  async handleClearAllAnnotations(): Promise<void> {
    this.uiManager.showModal({
      title: '⚠️ NUCLEAR OPTION: Purge Dataset',
      message: '🛑 CRITICAL: You are about to initiate a final purge of the current dataset. This will delete all annotation files. You can optionally reset your class definitions as well.',
      confirmText: 'Execute Purge',
      cancelText: 'Abort',
      checkboxLabel: 'Also reset class definitions (classes.txt)',
      onConfirm: async (val, clearClasses) => {
        try {
          state.saveHistory();
          state.set({ loading: true, statusMessage: '🧹 Purging data...' });
          const { labelFolderHandle, labelSegFolderHandle, images, currentTask } = state.data;

          const targetFolder = currentTask === 'segmentation' ? labelSegFolderHandle : labelFolderHandle;
          if (!targetFolder) return;

          for (const img of images) {
            const txtName = img.name.replace(/\.[^/.]+$/, '') + '.txt';
            try {
              await targetFolder.removeEntry(txtName);
            } catch (e) { }
            img.status = 'pending';
          }

          this.workspaceManager.clearCache();

          const resetState: any = {
            annotations: [],
            selectedBoxId: null,
            loading: false,
          };

          if (clearClasses) {
            resetState.classes = [];
            resetState.selectedClassId = null;
            try {
              const classesFile = await targetFolder.getFileHandle('classes.txt', { create: true });
              const writable = await classesFile.createWritable();
              await writable.write('');
              await writable.close();
            } catch (e) { }
          }

          state.set(resetState);

          this.imageListManager.render(images);
          if (this.canvasEngine) this.canvasEngine.draw();
          this.uiManager.updateStatus('✅ All annotations cleared');
        } catch (err) {
          console.error('Failed to clear annotations:', err);
          state.set({ loading: false });
          this.uiManager.updateStatus('❌ Error clearing annotations', true);
        }
      },
    });
  }

  handleLoadCustomModel(): void {
    const byomPanel = document.getElementById('byom-panel') as any;
    if (byomPanel && typeof byomPanel.open === 'function') {
      byomPanel.open();
    }
  }

  resetMagicInteraction(): void {
    state.set({ promptPoints: [], activeMask: null, activePromptBox: null });
    this.canvasEngine.draw();
  }

  async confirmMagicMask(): Promise<void> {
    const { activeMask, selectedClassId, currentTask, currentImageBitmap } = state.data;
    if (!activeMask || !currentImageBitmap) return;

    const isSegTask = currentTask === 'segmentation';
    let polygon: [number, number][] | null = null;
    let x1: number, y1: number, width: number, height: number;

    if (isSegTask) {
      polygon = ContourTracer.trace(
        activeMask,
        currentImageBitmap.width,
        currentImageBitmap.height
      );
      if (!polygon || polygon.length < 3) {
        this.uiManager.updateStatus('❌ Segment too small', true);
        return;
      }
      const xs = polygon.map((p) => p[0]);
      const ys = polygon.map((p) => p[1]);
      x1 = Math.min(...xs);
      y1 = Math.min(...ys);
      width = Math.max(...xs) - x1;
      height = Math.max(...ys) - y1;
    } else {
      const bounds = this.getMaskBounds(activeMask, currentImageBitmap.width);
      if (!bounds) return;
      ({ x: x1, y: y1, width, height } = bounds);
    }

    const newAnnotation: BoundingBox = {
      id: Date.now(),
      classId: selectedClassId !== null ? selectedClassId : 0,
      x: x1,
      y: y1,
      width: width,
      height: height,
      polygon: polygon || undefined,
      score: 1.0,
    };

    state.saveHistory();
    const newAnnos = [...state.data.annotations, newAnnotation];
    state.set({
      annotations: newAnnos,
      activeMask: null,
      promptPoints: [],
      activePromptBox: null,
    });

    this.uiManager.updateStatus(`✅ ${isSegTask ? 'Polygon' : 'Box'} confirmed`);
  }

  getMaskBounds(
    mask: number[] | Uint8Array,
    imgWidth: number
  ): { x: number; y: number; width: number; height: number } | null {
    let x1 = Infinity,
      y1 = Infinity,
      x2 = -Infinity,
      y2 = -Infinity;
    let found = false;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const x = i % imgWidth;
        const y = Math.floor(i / imgWidth);
        x1 = Math.min(x1, x);
        y1 = Math.min(y1, y);
        x2 = Math.max(x2, x);
        y2 = Math.max(y2, y);
        found = true;
      }
    }
    return found ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
  }

  async handleDeleteClass(id: number): Promise<void> {
    const cls = state.data.classes.find((c) => c.id === id);
    if (!cls) return;
    this.uiManager.showModal({
      title: 'Delete Class Definition',
      message: `🛑 DATA INTEGRITY ALERT: Deleting the "${cls.name}" class will permanently remove all associated bounding boxes across your entire dataset. This operation also triggers a class ID re-index. Are you certain?`,
      confirmText: 'Delete & Re-index',
      cancelText: 'Keep Class',
      onConfirm: () => this.performDeleteClassMigration(id, cls.name),
    });
  }

  async performDeleteClassMigration(id: number, name: string): Promise<void> {
    state.set({ loading: true, statusMessage: '🔄 Migrating dataset...' });
    try {
      const newAnnotations = state.data.annotations.filter((box) => box.classId !== id);
      const newClasses = state.data.classes
        .filter((c) => c.id !== id)
        .map((c, idx) => ({ ...c, id: idx }));
      await this.fileSystemManager.migrateDatasetOnDelete(id);
      state.set({
        classes: newClasses,
        annotations: newAnnotations,
        selectedClassId: newClasses[0]?.id || null,
        loading: false,
      });
      await this.fileSystemManager.saveClasses(newClasses);
      this.uiManager.updateStatus(`✅ Removed class: ${name}`);
    } catch (err) {
      console.error('Migration failed:', err);
      state.set({ loading: false });
    }
  }
}

if (import.meta.env.DEV) {
  (window as any).__state = state;
  (window as any).__ai = ai;
}

new App();
