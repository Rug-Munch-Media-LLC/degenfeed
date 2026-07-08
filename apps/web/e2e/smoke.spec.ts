import { test, expect } from '@playwright/test';

test.describe('DegenFeed smoke tests', () => {
  test('feed page loads', async ({ page }) => {
    await page.goto('/home/all?sort=hot');
    await expect(page.locator('article').first()).toBeVisible({ timeout: 30000 });
  });

  test('post detail opens', async ({ page }) => {
    await page.goto('/home/all?sort=new&limit=5');
    const firstPost = page.locator('article').first();
    await firstPost.click();
    await expect(page).toHaveURL(/\/post\//);
    await expect(page.locator('text=Back to feed')).toBeVisible();
  });

  test('compose modal opens', async ({ page }) => {
    await page.goto('/home/all');
    const composeBtn = page.locator('text=Compose');
    if (await composeBtn.isVisible()) {
      await composeBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    }
  });
});
