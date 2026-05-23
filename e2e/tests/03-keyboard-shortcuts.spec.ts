import { test, expect } from '@playwright/test';
import { SharpTensorApp } from '../helpers/app';
import { mockWorkerScript } from '../fixtures/mocks/worker';

test.describe('Keyboard Shortcuts', () => {
  let app: SharpTensorApp;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockWorkerScript);
    app = new SharpTensorApp(page);
    await app.goto();
    await app.clickQuickDemo();
    await app.waitForDemoReady();
  });

  test('should toggle draw mode on "w" and select mode on "v"', async () => {
    await app.pressKey('w');
    expect(await app.getInteractionMode()).toBe('draw');

    await app.pressKey('v');
    expect(await app.getInteractionMode()).toBe('select');
  });

  test('should switch tasks on "t"', async ({ page }) => {
    const btnTaskDet = page.locator('#task-det');
    const btnTaskSeg = page.locator('#task-seg');

    // Initially in detection task
    await expect(btnTaskDet).toHaveClass(/active-task-btn/);

    // Press 't' to toggle task mode
    await app.pressKey('t');
    await expect(btnTaskSeg).toHaveClass(/active-task-btn/);

    // Press 't' again to toggle back
    await app.pressKey('t');
    await expect(btnTaskDet).toHaveClass(/active-task-btn/);
  });
});
