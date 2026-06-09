import { useAppStore } from '../core/store';
import { Point } from '../core/types';
import { MathUtils } from '../utils/math';

export class HitTester {
  constructor(private ctx: CanvasRenderingContext2D) {}

  hitTest(x: number, y: number): { boxId: number; handle: string | null } | null {
    const { annotations, classes, zoom, selectedBoxId } = useAppStore.getState();
    const handleSize = 8 / zoom;
    const halfSize = handleSize / 2;

    // Check in reverse order (top boxes first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const box = annotations[i]!;
      const cls = classes.find((c) => c.id === box.classId);

      // 1. Check Label Hit (even if not selected)
      const name = cls ? cls.name : 'Pending...';
      const fontSize = 14 / zoom;
      this.ctx.font = `600 ${fontSize}px 'Inter', system-ui, sans-serif`;
      const padding = 5 / zoom;
      const chevronSize = 6 / zoom;
      const chevronGap = 6 / zoom;

      const textWidth = this.ctx.measureText(name).width;
      const bgWidth = textWidth + padding * 2 + chevronSize + chevronGap;
      const bgHeight = fontSize + padding * 2;

      if (x >= box.x && x <= box.x + bgWidth && y >= box.y - bgHeight && y <= box.y) {
        return { boxId: box.id, handle: 'label' };
      }

      // 2. Check handles if selected
      if (box.id === selectedBoxId) {
        if (box.polygon) {
          for (let v = 0; v < box.polygon.length; v++) {
            const px = box.polygon[v]![0];
            const py = box.polygon[v]![1];
            if (Math.abs(x - px) < halfSize && Math.abs(y - py) < halfSize) {
              return { boxId: box.id, handle: `vertex_${v}` };
            }
          }
        } else {
          const handles: Record<string, Point> = {
            nw: { x: box.x, y: box.y },
            n: { x: box.x + box.width / 2, y: box.y },
            ne: { x: box.x + box.width, y: box.y },
            e: { x: box.x + box.width, y: box.y + box.height / 2 },
            se: { x: box.x + box.width, y: box.y + box.height },
            s: { x: box.x + box.width / 2, y: box.y + box.height },
            sw: { x: box.x, y: box.y + box.height },
            w: { x: box.x, y: box.y + box.height / 2 },
          };

          for (const [name, pos] of Object.entries(handles)) {
            if (Math.abs(x - pos.x) < halfSize && Math.abs(y - pos.y) < halfSize) {
              return { boxId: box.id, handle: name };
            }
          }
        }
      }

      // 3. Check body
      if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
        if (box.polygon) {
          if (MathUtils.isPointInPolygon([x, y], box.polygon)) {
            return { boxId: box.id, handle: null };
          }
        } else {
          return { boxId: box.id, handle: null };
        }
      }
    }
    return null;
  }
}
