import { describe, it, expect } from 'vitest';
import { ResizeLongestSide, ContourTracer } from './sam_utils.js';

describe('SAM Utils', () => {
    describe('ResizeLongestSide', () => {
        const resizer = new ResizeLongestSide(1024);

        it('should calculate preprocess shape correctly', () => {
            // original 500x800 -> longest side is 800. Scale = 1024 / 800 = 1.28
            // newH = 500 * 1.28 = 640
            // newW = 800 * 1.28 = 1024
            const shape1 = ResizeLongestSide.getPreprocessShape(500, 800, 1024);
            expect(shape1).toEqual([640, 1024]);

            // original 1000x500 -> scale = 1024 / 1000 = 1.024
            // newH = 1024, newW = 512
            const shape2 = ResizeLongestSide.getPreprocessShape(1000, 500, 1024);
            expect(shape2).toEqual([1024, 512]);
        });

        it('should apply coordinates correctly', () => {
            const coords = [[100, 200], [400, 100]];
            const originalSize = [500, 800]; // [H, W]
            // scale is 1.28
            // coords [x, y] => [100*1.28, 200*1.28] => [128, 256]
            const result = resizer.applyCoords(coords, originalSize);
            expect(result[0][0]).toBeCloseTo(128);
            expect(result[0][1]).toBeCloseTo(256);
            expect(result[1][0]).toBeCloseTo(512);
            expect(result[1][1]).toBeCloseTo(128);
        });

        it('should apply boxes correctly', () => {
            const boxes = [[100, 100, 200, 200]]; // [x1, y1, x2, y2]
            const originalSize = [500, 800]; // [H, W]
            // scale is 1.28
            const result = resizer.applyBoxes(boxes, originalSize);
            expect(result[0][0]).toBeCloseTo(128);
            expect(result[0][1]).toBeCloseTo(128);
            expect(result[0][2]).toBeCloseTo(256);
            expect(result[0][3]).toBeCloseTo(256);
        });
    });

    describe('ContourTracer', () => {
        it('should return null for empty mask', () => {
            const mask = new Uint8Array([0, 0, 0, 0]);
            const result = ContourTracer.trace(mask, 2, 2);
            expect(result).toBeNull();
        });

        it('should trace simple square mask', () => {
            // 4x4 image with a 2x2 square in middle
            // 0 0 0 0
            // 0 1 1 0
            // 0 1 1 0
            // 0 0 0 0
            const mask = new Uint8Array([
                0, 0, 0, 0,
                0, 1, 1, 0,
                0, 1, 1, 0,
                0, 0, 0, 0
            ]);
            
            const points = ContourTracer.trace(mask, 4, 4);
            // Points should outline the 1s
            expect(points).not.toBeNull();
            expect(points.length).toBeGreaterThanOrEqual(2);
        });
        
        it('should simplify points', () => {
            const points = [
                [0, 0],
                [1, 0.1], // Slight deviation
                [2, 0],
                [2, 2],
                [0, 2]
            ];
            
            const simplified = ContourTracer.simplify(points, 0.5);
            // The point [1, 0.1] should be removed because it falls within the tolerance
            expect(simplified.length).toBeLessThan(points.length);
        });
    });
});
