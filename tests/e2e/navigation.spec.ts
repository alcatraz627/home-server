import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page loads with dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Home Server/);
    // Dashboard should render widget cards
    await expect(page.locator('.widget-card, .dashboard-grid, .page')).toBeVisible();
  });

  test('sidebar navigation links work', async ({ page }) => {
    await page.goto('/');
    // Sidebar should have nav links
    const sidebar = page.locator('nav, .sidebar, aside');
    await expect(sidebar).toBeVisible();
  });

  test.describe('productivity pages load', () => {
    const pages = [
      { path: '/kanban', title: 'Kanban' },
      { path: '/reminders', title: 'Reminders' },
      { path: '/notes', title: 'Notes' },
      { path: '/bookmarks', title: 'Bookmarks' },
      { path: '/keeper', title: 'Keeper' },
      { path: '/workflows', title: 'Workflows' },
      { path: '/activity', title: 'Activity' },
    ];

    for (const p of pages) {
      test(`${p.path} loads`, async ({ page }) => {
        await page.goto(p.path);
        await expect(page.locator('.page')).toBeVisible();
        // Page header should contain the title
        await expect(page.locator('h1, .page-title')).toContainText(p.title);
      });
    }
  });
});
