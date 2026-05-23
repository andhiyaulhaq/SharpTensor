import { state } from '../../core/state';

export interface UIManagerConfig {
  onOpenFolder: () => void;
  onAddClass: () => void;
  onLoadCustomModel: () => void;
  onAutoLabel: () => Promise<void>;
  onClearAllAnnotations: () => void;
  onNextImage: () => void;
  onPrevImage: () => void;
  onPromptForFirstClass: (e: CustomEvent<{ boxId?: number }>) => void;
}

export class UIManager {
  dom!: {
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

  constructor(private config: UIManagerConfig) {
    this.initUI();
    this.initEventListeners();
  }

  private initUI(): void {
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

  private initEventListeners(): void {
    this.dom.btnDraw.addEventListener('click', () => {
      const isDet = state.data.currentTask === 'detection';
      state.set({ mode: isDet ? 'draw' : 'magic' });
    });
    this.dom.btnSelect.addEventListener('click', () => state.set({ mode: 'select' }));
    this.dom.btnOpen.addEventListener('click', () => this.config.onOpenFolder());

    window.addEventListener('request-new-class', (e: Event) => {
      this.config.onPromptForFirstClass(e as CustomEvent<{ boxId?: number }>);
    });

    window.addEventListener('status-update', (e: Event) => {
      const { msg, isError } = (e as CustomEvent).detail;
      this.updateStatus(msg, isError);
    });

    this.dom.btnAddClass.addEventListener('click', () => this.config.onAddClass());
    this.dom.btnLoadModel.addEventListener('click', () => this.config.onLoadCustomModel());
    
    this.dom.btnAutoLabelAll.addEventListener('click', async () => {
      const btn = this.dom.btnAutoLabelAll;
      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        <span>Processing...</span>
      `;
      
      await this.config.onAutoLabel();
      
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    });

    this.dom.btnClearAll.addEventListener('click', () => this.config.onClearAllAnnotations());
    this.dom.btnTaskDet.addEventListener('click', () => state.set({ currentTask: 'detection' }));
    this.dom.btnTaskSeg.addEventListener('click', () => state.set({ currentTask: 'segmentation' }));

    this.dom.btnNext.addEventListener('click', () => this.config.onNextImage());
    this.dom.btnPrev.addEventListener('click', () => this.config.onPrevImage());
  }

  updateStatus(msg: string, isError = false): void {
    if (this.dom.statusMessage) {
      this.dom.statusMessage.textContent = msg;
      this.dom.statusMessage.className = isError ? 'text-red-500 font-bold' : 'text-(--text-muted)';
    }
  }

  updateTaskUI(task: 'detection' | 'segmentation'): void {
    const isDet = task === 'detection';
    this.dom.btnTaskDet.classList.toggle('active-task-btn', isDet);
    this.dom.btnTaskDet.classList.toggle('text-(--text-muted)', !isDet);

    this.dom.btnTaskSeg.classList.toggle('active-task-btn', !isDet);
    this.dom.btnTaskSeg.classList.toggle('text-(--text-muted)', isDet);

    if (state.data.mode === 'draw' && !isDet) state.set({ mode: 'magic' });
    if (state.data.mode === 'magic' && isDet) state.set({ mode: 'draw' });
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

    const modalEl = this.dom.modal as any;
    if (!modalEl || !modalEl.show) {
      alert(`${title}\n\n${message}`);
      if (onConfirm) onConfirm('', false);
      return;
    }

    modalEl.setAttribute('title', title);
    modalEl.show({
      message,
      inputPlaceholder,
      confirmText,
      cancelText,
      checkboxLabel,
      onConfirm,
      onCancel,
    });
  }
}
