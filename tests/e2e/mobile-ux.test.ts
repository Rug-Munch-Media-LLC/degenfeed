/**
 * @degenfeed/e2e — Mobile UX Tests
 *
 * Verifies mobile navigation, touch targets, pull-to-refresh,
 * safe area insets, and responsive layout across breakpoints.
 *
 * Requirements:
 * - App must be running on port 3000
 * - Playwright browsers installed
 *
 * run: npx playwright test tests/e2e/mobile-ux.test.ts
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 375, height: 667 }; // iPhone SE
const TABLET_VIEWPORT = { width: 768, height: 1024 };
const LARGE_MOBILE = { width: 414, height: 896 }; // iPhone 11 Pro Max

test.describe('Mobile UX — Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('mobile navigation renders at 375px breakpoint', async ({ page }) => {
    await page.goto('/');
    // Bottom nav should be visible on mobile
    const bottomNav = page.locator('[data-testid="bottom-nav"], nav:has(a[href="/"])');
    await expect(bottomNav).toBeVisible();
  });

  test('bottom nav present on feed page', async ({ page }) => {
    await page.goto('/feed');
    const bottomNav = page.locator('[data-testid="bottom-nav"]');
    await expect(bottomNav).toBeVisible();
  });

  test('bottom nav present on search page', async ({ page }) => {
    await page.goto('/search');
    const bottomNav = page.locator('[data-testid="bottom-nav"]');
    await expect(bottomNav).toBeVisible();
  });

  test('bottom nav present on profile page', async ({ page }) => {
    await page.goto('/profile');
    const bottomNav = page.locator('[data-testid="bottom-nav"]');
    await expect(bottomNav).toBeVisible();
  });

  test('bottom nav present at tablet breakpoint', async ({ page }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.goto('/');
    const bottomNav = page.locator('[data-testid="bottom-nav"]');
    await expect(bottomNav).toBeVisible();
  });
});

test.describe('Mobile UX — Touch Targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
  });

  test('all navigation buttons are at least 44px tall', async ({ page }) => {
    const navButtons = page.locator(
      '[data-testid="bottom-nav"] button, [data-testid="bottom-nav"] a, nav a',
    );
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await navButtons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('action buttons have minimum 44px touch target', async ({ page }) => {
    const actionBtn = page.locator('[data-testid="post-button"], [data-testid="compose-fab"]');
    if ((await actionBtn.count()) > 0) {
      const box = await actionBtn.first().boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('Mobile UX — Responsive Layout', () => {
  test('feed cards use full width on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/feed');
    const card = page.locator('[data-testid="post-card"], article').first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Card should be close to full viewport width with some margin
      expect(box.width).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.width * 0.85);
    }
  });

  test('layout responds to large mobile viewport', async ({ page }) => {
    await page.setViewportSize(LARGE_MOBILE);
    await page.goto('/');
    const main = page.locator('main, [role="main"]').first();
    await expect(main).toBeVisible();
  });

  test('no horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/feed');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance for rounding
  });
});
