import { state } from '../core/state';
import { ai } from '../core/ai';
import { BoundingBox, CanvasInteraction, Point, ResizeHandle } from '../core/types';
import { HitTester } from './HitTester';
import { Renderer } from './Renderer';

export class InteractionManager {
  interaction: CanvasInteraction | null = null;
  private lastMousePos: Point = { x: 0, y: 0 };
  private polygonCursorImgPos: Point | null = null;

  public getPolygonCursorPos(): Point | null {
    return this.polygonCursorImgPos;
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private container: HTMLElement,
    private hitTester: HitTester,
    private renderer: Renderer
  ) {
    this.initEventListeners();
  }

  private initEventListeners(): void {
    // Zoom (Ctrl + Scroll)
    this.canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
          this.handleZoom(e);
        }
      },
      { passive: false }
    );

    // Input Handling
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e: MouseEvent) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e: MouseEvent) => this.onMouseUp(e));

    // Deselect on click outside
    this.container.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.container) state.set({ selectedBoxId: null });
    });

    // Spacebar Panning
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (
          e.target instanceof HTMLElement &&
          (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
        ) {
          return;
        }
        e.preventDefault();
        if (!state.data.isPanning) {
          state.set({ isPanning: true });
          this.canvas.style.cursor = 'grab';
          document.getElementById('crosshair-v')?.classList.add('hidden');
          document.getElementById('crosshair-h')?.classList.add('hidden');
        }
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        state.set({ isPanning: false });
        const isDrawOrMagic = state.data.mode === 'draw' || state.data.mode === 'magic';
        this.canvas.style.cursor = isDrawOrMagic ? 'crosshair' : 'default';
      }
    });

    // Prevent Context Menu on Canvas (for right-click prompts)
    this.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
      if (state.data.mode === 'magic') e.preventDefault();
    });
  }

  private onMouseDown(e: MouseEvent): void {
    const { x, y } = this.getMousePos(e);
    const imgPos = this.screenToImage(x, y);

    console.log(`🎨 Canvas Click at Image Coords: [${Math.round(imgPos.x)}, ${Math.round(imgPos.y)}]`);

    // 1. Panning
    if (e.button === 1 || (e.button === 0 && (e.altKey || state.data.isPanning))) {
      this.interaction = { type: 'pan' };
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // 2. Magic / Draw Interaction for Segmentation
    const isSegTask = state.data.currentTask === 'segmentation';
    const isMagicOrSegDraw = state.data.mode === 'magic' || (state.data.mode === 'draw' && isSegTask);

    if (state.data.mode === 'polygon' && isSegTask) {
      if (e.button !== 0) return;
      const activePoly = state.data.activePolygon || [];
      
      if (activePoly.length > 0) {
        const startPt = activePoly[0];
        if (startPt) {
          const dist = Math.sqrt(Math.pow(imgPos.x - startPt[0], 2) + Math.pow(imgPos.y - startPt[1], 2));
          const pxDist = dist * state.data.zoom;
          if (pxDist < 10) {
            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            window.dispatchEvent(event);
            return;
          }
        }
      }
      
      state.set({ activePolygon: [...activePoly, [imgPos.x, imgPos.y]] });
      return;
    }

    if (isMagicOrSegDraw && state.data.currentImageBitmap) {
      this.interaction = {
        type: 'magic',
        startImgPos: imgPos,
        button: e.button,
        isDrag: false,
      };
      this.canvas.style.cursor = 'crosshair';
      return;
    }

    if (e.button !== 0) return;

    // 3. Interaction with existing boxes
    const hit = this.hitTester.hitTest(imgPos.x, imgPos.y);

    if (hit) {
      if (hit.handle === 'label') {
        this.renderer.showClassDropdown(hit.boxId, e.clientX, e.clientY);
        return;
      }

      state.set({ selectedBoxId: hit.boxId });

      const targetBox = state.data.annotations.find((b) => b.id === hit.boxId);
      if (!targetBox) return;

      if (hit.handle) {
        if (hit.handle.startsWith('vertex_')) {
          const vIdx = parseInt(hit.handle.split('_')[1]!, 10);
          this.interaction = {
            type: 'move_vertex',
            boxId: hit.boxId,
            vertexIndex: vIdx,
            startImgPos: imgPos,
            startPolygon: JSON.parse(JSON.stringify(targetBox.polygon)),
          };
        } else {
          this.interaction = {
            type: 'resize',
            handle: hit.handle as ResizeHandle,
            boxId: hit.boxId,
            startImgPos: imgPos,
            startBox: { ...targetBox },
          };
        }
      } else {
        this.interaction = {
          type: 'move',
          boxId: hit.boxId,
          startImgPos: imgPos,
          startBox: { ...targetBox },
        };
      }
      return;
    }

    // Draw mode - Create new box
    if (state.data.mode === 'draw' && !state.data.isPanning && state.data.currentImageBitmap) {
      const imgWidth = state.data.currentImageBitmap.width;
      const imgHeight = state.data.currentImageBitmap.height;

      const startX = Math.max(0, Math.min(imgPos.x, imgWidth));
      const startY = Math.max(0, Math.min(imgPos.y, imgHeight));

      const newId = Date.now();
      const newBox: BoundingBox = {
        id: newId,
        x: startX,
        y: startY,
        width: 0,
        height: 0,
        classId: state.data.selectedClassId !== null ? state.data.selectedClassId : -1,
      };

      state.saveHistory();
      state.set({
        annotations: [...state.data.annotations, newBox],
        selectedBoxId: newId,
      });

      this.interaction = {
        type: 'draw',
        boxId: newId,
        startImgPos: { x: startX, y: startY },
      };
    } else {
      state.set({ selectedBoxId: null });
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const { x, y } = this.getMousePos(e);
    const imgPos = this.screenToImage(x, y);

    if (state.data.mode === 'polygon') {
      this.polygonCursorImgPos = imgPos;
    } else {
      this.polygonCursorImgPos = null;
    }

    if (this.interaction) {
      if (this.interaction.type === 'pan') {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        state.set({ pan: { x: state.data.pan.x + dx, y: state.data.pan.y + dy } });
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }
      if (this.interaction.type === 'magic') {
        this.interaction.currentImgPos = imgPos;
        const dist = Math.sqrt(
          Math.pow(imgPos.x - this.interaction.startImgPos.x, 2) +
            Math.pow(imgPos.y - this.interaction.startImgPos.y, 2)
        );
        if (dist > 5) {
          this.interaction.isDrag = true;
        }
      }
      this.handleInteraction(imgPos);
    } else {
      const hit = this.hitTester.hitTest(imgPos.x, imgPos.y);
      state.set({ hoveredBoxId: hit ? hit.boxId : null });

      if (state.data.isPanning) {
        this.canvas.style.cursor = 'grab';
      } else if (hit) {
        if (hit.handle === 'label') {
          this.canvas.style.cursor = 'pointer';
        } else if (hit.handle) {
          if (hit.handle.startsWith('vertex_')) {
            this.canvas.style.cursor = 'move';
          } else {
            const cursorMap: Record<string, string> = {
              nw: 'nwse-resize', se: 'nwse-resize',
              ne: 'nesw-resize', sw: 'nesw-resize',
              n: 'ns-resize', s: 'ns-resize',
              e: 'ew-resize', w: 'ew-resize',
            };
            this.canvas.style.cursor = cursorMap[hit.handle] || 'crosshair';
          }
        } else {
          this.canvas.style.cursor = 'move';
        }
      } else {
        const isDrawOrMagic = state.data.mode === 'draw' || state.data.mode === 'magic';
        this.canvas.style.cursor = isDrawOrMagic ? 'crosshair' : 'default';
      }
    }

    this.updateCrosshair(e);
  }

  private onMouseUp(e: MouseEvent): void {
    if (this.interaction) {
      const { x, y } = this.getMousePos(e);
      const imgPos = this.screenToImage(x, y);

      if (this.interaction.type === 'move' || this.interaction.type === 'resize') {
        state.saveHistory();
      }

      if (this.interaction.type === 'draw') {
        const { boxId } = this.interaction;
        const box = state.data.annotations.find((b) => b.id === boxId);

        if (box) {
          if (box.width < 5 && box.height < 5) {
            state.set({
              annotations: state.data.annotations.filter((b) => b.id !== boxId),
              selectedBoxId: null,
            });
          } else {
            if (state.data.classes.length > 0) {
              this.renderer.showClassDropdown(boxId, e.clientX, e.clientY);
            } else {
              window.dispatchEvent(new CustomEvent('request-new-class', { detail: { boxId } }));
            }
          }
        }
      }

      if (this.interaction.type === 'magic') {
        const { startImgPos, isDrag, button } = this.interaction;
        if (!isDrag) {
          const label = button === 0 ? 1 : button === 2 ? 0 : null;
          if (label !== null) {
            this.handleMagicClick(startImgPos.x, startImgPos.y, label);
          }
        } else {
          if (this.interaction.currentImgPos) {
            const x1 = Math.min(startImgPos.x, this.interaction.currentImgPos.x);
            const y1 = Math.min(startImgPos.y, this.interaction.currentImgPos.y);
            const x2 = Math.max(startImgPos.x, this.interaction.currentImgPos.x);
            const y2 = Math.max(startImgPos.y, this.interaction.currentImgPos.y);
            this.handleMagicBox(x1, y1, x2, y2);
          }
        }
      }
    }

    this.interaction = null;
    this.canvas.style.cursor = state.data.isPanning ? 'grab' : 'default';
  }

  private handleInteraction(imgPos: Point): void {
    if (!state.data.currentImageBitmap || !this.interaction) return;
    if (this.interaction.type === 'pan' || this.interaction.type === 'magic') return;

    const { type, boxId, startImgPos } = this.interaction;
    const imgWidth = state.data.currentImageBitmap.width;
    const imgHeight = state.data.currentImageBitmap.height;

    const dx = imgPos.x - startImgPos.x;
    const dy = imgPos.y - startImgPos.y;

    const annotations = state.data.annotations.map((box) => {
      if (box.id !== boxId) return box;

      if (type === 'draw') {
        const curX = Math.max(0, Math.min(imgPos.x, imgWidth));
        const curY = Math.max(0, Math.min(imgPos.y, imgHeight));

        return {
          ...box,
          x: Math.min(startImgPos.x, curX),
          y: Math.min(startImgPos.y, curY),
          width: Math.abs(startImgPos.x - curX),
          height: Math.abs(startImgPos.y - curY),
        };
      }

      if (type === 'move_vertex') {
        const { vertexIndex, startPolygon } = this.interaction as any;
        const b = { ...box };
        const newPolygon = JSON.parse(JSON.stringify(startPolygon));
        
        newPolygon[vertexIndex][0] = Math.max(0, Math.min(startPolygon[vertexIndex][0] + dx, imgWidth));
        newPolygon[vertexIndex][1] = Math.max(0, Math.min(startPolygon[vertexIndex][1] + dy, imgHeight));
        
        b.polygon = newPolygon;
        
        const xs = newPolygon.map((p: any) => p[0]);
        const ys = newPolygon.map((p: any) => p[1]);
        b.x = Math.min(...xs);
        b.y = Math.min(...ys);
        b.width = Math.max(...xs) - b.x;
        b.height = Math.max(...ys) - b.y;
        
        return b;
      }

      const startBox = (this.interaction as any).startBox as BoundingBox | undefined;
      if (!startBox) return box;

      if (type === 'move') {
        let newX = startBox.x + dx;
        let newY = startBox.y + dy;

        newX = Math.max(0, Math.min(newX, imgWidth - startBox.width));
        newY = Math.max(0, Math.min(newY, imgHeight - startBox.height));

        const finalDx = newX - startBox.x;
        const finalDy = newY - startBox.y;

        const newBox = { ...box, x: newX, y: newY };
        if (startBox.polygon) {
           newBox.polygon = startBox.polygon.map(p => [p[0] + finalDx, p[1] + finalDy]);
        }
        return newBox;
      }

      if (type === 'resize') {
        const b = { ...box };
        const handle = (this.interaction as any).handle as ResizeHandle;
        if (handle.includes('e')) b.width = Math.max(5, Math.min(startBox.width + dx, imgWidth - startBox.x));
        if (handle.includes('s')) b.height = Math.max(5, Math.min(startBox.height + dy, imgHeight - startBox.y));
        if (handle.includes('w')) {
          const maxAllowedDx = startBox.x;
          const constrainedDx = Math.max(-maxAllowedDx, dx);
          const newWidth = Math.max(5, startBox.width - constrainedDx);
          b.x = startBox.x + (startBox.width - newWidth);
          b.width = newWidth;
        }
        if (handle.includes('n')) {
          const maxAllowedDy = startBox.y;
          const constrainedDy = Math.max(-maxAllowedDy, dy);
          const newHeight = Math.max(5, startBox.height - constrainedDy);
          b.y = startBox.y + (startBox.height - newHeight);
          b.height = newHeight;
        }
        
        if (startBox.polygon) {
          const scaleX = b.width / startBox.width;
          const scaleY = b.height / startBox.height;
          b.polygon = startBox.polygon.map(p => [
            b.x + (p[0] - startBox.x) * scaleX,
            b.y + (p[1] - startBox.y) * scaleY
          ]);
        }
        
        return b;
      }
      return box;
    });

    state.set({ annotations });
  }

  private getMousePos(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private handleZoom(e: WheelEvent): void {
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100);
    const newZoom = Math.min(Math.max(state.data.zoom * factor, 0.1), 20);

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - state.data.pan.x) / state.data.zoom;
    const worldY = (mouseY - state.data.pan.y) / state.data.zoom;

    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;

    state.set({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
  }

  private updateCrosshair(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const vLine = document.getElementById('crosshair-v');
    const hLine = document.getElementById('crosshair-h');

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height && !state.data.isPanning) {
      if (vLine) {
        vLine.classList.remove('hidden');
        vLine.style.left = `${x}px`;
      }
      if (hLine) {
        hLine.classList.remove('hidden');
        hLine.style.top = `${y}px`;
      }

      const imgCoord = this.screenToImage(x, y);
      const coordDisplay = document.getElementById('coord-display');
      if (coordDisplay) {
        coordDisplay.textContent = `X: ${Math.round(imgCoord.x)}, Y: ${Math.round(imgCoord.y)}`;
      }
    } else {
      vLine?.classList.add('hidden');
      hLine?.classList.add('hidden');
    }
  }

  private screenToImage(screenX: number, screenY: number): Point {
    return {
      x: (screenX - state.data.pan.x) / state.data.zoom,
      y: (screenY - state.data.pan.y) / state.data.zoom,
    };
  }

  async handleMagicClick(x: number, y: number, label: 0 | 1): Promise<void> {
    const newPoints = [...state.data.promptPoints, { x, y, label }];
    state.set({ promptPoints: newPoints });

    const mask = await ai.predictSAMMask(
      { coords: newPoints.map((p) => [p.x, p.y]), labels: newPoints.map((p) => p.label) },
      state.data.activePromptBox ? [state.data.activePromptBox] : null
    );

    state.set({ activeMask: mask });
  }

  async handleMagicBox(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    const box: [number, number, number, number] = [x1, y1, x2, y2];
    state.set({ activePromptBox: box });

    const mask = await ai.predictSAMMask(
      state.data.promptPoints.length > 0
        ? { coords: state.data.promptPoints.map((p) => [p.x, p.y]), labels: state.data.promptPoints.map((p) => p.label) }
        : null,
      [box]
    );

    state.set({ activeMask: mask });
  }
}
