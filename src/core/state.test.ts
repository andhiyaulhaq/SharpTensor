import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppState } from './state';
import { BoundingBox } from './types';

describe('AppState', () => {
  let state: AppState;

  beforeEach(() => {
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

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ currentTask: 'segmentation' }),
      expect.objectContaining({ currentTask: 'detection' })
    );
  });

  it('should unsubscribe successfully', () => {
    const callback = vi.fn();
    const unsubscribe = state.subscribe(callback);
    unsubscribe();
    state.set({ currentTask: 'segmentation' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('should return currentImage correctly', () => {
    state.set({
      images: [
        { name: 'test.jpg', handle: {} as any, status: 'pending' },
        { name: 'test2.jpg', handle: {} as any, status: 'pending' },
      ],
      currentImageIndex: 1,
    });

    expect(state.currentImage).toEqual({ name: 'test2.jpg', handle: {}, status: 'pending' });

    state.set({ currentImageIndex: -1 });
    expect(state.currentImage).toBeNull();
  });

  describe('Undo/Redo', () => {
    it('should save history when annotations change', () => {
      state.set({ annotations: [{ id: 1, x: 10, y: 10, width: 20, height: 20, classId: 0 }] });
      state.saveHistory();

      expect(state.history[state.data.currentTask].undo).toHaveLength(1);
      expect(state.history[state.data.currentTask].redo).toHaveLength(0);
    });

    it('should not save history if annotations have not changed', () => {
      state.set({ annotations: [{ id: 1, x: 10, y: 10, width: 20, height: 20, classId: 0 }] });
      state.saveHistory();
      state.saveHistory();

      expect(state.history[state.data.currentTask].undo).toHaveLength(1);
    });

    it('should undo and redo correctly', () => {
      state.set({ annotations: [] });
      state.saveHistory();

      state.set({ annotations: [{ id: 1, x: 0, y: 0, width: 10, height: 10, classId: 0 }] });
      state.saveHistory();

      state.set({
        annotations: [
          { id: 1, x: 0, y: 0, width: 10, height: 10, classId: 0 },
          { id: 2, x: 10, y: 10, width: 10, height: 10, classId: 0 },
        ],
      });

      state.undo();
      expect(state.data.annotations).toEqual([
        { id: 1, x: 0, y: 0, width: 10, height: 10, classId: 0 },
      ]);
      expect(state.history[state.data.currentTask].redo).toHaveLength(1);

      state.redo();
      expect(state.data.annotations).toEqual([
        { id: 1, x: 0, y: 0, width: 10, height: 10, classId: 0 },
        { id: 2, x: 10, y: 10, width: 10, height: 10, classId: 0 },
      ]);
    });

    it('should clear redo stack when saving new history', () => {
      state.set({ annotations: [] });
      state.saveHistory();

      state.set({ annotations: [{ id: 1, x: 0, y: 0, width: 10, height: 10, classId: 0 }] });
      state.saveHistory();

      state.set({
        annotations: [
          { id: 1, x: 0, y: 0, width: 10, height: 10, classId: 0 },
          { id: 2, x: 10, y: 10, width: 10, height: 10, classId: 0 },
        ],
      });

      state.undo();
      expect(state.history[state.data.currentTask].redo).toHaveLength(1);

      state.set({ annotations: [{ id: 3, x: 0, y: 0, width: 10, height: 10, classId: 0 }] });
      state.saveHistory();

      expect(state.history[state.data.currentTask].redo).toHaveLength(0);
    });
  });
});
