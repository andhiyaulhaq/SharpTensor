import { test, expect } from '@playwright/test';
import { SharpTensorApp } from '../helpers/app';
import { mockWorkerScript } from '../fixtures/mocks/worker';

test.describe('Canvas Interactions', () => {
  let app: SharpTensorApp;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockWorkerScript);
    app = new SharpTensorApp(page);
    await app.goto();
    await app.clickQuickDemo();
    await app.waitForDemoReady();
  });

  test('should allow toggling between select and draw interaction modes', async ({ page }) => {
    // Select tool buttons
    const btnSelect = page.locator('#btn-select');
    const btnDraw = page.locator('#btn-draw');

    // Initially in select mode (default)
    await expect(btnSelect).toHaveClass(/active/);

    // Switch to Draw Mode
    await app.pressKey('w');
    await expect(btnDraw).toHaveClass(/active/);
    expect(await app.getInteractionMode()).toBe('draw');

    // Switch back to Select Mode
    await app.pressKey('v');
    await expect(btnSelect).toHaveClass(/active/);
    expect(await app.getInteractionMode()).toBe('select');
  });

  test('should add a bounding box annotation on canvas drag', async ({ page }) => {
    // Switch to Draw Mode
    await app.pressKey('w');

    const initialCount = await app.getAnnotationCount();

    // Drag mouse to draw a box on canvas
    await app.drawBox(200, 200, 400, 400);

    // Verify annotation was successfully added in state
    const newCount = await app.getAnnotationCount();
    expect(newCount).toBe(initialCount + 1);

    // Verify annotation count badge in UI
    const boxCountBadge = page.locator('#box-count');
    await expect(boxCountBadge).toHaveText(newCount.toString());
  });

  test('should delete an annotation when selecting it and pressing Delete', async ({ page }) => {
    // Make sure we are in select mode
    await app.pressKey('v');

    const initialCount = await app.getAnnotationCount();
    expect(initialCount).toBeGreaterThan(0);

    // Click on canvas where an annotation exists (our mock worker created one at x=200, y=80 relative to image)
    // Canvas is at center, let's just click near center
    await app.clickCanvas(250, 120);

    // Press delete key
    await app.pressKey('Delete');

    // Verify state updated
    const afterDeleteCount = await app.getAnnotationCount();
    expect(afterDeleteCount).toBe(initialCount - 1);
  });
});
