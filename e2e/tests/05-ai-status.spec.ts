import { test, expect } from '@playwright/test';
import { SharpTensorApp } from '../helpers/app';
import { mockWorkerScript } from '../fixtures/mocks/worker';

test.describe('AI Worker Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockWorkerScript);
  });

  test('should display active models state and update model status badge', async ({ page }) => {
    const app = new SharpTensorApp(page);
    await app.goto();

    // Verify loading models updates the badge to loaded model
    const modelStatusBadge = page.locator('#model-status-badge');
    await expect(modelStatusBadge).toHaveText('RT-DETR');

    // Load Quick Demo
    await app.clickQuickDemo();
    await app.waitForDemoReady();

    // AI Logs element should show processing messages
    const aiLogs = page.locator('#ai-logs');
    await expect(aiLogs).toBeVisible();

    const logEntry = aiLogs.locator('.log-entry');
    await expect(logEntry.first()).toBeVisible();
  });
});
