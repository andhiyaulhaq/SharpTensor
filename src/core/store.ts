import { createStore } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import { AppStateData } from './types';

export type AppState = AppStateData & {
  // Generic state updater for simple UI toggles
  set: (partial: Partial<AppStateData>) => void;
};

const initialState: AppStateData = {
  folderHandle: null,
  labelFolderHandle: null,
  labelSegFolderHandle: null,
  currentTask: 'detection',
  images: [],
  currentImageIndex: -1,
  currentImageBitmap: null,
  annotations: [],
  selectedBoxId: null,
  hoveredBoxId: null,
  hoveredHandle: null,
  activeHandle: null,
  classes: [],
  selectedClassId: null,
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  isPanning: false,
  interactionMode: 'select',
  mode: 'select',
  loading: false,
  activePolygon: null,
  aiModel: null,
  isAutoLabeling: false,
  autoLabelProgress: 0,
  modelStatus: 'idle',
  activeMask: null,
  promptPoints: [],
  activePromptBox: null,
  samLatency: { encoder: 0, decoder: 0 },
  tourActive: false,
  tourStep: 'idle',
};

export const useAppStore = createStore<AppState>()(
  immer((set) => ({
    ...initialState,
    
    set: (partial) =>
      set((state) => {
        Object.assign(state, partial);
      }),
  }))
);

// Vanilla History Manager
let history: BoundingBox[][] = [[]];
let historyIndex = 0;
let isUndoRedo = false;

export const HistoryManager = {
  save: (annotations: BoundingBox[]) => {
    const snapshot = JSON.parse(JSON.stringify(annotations));
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    if (historyIndex >= 0 && JSON.stringify(history[historyIndex]) === JSON.stringify(snapshot)) return;
    
    history.push(snapshot);
    if (history.length > 50) history.shift();
    else historyIndex++;
  },
  undo: () => {
    if (historyIndex > 0) {
      historyIndex--;
      isUndoRedo = true;
      useAppStore.getState().set({ annotations: JSON.parse(JSON.stringify(history[historyIndex])) });
      isUndoRedo = false;
      return true;
    }
    return false;
  },
  redo: () => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      isUndoRedo = true;
      useAppStore.getState().set({ annotations: JSON.parse(JSON.stringify(history[historyIndex])) });
      isUndoRedo = false;
      return true;
    }
    return false;
  },
  clear: () => {
    history = [JSON.parse(JSON.stringify(useAppStore.getState().annotations))];
    historyIndex = 0;
  }
};

useAppStore.subscribe((state, prevState) => {
  if (isUndoRedo) return;
  if (state.annotations !== prevState.annotations) {
    HistoryManager.save(state.annotations);
  }
});
