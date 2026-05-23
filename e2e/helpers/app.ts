import { Page, expect } from '@playwright/test';

export class SharpTensorApp {
  constructor(public readonly page: Page) {}

  /**
   * Navigate to the base URL and wait for initial render
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    // Wait for the welcome overlay container to be present
    await this.page.waitForSelector('#welcome-modal', { state: 'visible' });
  }

  /**
   * Click the Quick Demo button on the welcome screen
   */
  async clickQuickDemo(): Promise<void> {
    const btn = this.page.locator('#welcome-demo');
    await btn.waitFor({ state: 'visible' });
    await btn.click();
    // Wait for welcome modal to hide/be removed or at least become display none
    await this.page.waitForSelector('#welcome-modal', { state: 'detached', timeout: 5000 });
  }

  /**
   * Wait for the demo load and AI model prediction to finish
   */
  async waitForDemoReady(): Promise<void> {
    // Demo sets status to "Demo Ready: Found X objects"
    await this.page.waitForFunction(
      () => {
        const statusEl = document.getElementById('status-message');
        return statusEl && statusEl.textContent?.includes('Demo Ready');
      },
      { timeout: 10000 }
    );
  }

  /**
   * Retrieve current annotation count from application state
   */
  async getAnnotationCount(): Promise<number> {
    return this.page.evaluate(() => {
      return (window as any).__state?.data.annotations.length ?? 0;
    });
  }

  /**
   * Retrieve current zoom level from application state
   */
  async getZoomLevel(): Promise<number> {
    return this.page.evaluate(() => {
      return (window as any).__state?.data.zoom ?? 1.0;
    });
  }

  /**
   * Get text content of the status message
   */
  async getStatusText(): Promise<string> {
    return this.page
      .locator('#status-message')
      .textContent()
      .then((t) => t?.trim() ?? '');
  }

  /**
   * Get interaction mode from state
   */
  async getInteractionMode(): Promise<string> {
    return this.page.evaluate(() => {
      return (window as any).__state?.data.mode ?? '';
    });
  }

  /**
   * Get current class list size
   */
  async getClassCount(): Promise<number> {
    return this.page.evaluate(() => {
      return (window as any).__state?.data.classes.length ?? 0;
    });
  }

  /**
   * Drag on canvas to draw a bounding box
   */
  async drawBox(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    const canvas = this.page.locator('#main-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found.');

    // Perform the drag and drop using coordinates relative to canvas top-left
    await this.page.mouse.move(box.x + x1, box.y + y1);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + x2, box.y + y2, { steps: 5 });
    await this.page.mouse.up();
  }

  /**
   * Click on canvas at coordinates relative to canvas top-left
   */
  async clickCanvas(x: number, y: number): Promise<void> {
    const canvas = this.page.locator('#main-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found.');

    await this.page.mouse.click(box.x + x, box.y + y);
  }

  /**
   * Key press helper
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }
}
