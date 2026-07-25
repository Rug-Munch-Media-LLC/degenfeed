/**
 * @degenfeed/e2e — Cross-Browser Tests
 *
 * Verifies the app renders correctly in Chromium, Firefox, and WebKit
 * across multiple viewport sizes with no layout breaks.
 *
 * Requirements:
 * - App must be running on port 3000
 * - All Playwright browsers installed (chromium, firefox, webkit)
 *
 * run: npx playwright test tests/e2e/cross-browser.test.ts
 */

import { expect, test } from '@playwright/test';

const DESKTOP = { width: 1280, height: 800 };
const TABLET = { width: 768, height: 1024 };
const MOBILE = { width: 375, height: 667 };

test.describe('Cross-Browser Rendering', () => {
  test('page renders in Chromium at desktop viewport', async ({ browserName, page }) => {
    test.skip(browserName !== 'chromium', 'Chromium-only test');
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('page renders in Firefox at desktop viewport', async ({ browserName, page }) => {
    test.skip(browserName !== 'firefox', 'Firefox-only test');
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('page renders in WebKit at desktop viewport', async ({ browserName, page }) => {
    test.skip(browserName !== 'webkit', 'WebKit-only test');
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('no layout breaks at tablet viewport (768px)', async ({ page }) => {
    await page.setViewportSize(TABLET);
    await page.goto('/feed');
    // Check no horizontal overflow
    const overflowX = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth;
    });
    expect(overflowX).toBe(false);
    // Main content is visible
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('no layout breaks at mobile viewport (375px)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const overflowX = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth;
    });
    expect(overflowX).toBe(false);
    await expect(page.locator('body')).toBeVisible();
  });
});
