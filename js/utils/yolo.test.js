import { describe, it, expect, vi } from 'vitest';
import { YoloHelper } from './yolo.js';

describe('YoloHelper', () => {
  describe('toYolo', () => {
    it('should convert pixel coordinates to YOLO format', () => {
      const box = { classId: 1, x: 100, y: 100, width: 200, height: 200 };
      const imgWidth = 800;
      const imgHeight = 800;

      // center x = 200/800 = 0.25
      // center y = 200/800 = 0.25
      // width = 200/800 = 0.25
      // height = 200/800 = 0.25

      const result = YoloHelper.toYolo(box, imgWidth, imgHeight);
      expect(result).toBe('1 0.250000 0.250000 0.250000 0.250000');
    });
  });

  describe('toYoloSeg', () => {
    it('should convert polygon to YOLO seg format', () => {
      const box = {
        classId: 2,
        polygon: [
          [100, 100],
          [200, 100],
          [200, 200],
          [100, 200],
        ],
      };
      const imgWidth = 1000;
      const imgHeight = 1000;

      const result = YoloHelper.toYoloSeg(box, imgWidth, imgHeight);
      expect(result).toBe(
        '2 0.100000 0.100000 0.200000 0.100000 0.200000 0.200000 0.100000 0.200000'
      );
    });

    it('should fallback to bounding box if no polygon', () => {
      const box = { classId: 1, x: 100, y: 100, width: 200, height: 200 };
      const result = YoloHelper.toYoloSeg(box, 800, 800);
      expect(result).toBe('1 0.250000 0.250000 0.250000 0.250000');
    });
  });

  describe('fromYolo', () => {
    it('should parse standard YOLO box', () => {
      const line = '1 0.25 0.25 0.25 0.25';
      const imgWidth = 800;
      const imgHeight = 800;

      vi.spyOn(global.Math, 'random').mockReturnValue(0.5);
      vi.spyOn(Date, 'now').mockReturnValue(1000);

      const result = YoloHelper.fromYolo(line, imgWidth, imgHeight);

      expect(result).toMatchObject({
        classId: 1,
        x: 100, // 0.25 * 800 - (0.25 * 800 / 2) = 200 - 100 = 100
        y: 100,
        width: 200,
        height: 200,
      });
      expect(result).toHaveProperty('id');

      vi.restoreAllMocks();
    });

    it('should parse YOLO segmentation polygon', () => {
      const line = '2 0.1 0.1 0.2 0.1 0.2 0.2 0.1 0.2';
      const imgWidth = 1000;
      const imgHeight = 1000;

      const result = YoloHelper.fromYolo(line, imgWidth, imgHeight);

      expect(result).toMatchObject({
        classId: 2,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        polygon: [
          [100, 100],
          [200, 100],
          [200, 200],
          [100, 200],
        ],
      });
    });

    it('should return null for invalid strings', () => {
      expect(YoloHelper.fromYolo('invalid string', 800, 800)).toBeNull();
      expect(YoloHelper.fromYolo('1 0.5 0.5', 800, 800)).toBeNull();
    });
  });

  describe('parseClasses', () => {
    it('should parse classes file content', () => {
      const content = 'person\ncar\nbike\n\n';
      const result = YoloHelper.parseClasses(content);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ id: 0, name: 'person' });
      expect(result[1]).toMatchObject({ id: 1, name: 'car' });
      expect(result[2]).toMatchObject({ id: 2, name: 'bike' });
      expect(result[0]).toHaveProperty('color');
    });
  });

  describe('Colors', () => {
    it('withAlpha should inject alpha', () => {
      expect(YoloHelper.withAlpha('hsl(100, 50%, 50%)', 0.5)).toBe('hsla(100, 50%, 50%, 0.5)');
      expect(YoloHelper.withAlpha('#ff0000', 0.5)).toBe('#ff000080'); // 128 in hex is 80
      expect(YoloHelper.withAlpha(null)).toBe('rgba(255, 255, 255, 0.25)');
    });

    it('getContrastColor should return black or white', () => {
      expect(YoloHelper.getContrastColor('#ffffff')).toBe('#000000');
      expect(YoloHelper.getContrastColor('#000000')).toBe('#ffffff');
      expect(YoloHelper.getContrastColor('hsl(0, 100%, 90%)')).toBe('#000000');
      expect(YoloHelper.getContrastColor('hsl(0, 100%, 10%)')).toBe('#ffffff');
      expect(YoloHelper.getContrastColor(null)).toBe('#ffffff');
    });
  });
});
