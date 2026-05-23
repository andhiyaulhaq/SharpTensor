import { test, expect } from '@playwright/test';
import { SharpTensorApp } from '../helpers/app';
import { mockWorkerScript } from '../fixtures/mocks/worker';

test.describe('Class Management & Modals', () => {
  let app: SharpTensorApp;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockWorkerScript);
    app = new SharpTensorApp(page);
    await app.goto();
    await app.clickQuickDemo();
    await app.waitForDemoReady();
  });

  test('should display classes in the sidebar section', async ({ page }) => {
    // Verify default class list items are loaded
    const classItems = page.locator('#class-list .class-item');
    await expect(classItems).toHaveCount(2);

    const firstClassLabel = classItems.first().locator('.class-name');
    await expect(firstClassLabel).toHaveText('Person');

    const secondClassLabel = classItems.nth(1).locator('.class-name');
    await expect(secondClassLabel).toHaveText('Car');
  });

  test('should allow opening new class modal dialog', async ({ page }) => {
    const addClassBtn = page.locator('#btn-add-class');
    await addClassBtn.click();

    // Verify modal element class is shown (removes hidden class, or shows)
    const modal = page.locator('#app-modal .modal-root');
    await expect(modal).toBeVisible();

    // Modal should contain title text
    const modalTitle = modal.locator('.modal-title');
    await expect(modalTitle).toContainText('Define New Class');

    // Click cancel button on modal to dismiss it
    const cancelBtn = modal.locator('.modal-cancel');
    await cancelBtn.click();

    // Verify modal is dismissed
    await expect(modal).toBeHidden();
  });
});
