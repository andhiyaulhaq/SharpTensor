import { useAppStore, HistoryManager } from '../../core/store';

export interface KeyboardManagerConfig {
  onUpdateStatus: (msg: string) => void;
  onNextImage: () => void;
  onPrevImage: () => void;
  onConfirmMagicMask: () => void;
  onConfirmPolygon: () => void;
  onResetMagicInteraction: () => void;
  onDeleteSelectedBox: () => void;
  onAssignClass: (classIndex: number) => void;
}

export class KeyboardManager {
  constructor(private config: KeyboardManagerConfig) {
    this.init();
  }

  private init() {
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
        if (e.shiftKey) {
          const changed = HistoryManager.redo();
          if (changed) this.config.onUpdateStatus('↪️ Redo');
        } else {
          const changed = HistoryManager.undo();
          if (changed) this.config.onUpdateStatus('↩️ Undo');
        }
        return;
      }
      if (e.ctrlKey && key === 'y') {
        e.preventDefault();
        const changed = HistoryManager.redo();
        if (changed) this.config.onUpdateStatus('↪️ Redo');
        return;
      }

      if (key === 'w') {
        const state = useAppStore.getState();
        const isDet = state.currentTask === 'detection';
        if (!isDet && state.modelStatus !== 'ready') return;
        state.set({ mode: isDet ? 'draw' : 'magic' });
      }
      if (key === 'v') useAppStore.getState().set({ mode: 'select' });
      if (key === 'm') {
        const state = useAppStore.getState();
        const isDet = state.currentTask === 'detection';
        if (!isDet && state.modelStatus !== 'ready') return;
        state.set({ mode: isDet ? 'draw' : 'magic' });
      }
      if (key === 'p') {
        const isSeg = useAppStore.getState().currentTask === 'segmentation';
        if (isSeg) useAppStore.getState().set({ mode: 'polygon' });
      }
      if (key === 'enter') {
        if (useAppStore.getState().mode === 'polygon' && useAppStore.getState().activePolygon) {
          this.config.onConfirmPolygon();
        } else if (useAppStore.getState().mode === 'magic' && useAppStore.getState().activeMask) {
          this.config.onConfirmMagicMask();
        }
      }
      if (key === 'd') this.config.onNextImage();
      if (key === 'a') this.config.onPrevImage();
      if (key === 's') this.config.onConfirmMagicMask();
      if (key === 'escape') this.config.onResetMagicInteraction();
      if (key === 'delete' || key === 'backspace') this.config.onDeleteSelectedBox();
      if (key === 't') {
        useAppStore.getState().set({
          currentTask: useAppStore.getState().currentTask === 'detection' ? 'segmentation' : 'detection',
        });
      }

      if (/^[1-9]$/.test(key)) {
        this.config.onAssignClass(parseInt(key) - 1);
      }
    });
  }
}
