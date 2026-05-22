import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasEngine } from './canvas.js';
import { state } from '../core/state.js';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('CanvasEngine', () => {
    let engine;
    let canvasEl;
    let containerEl;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="workspace" style="width: 800px; height: 600px;">
                <canvas id="canvas"></canvas>
            </div>
        `;
        
        canvasEl = document.getElementById('canvas');
        containerEl = document.getElementById('workspace');

        // Mock getBoundingClientRect
        containerEl.getBoundingClientRect = () => ({
            width: 800,
            height: 600,
            top: 0,
            left: 0
        });
        
        canvasEl.getBoundingClientRect = () => ({
            width: 800,
            height: 600,
            top: 0,
            left: 0
        });

        // Mock state
        state.set({
            pan: { x: 0, y: 0 },
            zoom: 1.0,
            annotations: [],
            classes: []
        });

        // Init engine
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
            // (100 - 50)/1, (200 - 50)/1
            expect(result).toEqual({ x: 50, y: 150 });
        });

        it('should correctly convert screen to image coordinates with zoom', () => {
            state.set({ zoom: 2.0 });
            const result = engine.screenToImage(100, 200);
            // 100/2, 200/2
            expect(result).toEqual({ x: 50, y: 100 });
        });
    });

    describe('Hit Testing', () => {
        beforeEach(() => {
            state.set({
                zoom: 1.0,
                annotations: [
                    { id: 1, classId: 0, x: 100, y: 100, width: 200, height: 200 }
                ],
                classes: [{ id: 0, name: 'car', color: '#ff0000' }]
            });
            
            // Mock context measureText
            engine.ctx.measureText = vi.fn().mockReturnValue({ width: 30 });
        });

        it('should hit test the body of the box', () => {
            const hit = engine.hitTest(150, 150); // Inside the box
            expect(hit).not.toBeNull();
            expect(hit.boxId).toBe(1);
            expect(hit.handle).toBeNull(); // body hit
        });

        it('should return null if missed', () => {
            const hit = engine.hitTest(10, 10);
            expect(hit).toBeNull();
        });

        it('should hit test the label', () => {
            // Label is drawn above the box (y - bgHeight to y)
            // bgHeight is approx 18 + padding
            const hit = engine.hitTest(105, 95); 
            expect(hit).not.toBeNull();
            expect(hit.boxId).toBe(1);
            expect(hit.handle).toBe('label');
        });

        it('should hit test handles if box is selected', () => {
            state.set({ selectedBoxId: 1 });
            
            // NE handle is at x:300, y:100. Handle size is 8.
            const hit = engine.hitTest(300, 100);
            expect(hit).not.toBeNull();
            expect(hit.boxId).toBe(1);
            expect(hit.handle).toBe('ne');
            
            // SE handle is at x:300, y:300
            const hit2 = engine.hitTest(300, 300);
            expect(hit2.handle).toBe('se');
        });
    });

    describe('Interactions', () => {
        it('should start panning on middle click', () => {
            const mockEvent = { button: 1, clientX: 100, clientY: 100 };
            engine.onMouseDown(mockEvent);
            expect(engine.interaction.type).toBe('pan');
            expect(engine.canvas.style.cursor).toBe('grabbing');
        });

        it('should select box on left click', () => {
            state.set({
                annotations: [{ id: 1, classId: 0, x: 100, y: 100, width: 200, height: 200 }]
            });
            engine.ctx.measureText = vi.fn().mockReturnValue({ width: 30 });

            // Click on box body
            const mockEvent = { button: 0, clientX: 150, clientY: 150 };
            engine.onMouseDown(mockEvent);

            expect(state.data.selectedBoxId).toBe(1);
            expect(engine.interaction.type).toBe('move');
            expect(engine.interaction.boxId).toBe(1);
        });
    });
});
