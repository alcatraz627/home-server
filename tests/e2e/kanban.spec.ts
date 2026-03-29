import { test, expect } from '@playwright/test';

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kanban');
  });

  test('board renders with column headers', async ({ page }) => {
    await expect(page.locator('.page')).toBeVisible();
    // Should have kanban columns
    const columns = page.locator('.col-header, .column-header, [class*="column"]');
    await expect(columns.first()).toBeVisible();
  });

  test('add card button exists', async ({ page }) => {
    const addBtn = page.locator('button', { hasText: /add|new|create/i });
    await expect(addBtn.first()).toBeVisible();
  });

  test('filter query bar exists', async ({ page }) => {
    const fqBar = page.locator('[class*="filter-query"], [class*="fq-"]');
    await expect(fqBar.first()).toBeVisible();
  });
});
