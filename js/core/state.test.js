import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppState } from './state.js';

describe('AppState', () => {
  let state;

  beforeEach(() => {
    // Create a fresh instance for each test to avoid side effects
    state = new AppState();
  });

  it('should initialize with default values', () => {
    expect(state.data.currentTask).toBe('detection');
    expect(state.data.images).toEqual([]);
    expect(state.data.currentImageIndex).toBe(-1);
  });

  it('should update state and notify subscribers', () => {
    const callback = vi.fn();
    state.subscribe(callback);

    state.set({ currentTask: 'segmentation' });

    expect(state.data.currentTask).toBe('segmentation');
    expect(callback).toHaveBeenCalledTimes(1);

    // callback receives (newData, oldState)
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ currentTask: 'segmentation' }),
      expect.objectContaining({ currentTask: 'detection' })
    );
  });

  it('should return currentImage correctly', () => {
    state.set({
      images: [{ name: 'test.jpg' }, { name: 'test2.jpg' }],
      currentImageIndex: 1,
    });

    expect(state.currentImage).toEqual({ name: 'test2.jpg' });

    state.set({ currentImageIndex: -1 });
    expect(state.currentImage).toBeNull();
  });

  describe('Undo/Redo', () => {
    it('should save history when annotations change', () => {
      state.set({ annotations: [{ id: 1, x: 10, y: 10, width: 20, height: 20 }] });
      state.saveHistory();

      expect(state.undoStack).toHaveLength(1);
      expect(state.redoStack).toHaveLength(0);
    });

    it('should not save history if annotations have not changed', () => {
      state.set({ annotations: [{ id: 1 }] });
      state.saveHistory();
      state.saveHistory(); // Calling again with same data

      expect(state.undoStack).toHaveLength(1);
    });

    it('should undo and redo correctly', () => {
      // Initial state is empty annotations []

      // Step 1: Add first annotation
      const ann1 = [{ id: 1, x: 0, y: 0 }];
      state.set({ annotations: ann1 });
      state.saveHistory();

      // Step 2: Add second annotation
      const ann2 = [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 10, y: 10 },
      ];
      state.set({ annotations: ann2 });
      // Wait, saveHistory saves the *current* state.
      // If we are about to make a change, we should saveHistory first, or after?
      // The method `saveHistory` takes current annotations and pushes.

      // Let's test the undo mechanism exactly as it operates.
      // state.undo() takes previous snapshot and sets it.
      // But wait, if undoStack has the current state, popping it will set current state to current state.
      // Let's look at `undo()`:
      // previousSnapshot = pop(), previous = parse, set()
      // This means saveHistory should save the state *before* it changes, or *after*.
      // Let's mock a sequence of events.

      // Event 1
      state.set({ annotations: [] });
      state.saveHistory(); // undoStack: ['[]']

      // Event 2
      state.set({ annotations: [{ id: 1 }] });
      state.saveHistory(); // undoStack: ['[]', '[{"id":1}]']

      // Event 3
      state.set({ annotations: [{ id: 1 }, { id: 2 }] });
      // now annotations are [{id:1}, {id:2}]. We want to undo.

      state.undo();
      // undoStack pops '[{"id":1}]'. Current state becomes [{id:1}].
      expect(state.data.annotations).toEqual([{ id: 1 }]);
      expect(state.redoStack).toHaveLength(1); // the [{id:1}, {id:2}] was pushed to redo?

      // wait, undo pushes current state to redoStack. current state was [{id:1}, {id:2}].
      // so redoStack has ['[{"id":1},{"id":2}]']

      state.redo();
      // redoStack pops ['[{"id":1},{"id":2}]']. Current state becomes [{id:1}, {id:2}].
      expect(state.data.annotations).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should clear redo stack when saving new history', () => {
      state.set({ annotations: [] });
      state.saveHistory();

      state.set({ annotations: [{ id: 1 }] });
      state.saveHistory();

      state.set({ annotations: [{ id: 1 }, { id: 2 }] });

      state.undo(); // Moves one to redo
      expect(state.redoStack).toHaveLength(1);

      // New action
      state.set({ annotations: [{ id: 3 }] });
      state.saveHistory();

      expect(state.redoStack).toHaveLength(0);
    });
  });
});
