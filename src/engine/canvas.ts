import { HitTester } from './HitTester';
import { Renderer } from './Renderer';
import { InteractionManager } from './InteractionManager';

/**
 * SharpTensor Canvas Engine
 * Orchestrates rendering, interaction, and coordinate calculations.
 */
export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private dpr = 1;
  private logicalWidth = 0;
  private logicalHeight = 0;

  private renderer: Renderer;
  private interactionManager: InteractionManager;
  private hitTester: HitTester;

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

    // Initialize modules
    this.hitTester = new HitTester(this.ctx);
    this.renderer = new Renderer(this.ctx);
    this.interactionManager = new InteractionManager(this.canvas, this.container, this.hitTester, this.renderer);

    this.setupCanvas();
    const resizeObserver = new ResizeObserver(() => this.setupCanvas());
    resizeObserver.observe(this.container);

    this.startRenderLoop();
  }

  private setupCanvas(): void {
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

  private startRenderLoop(): void {
    const render = () => {
      this.draw();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  draw(): void {
    this.renderer.draw(
      this.logicalWidth, 
      this.logicalHeight, 
      this.interactionManager.interaction,
      this.interactionManager.getPolygonCursorPos()
    );
  }

  // Public methods needed by WorkspaceManager or Main
  handleMagicBox(x1: number, y1: number, x2: number, y2: number): void {
    this.interactionManager.handleMagicBox(x1, y1, x2, y2);
  }

  showClassDropdown(boxId: number, clientX: number, clientY: number): void {
    this.renderer.showClassDropdown(boxId, clientX, clientY);
  }
}
