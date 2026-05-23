import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasEngine } from './canvas';
import { state } from '../core/state';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('CanvasEngine', () => {
  let engine: CanvasEngine;
  let canvasEl: HTMLCanvasElement;
  let containerEl: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="workspace" style="width: 800px; height: 600px;">
        <canvas id="canvas"></canvas>
      </div>
    `;

    canvasEl = document.getElementById('canvas') as HTMLCanvasElement;
    containerEl = document.getElementById('workspace') as HTMLElement;

    containerEl.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    canvasEl.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    state.set({
      pan: { x: 0, y: 0 },
      zoom: 1.0,
      annotations: [],
      classes: [],
    });

    engine = new CanvasEngine('canvas');
  });

  describe('Coordinate Conversion', () => {
    it('should correctly convert screen to image coordinates at 1x zoom', () => {
      const result = engine.screenToImage(100, 200);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should correctly convert screen to image coordinates with pan', () => {
      state.set({ pan: { x: 50, y: 50 } });
      const result = engine.screenToImage(100, 200);
      expect(result).toEqual({ x: 50, y: 150 });
    });

    it('should correctly convert screen to image coordinates with zoom', () => {
      state.set({ zoom: 2.0 });
      const result = engine.screenToImage(100, 200);
      expect(result).toEqual({ x: 50, y: 100 });
    });
  });

  describe('Hit Testing', () => {
    beforeEach(() => {
      state.set({
        zoom: 1.0,
        annotations: [{ id: 1, classId: 0, x: 100, y: 100, width: 200, height: 200, score: 1.0 }],
        classes: [{ id: 0, name: 'car', color: '#ff0000' }],
      });

      engine['ctx'].measureText = vi.fn().mockReturnValue({ width: 30 } as TextMetrics);
    });

    it('should hit test the body of the box', () => {
      const hit = engine.hitTest(150, 150);
      expect(hit).not.toBeNull();
      expect(hit!.boxId).toBe(1);
      expect(hit!.handle).toBeNull();
    });

    it('should return null if missed', () => {
      const hit = engine.hitTest(10, 10);
      expect(hit).toBeNull();
    });

    it('should hit test the label', () => {
      const hit = engine.hitTest(105, 95);
      expect(hit).not.toBeNull();
      expect(hit!.boxId).toBe(1);
      expect(hit!.handle).toBe('label');
    });

    it('should hit test handles if box is selected', () => {
      state.set({ selectedBoxId: 1 });

      const hit = engine.hitTest(300, 100);
      expect(hit).not.toBeNull();
      expect(hit!.boxId).toBe(1);
      expect(hit!.handle).toBe('ne');

      const hit2 = engine.hitTest(300, 300);
      expect(hit2).not.toBeNull();
      expect(hit2!.handle).toBe('se');
    });
  });

  describe('Interactions', () => {
    it('should start panning on middle click', () => {
      const mockEvent = { button: 1, clientX: 100, clientY: 100 } as MouseEvent;
      engine['onMouseDown'](mockEvent);
      expect(engine['interaction']?.type).toBe('pan');
      expect(engine['canvas'].style.cursor).toBe('grabbing');
    });

    it('should select box on left click', () => {
      state.set({
        annotations: [{ id: 1, classId: 0, x: 100, y: 100, width: 200, height: 200, score: 1.0 }],
      });
      engine['ctx'].measureText = vi.fn().mockReturnValue({ width: 30 } as TextMetrics);

      const mockEvent = { button: 0, clientX: 150, clientY: 150 } as MouseEvent;
      engine['onMouseDown'](mockEvent);

      expect(state.data.selectedBoxId).toBe(1);
      expect(engine['interaction']?.type).toBe('move');
      expect((engine['interaction'] as any).boxId).toBe(1);
    });
  });
});
