import { test, expect } from '@playwright/test';

test.describe('Workflows Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows');
  });

  test('page loads with module overview cards', async ({ page }) => {
    await expect(page.locator('.page')).toBeVisible();
    await expect(page.locator('h1, .page-title')).toContainText('Workflows');

    // Should have 5 module cards
    const moduleCards = page.locator('.module-card');
    await expect(moduleCards).toHaveCount(5);
  });

  test('module cards link to correct pages', async ({ page }) => {
    const links = ['/kanban', '/reminders', '/notes', '/bookmarks', '/keeper'];
    for (const href of links) {
      await expect(page.locator(`.module-card[href="${href}"]`)).toBeVisible();
    }
  });

  test('quick workflows section exists', async ({ page }) => {
    await expect(page.locator('text=Quick Workflows')).toBeVisible();
    const items = page.locator('.workflow-item');
    await expect(items.first()).toBeVisible();
  });

  test('recent activity section exists', async ({ page }) => {
    await expect(page.locator('text=Recent Activity')).toBeVisible();
  });

  test('activity by module chart exists', async ({ page }) => {
    await expect(page.locator('text=Activity by Module')).toBeVisible();
    const bars = page.locator('.bar-row');
    await expect(bars).toHaveCount(5);
  });

  test('cross-module links section exists', async ({ page }) => {
    await expect(page.locator('text=Cross-Module Links')).toBeVisible();
  });

  test('activity feed link works', async ({ page }) => {
    await page.click('a[href="/activity"]');
    await expect(page).toHaveURL(/\/activity/);
  });
});
