import { state } from '../../core/state';

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
        const changed = e.shiftKey ? state.redo() : state.undo();
        if (changed) this.config.onUpdateStatus(e.shiftKey ? '↪️ Redo' : '↩️ Undo');
        return;
      }
      if (e.ctrlKey && key === 'y') {
        e.preventDefault();
        const changed = state.redo();
        if (changed) this.config.onUpdateStatus('↪️ Redo');
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
      if (key === 'p') {
        const isSeg = state.data.currentTask === 'segmentation';
        if (isSeg) state.set({ mode: 'polygon' });
      }
      if (key === 'enter') {
        if (state.data.mode === 'polygon' && state.data.activePolygon) {
          this.config.onConfirmPolygon();
        }
      }
      if (key === 'd') this.config.onNextImage();
      if (key === 'a') this.config.onPrevImage();
      if (key === 's') this.config.onConfirmMagicMask();
      if (key === 'escape') this.config.onResetMagicInteraction();
      if (key === 'delete' || key === 'backspace') this.config.onDeleteSelectedBox();
      if (key === 't') {
        state.set({
          currentTask: state.data.currentTask === 'detection' ? 'segmentation' : 'detection',
        });
      }

      if (/^[1-9]$/.test(key)) {
        this.config.onAssignClass(parseInt(key) - 1);
      }
    });
  }
}
