import { state } from '../core/state';
import { ai } from '../core/ai';
import { YoloHelper } from '../utils/yolo';
import { BoundingBox, CanvasInteraction, Point, ResizeHandle } from '../core/types';

/**
 * SharpTensor Canvas Engine
 * Handles high-performance rendering and coordinate transformations.
 */
export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private dpr = 1;
  private logicalWidth = 0;
  private logicalHeight = 0;

  private interaction: CanvasInteraction | null = null;
  private lastMousePos: Point = { x: 0, y: 0 };

  constructor(canvasId: string) {
    const canvasEl = document.getElementById(canvasId);
    if (!(canvasEl instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas element with id "${canvasId}" not found.`);
    }
    this.canvas = canvasEl;

    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to obtain 2D rendering context.');
    }
    this.ctx = context;

    const containerEl = document.getElementById('workspace');
    if (!containerEl) {
      throw new Error('Workspace container element not found.');
    }
    this.container = containerEl;

    this.setupCanvas();
    this.initEventListeners();
    this.startRenderLoop();
  }

  setupCanvas(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.container.getBoundingClientRect();

    // Logical dimensions
    this.logicalWidth = rect.width;
    this.logicalHeight = rect.height;

    this.canvas.width = this.logicalWidth * this.dpr;
    this.canvas.height = this.logicalHeight * this.dpr;
    this.canvas.style.width = `${this.logicalWidth}px`;
    this.canvas.style.height = `${this.logicalHeight}px`;

    // Use setTransform to avoid cumulative scaling from multiple resize events
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Immediate redraw to prevent flickering during resize
    this.draw();
  }

  initEventListeners(): void {
    // Elite Layout Tracking
    const resizeObserver = new ResizeObserver(() => this.setupCanvas());
    resizeObserver.observe(this.container);

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

  onMouseDown(e: MouseEvent): void {
    const { x, y } = this.getMousePos(e);
    const imgPos = this.screenToImage(x, y);

    console.log(
      `🎨 Canvas Click at Image Coords: [${Math.round(imgPos.x)}, ${Math.round(imgPos.y)}]`
    );

    // 1. Panning (Middle Click, Alt+Left, or Spacebar)
    if (e.button === 1 || (e.button === 0 && (e.altKey || state.data.isPanning))) {
      this.interaction = { type: 'pan' };
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // 2. Magic / Draw Interaction for Segmentation (Box prompt)
    const isSegTask = state.data.currentTask === 'segmentation';
    const isMagicOrSegDraw =
      state.data.mode === 'magic' || (state.data.mode === 'draw' && isSegTask);

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

    // 3. Interaction with existing boxes (Select / Move / Resize / Label Dropdown)
    const hit = this.hitTest(imgPos.x, imgPos.y);

    if (hit) {
      if (hit.handle === 'label') {
        this.showClassDropdown(hit.boxId, e.clientX, e.clientY);
        return;
      }

      state.set({ selectedBoxId: hit.boxId });

      const targetBox = state.data.annotations.find((b) => b.id === hit.boxId);
      if (!targetBox) return;

      if (hit.handle) {
        this.interaction = {
          type: 'resize',
          handle: hit.handle as ResizeHandle,
          boxId: hit.boxId,
          startImgPos: imgPos,
          startBox: { ...targetBox },
        };
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

      // Constrain start position
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

      state.saveHistory(); // Save state before adding new box
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

  onMouseMove(e: MouseEvent): void {
    const { x, y } = this.getMousePos(e);
    const imgPos = this.screenToImage(x, y);

    // Box Interaction
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
      // Hover check
      const hit = this.hitTest(imgPos.x, imgPos.y);
      state.set({ hoveredBoxId: hit ? hit.boxId : null });

      if (state.data.isPanning) {
        this.canvas.style.cursor = 'grab';
      } else if (hit) {
        if (hit.handle === 'label') {
          this.canvas.style.cursor = 'pointer';
        } else if (hit.handle) {
          const cursorMap: Record<string, string> = {
            nw: 'nwse-resize',
            se: 'nwse-resize',
            ne: 'nesw-resize',
            sw: 'nesw-resize',
            n: 'ns-resize',
            s: 'ns-resize',
            e: 'ew-resize',
            w: 'ew-resize',
          };
          this.canvas.style.cursor = cursorMap[hit.handle] || 'crosshair';
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

  onMouseUp(e: MouseEvent): void {
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
              this.showClassDropdown(boxId, e.clientX, e.clientY);
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

  handleInteraction(imgPos: Point): void {
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

      const startBox = (this.interaction as any).startBox as BoundingBox | undefined;
      if (!startBox) return box;

      if (type === 'move') {
        let newX = startBox.x + dx;
        let newY = startBox.y + dy;

        // Constrain position
        newX = Math.max(0, Math.min(newX, imgWidth - startBox.width));
        newY = Math.max(0, Math.min(newY, imgHeight - startBox.height));

        return { ...box, x: newX, y: newY };
      }

      if (type === 'resize') {
        const b = { ...box };
        const handle = (this.interaction as any).handle as ResizeHandle;
        if (handle.includes('e')) {
          b.width = Math.max(5, Math.min(startBox.width + dx, imgWidth - startBox.x));
        }
        if (handle.includes('s')) {
          b.height = Math.max(5, Math.min(startBox.height + dy, imgHeight - startBox.y));
        }
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
        return b;
      }
      return box;
    });

    state.set({ annotations });
  }

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

  getMousePos(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  handleZoom(e: WheelEvent): void {
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100); // Smooth exponential zoom

    const newZoom = Math.min(Math.max(state.data.zoom * factor, 0.1), 20);

    // Zoom towards mouse position
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate the mouse position in "Image Space" before zoom
    const worldX = (mouseX - state.data.pan.x) / state.data.zoom;
    const worldY = (mouseY - state.data.pan.y) / state.data.zoom;

    // Update pan to keep the mouse point stable
    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;

    state.set({
      zoom: newZoom,
      pan: { x: newPanX, y: newPanY },
    });
  }

  updateCrosshair(e: MouseEvent): void {
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

      // Update coordinate display
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

  /**
   * Convert Screen coordinates to Image pixels
   */
  screenToImage(screenX: number, screenY: number): Point {
    return {
      x: (screenX - state.data.pan.x) / state.data.zoom,
      y: (screenY - state.data.pan.y) / state.data.zoom,
    };
  }

  startRenderLoop(): void {
    const render = () => {
      this.draw();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  draw(): void {
    const { zoom, pan, currentImageBitmap, annotations } = state.data;

    // 1. Clear with Theme Background (using logical dimensions)
    this.ctx.fillStyle = '#242C2E';
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    // 2. Draw Subtle Grid
    this.drawGrid(zoom, pan);

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
    this.drawPromptBox();

    this.ctx.restore();
  }

  drawPromptBox(): void {
    if (this.interaction && this.interaction.type === 'magic' && this.interaction.isDrag) {
      const { startImgPos, currentImgPos, button } = this.interaction;
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

  drawSAMOverlay(): void {
    const { activeMask, promptPoints, zoom, currentImageBitmap } = state.data;
    if (!currentImageBitmap) return;

    // Draw active mask (Glassmorphic Cyan)
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

    // Draw prompt points
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

  async handleMagicClick(x: number, y: number, label: 0 | 1): Promise<void> {
    const newPoints = [...state.data.promptPoints, { x, y, label }];
    state.set({ promptPoints: newPoints });

    const mask = await ai.predictSAMMask(
      {
        coords: newPoints.map((p) => [p.x, p.y]),
        labels: newPoints.map((p) => p.label),
      },
      state.data.activePromptBox ? [state.data.activePromptBox] : null
    );

    state.set({ activeMask: mask });
  }

  async handleMagicBox(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    const box: [number, number, number, number] = [x1, y1, x2, y2];
    state.set({ activePromptBox: box });

    const mask = await ai.predictSAMMask(
      state.data.promptPoints.length > 0
        ? {
            coords: state.data.promptPoints.map((p) => [p.x, p.y]),
            labels: state.data.promptPoints.map((p) => p.label),
          }
        : null,
      [box]
    );

    state.set({ activeMask: mask });
  }

  drawGrid(zoom: number, pan: Point): void {
    const gridSize = 32 * zoom;
    const offsetX = pan.x % gridSize;
    const offsetY = pan.y % gridSize;

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;

    for (let x = offsetX; x < this.logicalWidth; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.logicalHeight);
    }
    for (let y = offsetY; y < this.logicalHeight; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.logicalWidth, y);
    }
    this.ctx.stroke();
  }

  drawAnnotations(annotations: BoundingBox[]): void {
    const { selectedBoxId, zoom, classes } = state.data;

    const drawBox = (box: BoundingBox) => {
      const isSelected = box.id === selectedBoxId;
      const cls = classes.find((c) => c.id === box.classId);
      const color = cls ? cls.color : '#E7F243';

      this.ctx.save();

      // 1. Draw Box Body (Subtle fill)
      // 2. Draw Polygon or Box Border
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2 / zoom;

      if (box.polygon && box.polygon.length > 0) {
        // Draw Polygon
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
        // Standard Box
        this.ctx.strokeRect(box.x, box.y, box.width, box.height);
        if (isSelected) {
          this.ctx.fillStyle = YoloHelper.withAlpha(color, 0.25);
          this.ctx.fillRect(box.x, box.y, box.width, box.height);
        }
      }

      // 3. Draw Handles (only for selected)
      if (isSelected) {
        this.drawHandles(box, color);
      }

      // 4. Draw Label
      const label = cls ? cls.name : 'Pending...';
      this.drawLabel(box, label, color);

      this.ctx.restore();
    };

    // Draw all unselected boxes first
    annotations.forEach((box) => {
      if (box.id !== selectedBoxId) drawBox(box);
    });

    // Draw the selected box last (so it renders on top)
    annotations.forEach((box) => {
      if (box.id === selectedBoxId) drawBox(box);
    });
  }

  drawHandles(box: BoundingBox, color: string): void {
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

  drawLabel(box: BoundingBox, name: string, color: string): void {
    const fontSize = 18 / state.data.zoom;
    this.ctx.font = `600 ${fontSize}px 'Inter', system-ui, sans-serif`;

    const padding = 6 / state.data.zoom;
    const chevronSize = 8 / state.data.zoom;
    const chevronGap = 8 / state.data.zoom;

    const textWidth = this.ctx.measureText(name).width;
    const bgWidth = textWidth + padding * 2 + chevronSize + chevronGap;
    const bgHeight = fontSize + padding * 2;

    // 1. Background
    this.ctx.fillStyle = color;
    this.ctx.fillRect(box.x, box.y - bgHeight, bgWidth, bgHeight);

    // 2. Text (Adaptive Contrast)
    const contrastColor = YoloHelper.getContrastColor(color);
    this.ctx.fillStyle = contrastColor;
    this.ctx.fillText(name, box.x + padding, box.y - padding);

    // 3. Chevron Hint (Small downward triangle)
    const cx = box.x + padding + textWidth + chevronGap;
    const cy = box.y - padding - fontSize / 2.5; // Adjust for vertical alignment

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(cx + chevronSize, cy);
    this.ctx.lineTo(cx + chevronSize / 2, cy + chevronSize / 2);
    this.ctx.closePath();
    this.ctx.fill();
  }

  showClassDropdown(boxId: number, clientX: number, clientY: number): void {
    // Cleanup existing dropdown
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

        const box = state.data.annotations.find((b) => b.id === boxId);
        // Only save history if we are REASSIGNING an existing label.
        // If it's a new box (classId === -1), the "draw" start was already saved.
        if (box && box.classId !== -1) {
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

    // Close on click outside
    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        window.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => window.addEventListener('mousedown', closeHandler), 10);
  }
}
