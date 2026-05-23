import { state } from './core/state';
import { CanvasEngine } from './engine/canvas';
import { YoloHelper } from './utils/yolo';
import { ai } from './core/ai';
import { ContourTracer } from './core/sam_utils';
import { WelcomeModal } from './components/WelcomeModal';
import { TourManager } from './features/tour/TourManager';
import { ImageListManager } from './features/ui/ImageListManager';
import { ClassListManager } from './features/ui/ClassListManager';
import { AnnotationListManager } from './features/ui/AnnotationListManager';
import { FileSystemManager } from './features/fs/FileSystemManager';
import { AIOrchestrator } from './features/ai/AIOrchestrator';
import './components/index';
import { BoundingBox, ClassDefinition, ImageEntry, ImageCacheEntry } from './core/types';

/**
 * SharpTensor Main Entry Point
 */
class App {
  private canvasEngine!: CanvasEngine;
  private dom!: {
    btnOpen: HTMLButtonElement;
    btnDraw: HTMLButtonElement;
    btnSelect: HTMLButtonElement;
    btnPrev: HTMLButtonElement;
    btnNext: HTMLButtonElement;
    btnExport: HTMLButtonElement;
    imageCounter: HTMLElement;
    fileCountBadge: HTMLElement;
    imageList: HTMLElement;
    classList: HTMLElement;
    annotationList: HTMLElement;
    boxCountBadge: HTMLElement;
    statusMessage: HTMLElement;
    zoomDisplay: HTMLElement;
    btnAddClass: HTMLButtonElement;
    modal: HTMLElement;
    btnLoadModel: HTMLButtonElement;
    btnAutoLabelAll: HTMLButtonElement;
    btnClearAll: HTMLButtonElement;
    modelStatusBadge: HTMLElement;
    workspace: HTMLElement;
    btnTaskDet: HTMLButtonElement;
    btnTaskSeg: HTMLButtonElement;
  };

  private welcome!: WelcomeModal;
  private _saving = false;
  private _savePending = false;
  private _saveTimer: any = null;
  private imageCache = new Map<number, ImageCacheEntry>();
  private _saveQueue: Promise<void> = Promise.resolve();
  private _logInit = false;
  private tourManager!: TourManager;
  private imageListManager!: ImageListManager;
  private classListManager!: ClassListManager;
  private annotationListManager!: AnnotationListManager;
  private fileSystemManager!: FileSystemManager;
  private aiOrchestrator!: AIOrchestrator;

  constructor() {
    this.initUI();
    this.canvasEngine = new CanvasEngine('main-canvas');
    this.initEventListeners();
    this.initStateListeners();
    this.initClickLogger();
    this.initGlobalErrorHandling();

    this.tourManager = new TourManager({
      dom: {
        btnAutoLabelAll: this.dom.btnAutoLabelAll,
        btnDraw: this.dom.btnDraw,
        btnSelect: this.dom.btnSelect
      },
      onStatusUpdate: (msg) => this.updateStatus(msg)
    });

    this.fileSystemManager = new FileSystemManager({
      onStatusUpdate: (msg, isError) => this.updateStatus(msg, isError)
    });

    this.imageListManager = new ImageListManager(this.dom.imageList);
    this.classListManager = new ClassListManager({
      container: this.dom.classList,
      onSaveClasses: (classes) => this.fileSystemManager.saveClasses(classes),
      onDeleteClass: (id) => this.handleDeleteClass(id)
    });
    this.annotationListManager = new AnnotationListManager(this.dom.annotationList);

    this.aiOrchestrator = new AIOrchestrator({
      fileSystemManager: this.fileSystemManager,
      onUpdateStatus: (msg, isError) => this.updateStatus(msg, isError),
      onDrawCanvas: () => this.canvasEngine.draw(),
      onAdvanceTour: (step) => this.tourManager.advanceTour(step),
      onShowModal: (params) => this.showModal(params),
      modalDom: this.dom.modal,
      onRenderImageList: (images) => this.imageListManager.render(images),
      onLoadImage: (idx) => this.loadImage(idx)
    });

    // Load models on startup
    ai.loadModels();

    // Show Welcome Experience
    this.welcome = new WelcomeModal({
      onOpenFolder: () => this.fileSystemManager.handleOpenFolder(),
      onTryDemo: () => this.handleTryDemo(),
      onGitHub: () => window.open('https://github.com/andhiyaulhaq/SharpTensor', '_blank'),
    });
    this.welcome.render();

    console.log('🚀 SharpTensor Initialized (YOLOv8 + MobileSAM)');
  }

  initGlobalErrorHandling(): void {
    window.onerror = (msg, url, line) => {
      this.updateStatus(`❌ Error: ${msg} (Line: ${line})`, true);
      return false;
    };

    window.onunhandledrejection = (event) => {
      this.updateStatus(`❌ Async Error: ${event.reason}`, true);
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
          currentImage: state.currentImage?.name || 'none',
        };
        console.log('🖱️ Click Log:', logEntry);
      },
      true
    );
  }

  initUI(): void {
    const getEl = <T extends HTMLElement>(id: string): T => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`Required UI element #${id} not found.`);
      return el as T;
    };

    this.dom = {
      btnOpen: getEl<HTMLButtonElement>('btn-open'),
      btnDraw: getEl<HTMLButtonElement>('btn-draw'),
      btnSelect: getEl<HTMLButtonElement>('btn-select'),
      btnPrev: getEl<HTMLButtonElement>('btn-prev'),
      btnNext: getEl<HTMLButtonElement>('btn-next'),
      btnExport: getEl<HTMLButtonElement>('btn-export'),
      imageCounter: getEl<HTMLElement>('image-counter'),
      fileCountBadge: getEl<HTMLElement>('file-count'),
      imageList: getEl<HTMLElement>('image-list'),
      classList: getEl<HTMLElement>('class-list'),
      annotationList: getEl<HTMLElement>('annotation-list'),
      boxCountBadge: getEl<HTMLElement>('box-count'),
      statusMessage: getEl<HTMLElement>('status-message'),
      zoomDisplay: getEl<HTMLElement>('zoom-display'),
      btnAddClass: getEl<HTMLButtonElement>('btn-add-class'),
      modal: getEl<HTMLElement>('app-modal'),
      btnLoadModel: getEl<HTMLButtonElement>('btn-load-model'),
      btnAutoLabelAll: getEl<HTMLButtonElement>('btn-auto-label-all'),
      btnClearAll: getEl<HTMLButtonElement>('btn-clear-all'),
      modelStatusBadge: getEl<HTMLElement>('model-status-badge'),
      workspace: getEl<HTMLElement>('workspace'),
      btnTaskDet: getEl<HTMLButtonElement>('task-det'),
      btnTaskSeg: getEl<HTMLButtonElement>('task-seg'),
    };
  }

  initEventListeners(): void {
    this.dom.btnDraw.addEventListener('click', () => {
      const isDet = state.data.currentTask === 'detection';
      state.set({ mode: isDet ? 'draw' : 'magic' });
    });
    this.dom.btnSelect.addEventListener('click', () => state.set({ mode: 'select' }));
    this.dom.btnOpen.addEventListener('click', () => this.fileSystemManager.handleOpenFolder());

    window.addEventListener('request-new-class', (e: Event) => {
      const customEvent = e as CustomEvent<{ boxId?: number }>;
      this.promptForFirstClass(customEvent);
    });

    window.addEventListener('resize', () => {
      if (state.data.currentImageBitmap) {
        this.fitImageToCanvas(state.data.currentImageBitmap);
      }
    });

    this.dom.btnAddClass.addEventListener('click', () => this.handleAddClass());
    this.dom.btnLoadModel.addEventListener('click', () => this.handleLoadCustomModel());
    this.dom.btnAutoLabelAll.addEventListener('click', async () => {
      const btn = this.dom.btnAutoLabelAll as HTMLButtonElement;
      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        <span>Processing...</span>
      `;
      
      await this.aiOrchestrator.handleAutoLabelDataset();
      
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    });
    this.dom.btnClearAll.addEventListener('click', () => this.handleClearAllAnnotations());

    this.dom.btnTaskDet.addEventListener('click', () => state.set({ currentTask: 'detection' }));
    this.dom.btnTaskSeg.addEventListener('click', () => state.set({ currentTask: 'segmentation' }));

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const key = e.key.toLowerCase();

      if (e.ctrlKey && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (e.ctrlKey && key === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }

      if (key === 'w') {
        const isDet = state.data.currentTask === 'detection';
        state.set({ mode: isDet ? 'draw' : 'magic' });
      }
      if (key === 'v') state.set({ mode: 'select' });
      if (key === 'm') {
        const isDet = state.data.currentTask === 'detection';
        state.set({ mode: isDet ? 'draw' : 'magic' });
      }
      if (key === 'd') this.nextImage();
      if (key === 'a') this.prevImage();
      if (key === 's') this.confirmMagicMask();
      if (key === 'escape') this.resetMagicInteraction();
      if (key === 'delete' || key === 'backspace') this.deleteSelectedBox();
      if (key === 't') {
        state.set({
          currentTask: state.data.currentTask === 'detection' ? 'segmentation' : 'detection',
        });
      }

      if (/^[1-9]$/.test(key)) {
        this.classListManager.assignClassToSelected(parseInt(key) - 1);
      }
    });

    this.dom.btnNext.addEventListener('click', () => this.nextImage());
    this.dom.btnPrev.addEventListener('click', () => this.prevImage());
  }

  deleteSelectedBox(): void {
    const { selectedBoxId, annotations } = state.data;
    if (!selectedBoxId) return;

    state.saveHistory();
    state.set({
      annotations: annotations.filter((b) => b.id !== selectedBoxId),
      selectedBoxId: null,
    });
  }

  nextImage(): void {
    if (state.data.images.length === 0) return;
    const nextIdx = (state.data.currentImageIndex + 1) % state.data.images.length;
    state.set({ currentImageIndex: nextIdx });
  }

  prevImage(): void {
    if (state.data.images.length === 0) return;
    const prevIdx =
      (state.data.currentImageIndex - 1 + state.data.images.length) % state.data.images.length;
    state.set({ currentImageIndex: prevIdx });
  }

  initStateListeners(): void {
    state.subscribe((data, oldData) => {
      if (data.mode !== oldData.mode) {
        const isDrawOrMagic = data.mode === 'draw' || data.mode === 'magic';
        this.dom.btnDraw.classList.toggle('active', isDrawOrMagic);
        this.dom.btnSelect.classList.toggle('active', data.mode === 'select');

        if (data.mode) {
          this.updateStatus(`Mode: ${data.mode.toUpperCase()}`);
        }

        if (data.tourActive && data.tourStep === 'step2-interact') {
          this.tourManager.advanceTour('complete');
        }

        if (data.mode === 'magic') {
          this.resetMagicInteraction();
          if (data.currentImageBitmap) {
            const currentImg = data.images[data.currentImageIndex];
            const imgName = currentImg ? currentImg.name : '';
            setTimeout(() => ai.setSAMImage(data.currentImageBitmap!, imgName), 50);
          }
        }
      }

      if (
        data.images.length !== oldData.images.length ||
        data.currentImageIndex !== oldData.currentImageIndex
      ) {
        this.dom.imageCounter.textContent = `${data.currentImageIndex + 1} / ${data.images.length}`;
        this.dom.fileCountBadge.textContent = `${data.images.length} items`;

        if (data.currentImageIndex !== oldData.currentImageIndex) {
          this.loadImage(data.currentImageIndex);
          this.imageListManager.render(data.images);
        }
      }

      if (data.currentTask !== oldData.currentTask) {
        this.updateTaskUI(data.currentTask);
        this.fileSystemManager.loadClasses();
        this.syncTaskAnnotations();
      }

      if (data.images !== oldData.images || data.currentImageIndex !== oldData.currentImageIndex) {
        this.imageListManager.render(data.images);
      }

      if (data.classes !== oldData.classes || data.selectedClassId !== oldData.selectedClassId) {
        this.classListManager.render(data.classes, data.selectedClassId);
      }

      if (data.annotations !== oldData.annotations) {
        this.annotationListManager.render(data.annotations, data.selectedBoxId);
      } else if (data.selectedBoxId !== oldData.selectedBoxId) {
        this.annotationListManager.updateSelection(data.selectedBoxId);
      }

      if (data.annotations !== oldData.annotations && !data.isAutoLabeling) {
        this.dom.boxCountBadge.textContent = data.annotations.length.toString();

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
      this.dom.btnSelect.disabled = !isFolderLoaded;
      this.dom.btnDraw.disabled = !isFolderLoaded;
      this.dom.btnPrev.disabled = !isFolderLoaded;
      this.dom.btnNext.disabled = !isFolderLoaded;
      this.dom.btnExport.disabled = !isFolderLoaded;
      this.dom.btnAddClass.disabled = !isFolderLoaded;
      this.dom.btnLoadModel.disabled = true; // Always disabled for now
      this.dom.btnClearAll.disabled = !isFolderLoaded;
      this.dom.btnTaskDet.disabled = !isFolderLoaded;
      this.dom.btnTaskSeg.disabled = !isFolderLoaded;

      this.dom.btnAutoLabelAll.disabled = data.modelStatus !== 'ready' || !isFolderLoaded;

      if (this.dom.modelStatusBadge) {
        const badge = this.dom.modelStatusBadge;
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

      if (data.classes !== oldData.classes || data.selectedClassId !== oldData.selectedClassId) {
        this.classListManager.render(data.classes, data.selectedClassId);
      }

      this.initLogListener();
    });

    // Sync initial state values to UI on startup
    const initialMode = state.data.mode;
    const isDrawOrMagic = initialMode === 'draw' || initialMode === 'magic';
    this.dom.btnDraw.classList.toggle('active', isDrawOrMagic);
    this.dom.btnSelect.classList.toggle('active', initialMode === 'select');
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
      let annotations: BoundingBox[] = [];
      if (imageInfo.status !== 'pending') {
        annotations = await this.fileSystemManager.loadAnnotations(imageInfo.name, bitmap);
      }this.fitImageToCanvas(bitmap);

      // Store in Cache
      const cacheEntry: ImageCacheEntry = { bitmap };
      if (state.data.currentTask === 'detection') cacheEntry.detAnnos = annotations;
      else cacheEntry.segAnnos = annotations;

      this.imageCache.set(index, cacheEntry);
      if (this.imageCache.size > 15) {
        const oldestIndex = this.imageCache.keys().next().value;
        if (oldestIndex !== undefined) this.imageCache.delete(oldestIndex);
      }

      state.undoStack = [];
      state.redoStack = [];
      state.saveHistory();

      state.set({
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
        ai.setSAMImage(currentImageBitmap, imageInfo.name);
        this.preloadNeighborhood(currentImageIndex);
      }
    } catch (err) {
      console.error('Failed to sync task annotations:', err);
    }
  }

  fitImageToCanvas(bitmap: ImageBitmap): void {
    const container = document.getElementById('workspace');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const padding = 40;
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;
    const zoom = Math.min(availableWidth / bitmap.width, availableHeight / bitmap.height);
    const panX = (rect.width - bitmap.width * zoom) / 2;
    const panY = (rect.height - bitmap.height * zoom) / 2;
    state.set({ zoom, pan: { x: panX, y: panY } });
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

      await this.fileSystemManager.loadClasses();

      const images: ImageEntry[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && /\.(jpe?g|png|webp)$/i.test(entry.name)) {
          images.push({ name: entry.name, handle: entry, status: 'pending' });
        }
      }
      images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      this.imageCache.clear();
      state.set({
        images,
        currentImageIndex: images.length > 0 ? 0 : -1,
        loading: false,
        mode: 'select',
      });
      this.imageListManager.render(images);
    } catch (err) {
      console.error('Failed to open folder:', err);
      this.updateStatus('Access denied or folder empty', true);
    }
  }

  async handleTryDemo(): Promise<void> {
    try {
      this.updateStatus('✨ Loading demo scene...');
      const response = await fetch('/sample.jpg');
      const blob = await response.blob();
      const file = new File([blob], 'sample_street.jpg', { type: 'image/jpeg' });

      // Mock a folder-like structure for the demo
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

      await this.loadImage(0);
      this.imageListManager.render(mockImages);
      this.tourManager.startTour();
    } catch (err) {
      console.error('Demo failed:', err);
      this.updateStatus('❌ Demo failed to load', true);
    }
  }

  showModal(params: {
    title: string;
    message: string;
    inputPlaceholder?: string;
    confirmText?: string;
    cancelText?: string;
    checkboxLabel?: string;
    onConfirm?: (val: string, checked: boolean) => void;
    onCancel?: () => void;
  }): void {
    const {
      title,
      message,
      inputPlaceholder = '',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      checkboxLabel = '',
      onConfirm,
      onCancel,
    } = params;

    const modal = this.dom.modal;
    modal.setAttribute('title', title);
    const msgEl = modal.querySelector('.modal-message') as HTMLElement;
    if (msgEl) msgEl.textContent = message;

    const input = modal.querySelector('.modal-input') as HTMLInputElement;
    const progressContainer = modal.querySelector('.modal-progress-container') as HTMLElement;
    const checkboxContainer = modal.querySelector('.modal-checkbox-container') as HTMLElement;
    const checkbox = modal.querySelector('.modal-checkbox') as HTMLInputElement;
    const checkboxLabelEl = modal.querySelector('.modal-checkbox-label') as HTMLElement;

    if (inputPlaceholder) {
      input.classList.remove('hidden');
      input.placeholder = inputPlaceholder;
      input.value = '';
      setTimeout(() => input.focus(), 100);
    } else {
      input.classList.add('hidden');
    }

    if (checkboxLabel) {
      checkboxContainer.classList.remove('hidden');
      checkboxContainer.classList.add('flex');
      checkboxLabelEl.textContent = checkboxLabel;
      checkbox.checked = false;
      checkboxContainer.onclick = () => checkbox.click();
    } else {
      checkboxContainer.classList.add('hidden');
      checkboxContainer.classList.remove('flex');
    }

    progressContainer?.classList.add('hidden');

    const confirmBtn = modal.querySelector('.modal-confirm') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('.modal-cancel') as HTMLButtonElement;

    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    const isDanger = /delete|purge|irreversible|critical|nuclear|🚨|☢️/i.test(title + message);

    confirmBtn.classList.toggle('bg-red-600', isDanger);
    confirmBtn.classList.toggle('hover:bg-red-500', isDanger);
    confirmBtn.classList.toggle('shadow-[0_4px_12px_rgba(220,38,38,0.3)]', isDanger);
    confirmBtn.classList.toggle('text-white', isDanger);

    confirmBtn.classList.toggle('bg-(--accent)', !isDanger);
    confirmBtn.classList.toggle('text-(--accent-text)', !isDanger);

    const card = modal.querySelector('.modal-card') as HTMLElement;
    card.classList.toggle('border-t-red-500', isDanger);
    card.classList.toggle('border-t-2', isDanger);
    card.classList.toggle('border-t-white/20', !isDanger);
    card.classList.toggle('border-t', !isDanger);

    modal.classList.remove('hidden');

    confirmBtn.onclick = () => {
      const val = input.value.trim();
      const checked = checkbox.checked;
      modal.classList.add('hidden');
      if (onConfirm) onConfirm(val, checked);
    };

    cancelBtn.onclick = () => {
      modal.classList.add('hidden');
      if (onCancel) onCancel();
    };
  }

  handleAddClass(): void {
    this.showModal({
      title: 'Define New Class',
      message:
        'Please specify a unique identifier for your new object category. This will be added to your classes.txt schema:',
      inputPlaceholder: 'e.g. Building, Tree, Pedestrian...',
      confirmText: 'Add to Schema',
      onConfirm: (name) => {
        if (!name) return;
        const newId =
          state.data.classes.length > 0 ? Math.max(...state.data.classes.map((c) => c.id)) + 1 : 0;
        const newClasses = [
          ...state.data.classes,
          { id: newId, name, color: YoloHelper.generateColor(newId) },
        ];
        state.set({ classes: newClasses, selectedClassId: newId });
        this.fileSystemManager.saveClasses(newClasses);
      },
    });
  }

  promptForFirstClass(e: CustomEvent<{ boxId?: number }>): void {
    const boxId = e.detail?.boxId;
    this.showModal({
      title: 'Initialize Workspace',
      message:
        'Welcome to SharpTensor. To begin labeling, please define your primary object class. This will serve as the initial category for your dataset.',
      inputPlaceholder: 'e.g. Car, Dog, License Plate...',
      confirmText: 'Initialize Class',
      onConfirm: (name) => {
        if (!name) return;
        const newClasses = [{ id: 0, name, color: YoloHelper.generateColor(0) }];
        let annotations = state.data.annotations;
        if (boxId) {
          annotations = annotations.map((b) => (b.id === boxId ? { ...b, classId: 0 } : b));
        }
        state.set({ classes: newClasses, selectedClassId: 0, annotations });
        this.fileSystemManager.saveClasses(newClasses);
      },
    });
  }

  updateImageSelection(index: number): void {
    this.dom.imageList.querySelectorAll('.image-item').forEach((item, idx) => {
      const element = item as HTMLElement;
      const isActive = idx === index;
      element.classList.toggle('bg-(--accent)/15', isActive);
      element.classList.toggle('text-(--accent-light)', isActive);
      element.classList.toggle('font-semibold', isActive);
      element.classList.toggle('shadow-sm', isActive);
      element.classList.toggle('text-(--text-secondary)', !isActive);
      if (isActive) element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  updateClassSelection(selectedId: number): void {
    this.dom.classList.querySelectorAll('.class-item').forEach((item) => {
      const element = item as HTMLElement;
      const isActive = parseInt(element.dataset.id || '0') === selectedId;
      element.classList.toggle('bg-(--accent)/15', isActive);
      element.classList.toggle('border-(--accent)', isActive);
      element.classList.toggle('text-(--text-primary)', isActive);
      element.classList.toggle('shadow-sm', isActive);
    });
  }



  async handleClearAllAnnotations(): Promise<void> {
    this.showModal({
      title: '☢️ NUCLEAR OPTION: Purge Dataset',
      message:
        '🚨 CRITICAL: You are about to initiate a final purge of the current dataset. This will delete all annotation files. You can optionally reset your class definitions as well.',
      confirmText: 'Execute Purge',
      cancelText: 'Abort',
      checkboxLabel: 'Also reset class definitions (classes.txt)',
      onConfirm: async (val, clearClasses) => {
        try {
          state.set({ loading: true, statusMessage: '🗑️ Purging data...' });
          const { labelFolderHandle, labelSegFolderHandle, images, currentTask } = state.data;

          const targetFolder =
            currentTask === 'segmentation' ? labelSegFolderHandle : labelFolderHandle;
          if (!targetFolder) return;

          for (const img of images) {
            const txtName = img.name.replace(/\.[^/.]+$/, '') + '.txt';
            try {
              await targetFolder.removeEntry(txtName);
            } catch (e) { }
            img.status = 'pending';
          }

          this.imageCache.clear();

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
          this.updateStatus('✅ All annotations cleared');
        } catch (err) {
          console.error('Failed to clear annotations:', err);
          state.set({ loading: false });
          this.updateStatus('❌ Error clearing annotations', true);
        }
      },
    });
  }

  handleLoadCustomModel(): void {
    this.updateStatus('⚠️ Custom model loading disabled for RT-DETR pipeline', true);
  }

  updateStatus(msg: string, isError = false): void {
    this.dom.statusMessage.textContent = msg;
    this.dom.statusMessage.style.color = isError ? '#ef4444' : 'var(--text-muted)';
  }

  // --- Magic Select (SAM) Helpers ---

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
        this.updateStatus('❌ Segment too small', true);
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

    this.updateStatus(`` + `✅ ${isSegTask ? 'Polygon' : 'Box'} confirmed`);
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
    this.showModal({
      title: 'Delete Class Definition',
      message: `⚠️ DATA INTEGRITY ALERT: Deleting the "${cls.name}" class will permanently remove all associated bounding boxes across your entire dataset. This operation also triggers a class ID re-index. Are you certain?`,
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
      this.updateStatus(`✅ Removed class: ${name}`);
    } catch (err) {
      console.error('Migration failed:', err);
      state.set({ loading: false });
    }
  }

  updateTaskUI(task: 'detection' | 'segmentation'): void {
    const isDet = task === 'detection';
    this.dom.btnTaskDet.classList.toggle('active-task-btn', isDet);
    this.dom.btnTaskDet.classList.toggle('text-(--text-muted)', !isDet);
    this.dom.btnTaskSeg.classList.toggle('active-task-btn', !isDet);
    this.dom.btnTaskSeg.classList.toggle('text-(--text-muted)', isDet);

    this.dom.btnDraw.disabled = false;

    if (isDet) {
      state.set({ mode: 'draw' });
    } else {
      state.set({ mode: 'magic' });
    }

    this.updateStatus(`Task Switched: ${task.toUpperCase()}`);
  }
}

// DEV-only: expose state and ai for Playwright test assertions
if (import.meta.env.DEV) {
  (window as any).__state = state;
  (window as any).__ai = ai;
}

new App();
