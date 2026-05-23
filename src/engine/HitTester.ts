import { state } from '../core/state';
import { Point } from '../core/types';

export class HitTester {
  constructor(private ctx: CanvasRenderingContext2D) {}

  hitTest(x: number, y: number): { boxId: number; handle: string | null } | null {
    const { annotations, classes, zoom, selectedBoxId } = state.data;
    const handleSize = 8 / zoom;
    const halfSize = handleSize / 2;

    // Check in reverse order (top boxes first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const box = annotations[i]!;
      const cls = classes.find((c) => c.id === box.classId);

      // 1. Check Label Hit (even if not selected)
      const name = cls ? cls.name : 'Pending...';
      const fontSize = 18 / zoom;
      this.ctx.font = `600 ${fontSize}px 'Inter', system-ui, sans-serif`;
      const padding = 6 / zoom;
      const chevronSize = 8 / zoom;
      const chevronGap = 8 / zoom;

      const textWidth = this.ctx.measureText(name).width;
      const bgWidth = textWidth + padding * 2 + chevronSize + chevronGap;
      const bgHeight = fontSize + padding * 2;

      if (x >= box.x && x <= box.x + bgWidth && y >= box.y - bgHeight && y <= box.y) {
        return { boxId: box.id, handle: 'label' };
      }

      // 2. Check handles if selected
      if (box.id === selectedBoxId) {
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

      // 3. Check body
      if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
        return { boxId: box.id, handle: null };
      }
    }
    return null;
  }
}
