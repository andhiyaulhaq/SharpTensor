import { state } from '../core/state';
import { ai } from '../core/ai';
import { YoloHelper } from '../utils/yolo';
import { BoundingBox, CanvasInteraction, Point } from '../core/types';

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  draw(logicalWidth: number, logicalHeight: number, interaction: CanvasInteraction | null): void {
    const { zoom, pan, currentImageBitmap, annotations } = state.data;

    // 1. Clear with Theme Background
    this.ctx.fillStyle = '#242C2E';
    this.ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // 2. Draw Subtle Grid
    this.drawGrid(zoom, pan, logicalWidth, logicalHeight);

    this.ctx.save();
    this.ctx.translate(pan.x, pan.y);
    this.ctx.scale(zoom, zoom);

    // 3. Draw Image
    if (currentImageBitmap) {
      this.ctx.drawImage(currentImageBitmap, 0, 0);
    }

    // 4. Draw Annotations
    this.drawAnnotations(annotations);

    // 5. Draw SAM Active Mask and Points
    this.drawSAMOverlay();

    // 6. Draw Prompt Box (if dragging in magic mode)
    this.drawPromptBox(interaction);

    this.ctx.restore();
  }

  private drawPromptBox(interaction: CanvasInteraction | null): void {
    if (interaction && interaction.type === 'magic' && interaction.isDrag) {
      const { startImgPos, currentImgPos, button } = interaction;
      if (!currentImgPos) return;

      const x = Math.min(startImgPos.x, currentImgPos.x);
      const y = Math.min(startImgPos.y, currentImgPos.y);
      const w = Math.abs(startImgPos.x - currentImgPos.x);
      const h = Math.abs(startImgPos.y - currentImgPos.y);

      const isExclude = button === 2;
      const color = isExclude ? '#ef4444' : '#06b6d4';

      this.ctx.save();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2 / state.data.zoom;
      this.ctx.strokeRect(x, y, w, h);

      this.ctx.fillStyle = isExclude ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)';
      this.ctx.fillRect(x, y, w, h);
      this.ctx.restore();
    }
  }

  private drawSAMOverlay(): void {
    const { activeMask, promptPoints, zoom, currentImageBitmap } = state.data;
    if (!currentImageBitmap) return;

    if (activeMask) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = currentImageBitmap.width;
      tempCanvas.height = currentImageBitmap.height;
      const tctx = tempCanvas.getContext('2d');
      if (tctx) {
        const imgData = tctx.createImageData(tempCanvas.width, tempCanvas.height);
        for (let i = 0; i < activeMask.length; i++) {
          if (activeMask[i] === 1) {
            imgData.data[i * 4] = 0;
            imgData.data[i * 4 + 1] = 255;
            imgData.data[i * 4 + 2] = 255;
            imgData.data[i * 4 + 3] = 100; // Alpha
          }
        }
        tctx.putImageData(imgData, 0, 0);
        this.ctx.drawImage(tempCanvas, 0, 0);
      }
    }

    promptPoints.forEach((p) => {
      this.ctx.beginPath();
      this.ctx.fillStyle = p.label === 1 ? '#22c55e' : '#ef4444';
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2 / zoom;
      this.ctx.arc(p.x, p.y, 5 / zoom, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    });
  }

  private drawGrid(zoom: number, pan: Point, logicalWidth: number, logicalHeight: number): void {
    const gridSize = 32 * zoom;
    const offsetX = pan.x % gridSize;
    const offsetY = pan.y % gridSize;

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;

    for (let x = offsetX; x < logicalWidth; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, logicalHeight);
    }
    for (let y = offsetY; y < logicalHeight; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(logicalWidth, y);
    }
    this.ctx.stroke();
  }

  private drawAnnotations(annotations: BoundingBox[]): void {
    const { selectedBoxId, zoom, classes } = state.data;

    const drawBox = (box: BoundingBox) => {
      const isSelected = box.id === selectedBoxId;
      const cls = classes.find((c) => c.id === box.classId);
      const color = cls ? cls.color : '#E7F243';

      this.ctx.save();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2 / zoom;

      if (box.polygon && box.polygon.length > 0) {
        this.ctx.beginPath();
        const startPoint = box.polygon[0];
        if (startPoint) {
          this.ctx.moveTo(startPoint[0], startPoint[1]);
          for (let i = 1; i < box.polygon.length; i++) {
            const p = box.polygon[i];
            if (p) this.ctx.lineTo(p[0], p[1]);
          }
        }
        this.ctx.closePath();
        this.ctx.stroke();

        if (isSelected) {
          this.ctx.fillStyle = YoloHelper.withAlpha(color, 0.25);
          this.ctx.fill();
        }
      } else {
        this.ctx.strokeRect(box.x, box.y, box.width, box.height);
        if (isSelected) {
          this.ctx.fillStyle = YoloHelper.withAlpha(color, 0.25);
          this.ctx.fillRect(box.x, box.y, box.width, box.height);
        }
      }

      if (isSelected) {
        this.drawHandles(box, color);
      }

      const label = cls ? cls.name : 'Pending...';
      this.drawLabel(box, label, color);

      this.ctx.restore();
    };

    annotations.forEach((box) => {
      if (box.id !== selectedBoxId) drawBox(box);
    });

    annotations.forEach((box) => {
      if (box.id === selectedBoxId) drawBox(box);
    });
  }

  private drawHandles(box: BoundingBox, color: string): void {
    const size = 8 / state.data.zoom;
    this.ctx.fillStyle = '#fff';
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1 / state.data.zoom;

    const handles: Point[] = [
      { x: box.x, y: box.y }, // nw
      { x: box.x + box.width / 2, y: box.y }, // n
      { x: box.x + box.width, y: box.y }, // ne
      { x: box.x + box.width, y: box.y + box.height / 2 }, // e
      { x: box.x + box.width, y: box.y + box.height }, // se
      { x: box.x + box.width / 2, y: box.y + box.height }, // s
      { x: box.x, y: box.y + box.height }, // sw
      { x: box.x, y: box.y + box.height / 2 }, // w
    ];

    handles.forEach((pos) => {
      this.ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
      this.ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
    });
  }

  private drawLabel(box: BoundingBox, name: string, color: string): void {
    const fontSize = 18 / state.data.zoom;
    this.ctx.font = `600 ${fontSize}px 'Inter', system-ui, sans-serif`;

    const padding = 6 / state.data.zoom;
    const chevronSize = 8 / state.data.zoom;
    const chevronGap = 8 / state.data.zoom;

    const textWidth = this.ctx.measureText(name).width;
    const bgWidth = textWidth + padding * 2 + chevronSize + chevronGap;
    const bgHeight = fontSize + padding * 2;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(box.x, box.y - bgHeight, bgWidth, bgHeight);

    const contrastColor = YoloHelper.getContrastColor(color);
    this.ctx.fillStyle = contrastColor;
    this.ctx.fillText(name, box.x + padding, box.y - padding);

    const cx = box.x + padding + textWidth + chevronGap;
    const cy = box.y - padding - fontSize / 2.5;

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(cx + chevronSize, cy);
    this.ctx.lineTo(cx + chevronSize / 2, cy + chevronSize / 2);
    this.ctx.closePath();
    this.ctx.fill();
  }

  showClassDropdown(boxId: number, clientX: number, clientY: number): void {
    const existing = document.getElementById('class-dropdown-overlay');
    if (existing) existing.remove();

    const dropdown = document.createElement('div');
    dropdown.id = 'class-dropdown-overlay';
    dropdown.className = 'class-dropdown';
    dropdown.style.left = `${clientX}px`;
    dropdown.style.top = `${clientY}px`;

    const box = state.data.annotations.find((b) => b.id === boxId);

    state.data.classes.forEach((cls) => {
      const isCurrent = cls.id === box?.classId;
      const item = document.createElement('div');
      item.className = `dropdown-item ${isCurrent ? 'active' : ''}`;
      item.innerHTML = `
                <span class="color-dot" style="background: ${cls.color}"></span>
                <span class="class-name">${cls.name}</span>
                ${isCurrent ? '<span class="check-icon">✓</span>' : ''}
            `;
      item.onclick = (e) => {
        e.stopPropagation();

        const boxToUpdate = state.data.annotations.find((b) => b.id === boxId);
        if (boxToUpdate && boxToUpdate.classId !== -1) {
          state.saveHistory();
        }

        const annotations = state.data.annotations.map((b) =>
          b.id === boxId ? { ...b, classId: cls.id } : b
        );
        state.set({ annotations });
        dropdown.remove();
      };
      dropdown.appendChild(item);
    });

    document.body.appendChild(dropdown);

    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        window.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => window.addEventListener('mousedown', closeHandler), 10);
  }
}
