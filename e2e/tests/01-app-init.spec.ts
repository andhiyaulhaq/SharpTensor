import { test, expect } from '@playwright/test';
import { SharpTensorApp } from '../helpers/app';
import { mockWorkerScript } from '../fixtures/mocks/worker';

test.describe('App Initialization', () => {
  test.beforeEach(async ({ page }) => {
    // Forward browser logs to Node console for debugging
    page.on('console', msg => console.log('🌐 BROWSER:', msg.text()));
    page.on('pageerror', err => console.error('❌ BROWSER ERROR:', err.message));

    // Add Worker mock prior to page loading
    await page.addInitScript(mockWorkerScript);
  });

  test('should boot application and display welcome screen', async ({ page }) => {
    const app = new SharpTensorApp(page);
    await app.goto();

    // Check Welcome Experience modal and UI elements
    const welcomeModal = page.locator('#welcome-modal');
    await expect(welcomeModal).toBeVisible();

    const welcomeTitle = welcomeModal.locator('.welcome-logo');
    await expect(welcomeTitle).toBeVisible();

    const demoBtn = welcomeModal.locator('#welcome-demo');
    await expect(demoBtn).toContainText('Quick Demo');

    const openFolderBtn = welcomeModal.locator('#welcome-open');
    await expect(openFolderBtn).toContainText('Open Project');
  });

  test('should dismiss welcome overlay and load workspace on demo trigger', async ({ page }) => {
    const app = new SharpTensorApp(page);
    await app.goto();

    // Click "Quick Demo"
    await app.clickQuickDemo();

    // Verify main app layout is visible
    const workspace = page.locator('#workspace');
    await expect(workspace).toBeVisible();

    const canvas = page.locator('#main-canvas');
    await expect(canvas).toBeVisible();

    // Wait for demo scene predictions to be populated
    await app.waitForDemoReady();

    // Verify predictions were loaded (from our MockWorker)
    const count = await app.getAnnotationCount();
    expect(count).toBeGreaterThan(0);

    const imageCounter = page.locator('#image-counter');
    await expect(imageCounter).toHaveText('1 / 1');

    const statusText = await app.getStatusText();
    expect(statusText).toContain('Demo Ready');
  });
});
