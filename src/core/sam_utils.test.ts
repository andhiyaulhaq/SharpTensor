import { describe, it, expect } from 'vitest';
import { ResizeLongestSide, ContourTracer, PromptEncoder } from './sam_utils';

describe('SAM Utils', () => {
  describe('ResizeLongestSide', () => {
    const resizer = new ResizeLongestSide(1024);

    it('should calculate preprocess shape correctly', () => {
      const shape1 = ResizeLongestSide.getPreprocessShape(500, 800, 1024);
      expect(shape1).toEqual([640, 1024]);

      const shape2 = ResizeLongestSide.getPreprocessShape(1000, 500, 1024);
      expect(shape2).toEqual([1024, 512]);
    });

    it('should apply coordinates correctly', () => {
      const coords: [number, number][] = [
        [100, 200],
        [400, 100],
      ];
      const originalSize: [number, number] = [500, 800];
      const result = resizer.applyCoords(coords, originalSize);
      expect(result[0]![0]).toBeCloseTo(128);
      expect(result[0]![1]).toBeCloseTo(256);
      expect(result[1]![0]).toBeCloseTo(512);
      expect(result[1]![1]).toBeCloseTo(128);
    });

    it('should apply boxes correctly', () => {
      const boxes: [number, number, number, number][] = [[100, 100, 200, 200]];
      const originalSize: [number, number] = [500, 800];
      const result = resizer.applyBoxes(boxes, originalSize);
      expect(result[0]![0]).toBeCloseTo(128);
      expect(result[0]![1]).toBeCloseTo(128);
      expect(result[0]![2]).toBeCloseTo(256);
      expect(result[0]![3]).toBeCloseTo(256);
    });
  });

  describe('ContourTracer', () => {
    it('should return null for empty mask', () => {
      const mask = new Uint8Array([0, 0, 0, 0]);
      const result = ContourTracer.trace(mask, 2, 2);
      expect(result).toBeNull();
    });

    it('should trace simple square mask', () => {
      const mask = new Uint8Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0]);

      const points = ContourTracer.trace(mask, 4, 4);
      expect(points).not.toBeNull();
      expect(points!.length).toBeGreaterThanOrEqual(2);
    });

    it('should simplify points', () => {
      const points: [number, number][] = [
        [0, 0],
        [1, 0.1],
        [2, 0],
        [3, 3], // will fall beyond t > 1 segment range for projection
        [2, 2],
        [0, 2],
      ];

      const simplified = ContourTracer.simplify(points, 0.5);
      expect(simplified.length).toBeLessThan(points.length);
    });
  });

  describe('PromptEncoder', () => {
    const mockWeights = {
      'model.pe_layer.positional_encoding_gaussian_matrix': [
        new Array(128).fill(0.1),
        new Array(128).fill(0.2),
      ],
      'model.point_embeddings.0.weight': [new Array(256).fill(0.5)],
      'model.point_embeddings.1.weight': [new Array(256).fill(0.6)],
      'model.point_embeddings.2.weight': [new Array(256).fill(0.7)],
      'model.point_embeddings.3.weight': [new Array(256).fill(0.8)],
      'model.not_a_point_embed.weight': [new Array(256).fill(0.9)],
      'model.no_mask_embed.weight': [new Array(256).fill(1.0)],
    };

    const encoder = new PromptEncoder(mockWeights);

    it('should encode points correctly (no boxes)', () => {
      const points = {
        coords: [[100, 100]] as [number, number][],
        labels: [1],
      };
      const result = encoder.encode(points, null);
      expect(result.sparseDims).toEqual([1, 2, 256]);
      expect(result.denseDims).toEqual([1, 256, 64, 64]);
      expect(result.sparse.length).toBe(2 * 256);
    });

    it('should encode boxes correctly (no points)', () => {
      const boxes: [number, number, number, number][] = [[100, 100, 200, 200]];
      const result = encoder.encode(null, boxes);
      expect(result.sparseDims).toEqual([1, 2, 256]);
      expect(result.denseDims).toEqual([1, 256, 64, 64]);
      expect(result.sparse.length).toBe(2 * 256);
    });

    it('should encode both points and boxes correctly', () => {
      const points = {
        coords: [[100, 100]] as [number, number][],
        labels: [1],
      };
      const boxes: [number, number, number, number][] = [[100, 100, 200, 200]];
      const result = encoder.encode(points, boxes);
      // 1 point + 2 corner points = 3 points
      expect(result.sparseDims).toEqual([1, 3, 256]);
      expect(result.denseDims).toEqual([1, 256, 64, 64]);
      expect(result.sparse.length).toBe(3 * 256);
    });
  });
});
