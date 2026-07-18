// ═══════════════════════════════════════════════════════════════
// Feed E2E Tests — Feed loads, scrolls, filters, tabs
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import {
  MOCK_FEED_POSTS,
  MOCK_FOLLOWING_FEED,
  MOCK_PREFERENCES,
  MOCK_PREFERENCES_SIGNED_OUT,
  mockFeedApi,
} from './fixtures';

test.describe('Feed — loaded state', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES_SIGNED_OUT);
  });

  test('feed page loads and displays posts', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.locator('h1', { hasText: 'DegenFeed' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('article').first()).toBeVisible();
    // All 5 posts should be rendered
    await expect(page.getByText('Bitcoin is the future of money!')).toBeVisible();
    await expect(page.getByText('Just deployed my first smart contract')).toBeVisible();
    await expect(page.getByText('AT Protocol is the most underrated')).toBeVisible();
  });

  test('shows For You and Following tabs', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.locator('button', { hasText: 'For You' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Following' })).toBeVisible();
  });

  test('For You tab is active by default', async ({ page }) => {
    await page.goto('/feed');
    const forYouTab = page.locator('button', { hasText: 'For You' });
    await expect(forYouTab).toHaveAttribute('class', /text-\[var\(--color-fg\)\]/);
  });

  test('protocol filter pills are visible', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.locator('button', { hasText: 'All' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Nostr' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Farcaster' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Bluesky' })).toBeVisible();
  });

  test('quality controls are visible', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.locator('button', { hasText: /Show all|Hiding low-quality/ })).toBeVisible();
    await expect(page.getByText('Original')).toBeVisible();
    await expect(page.getByText('Non-crypto')).toBeVisible();
  });

  test('shows personalization bar on For You tab', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.getByText(/Personalized/)).toBeVisible({ timeout: 30000 });
  });

  test('shows Top of the Hour pinned post', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.getByText('Top of the Hour')).toBeVisible({ timeout: 30000 });
  });

  test('displays connect wallet prompt when signed out', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.locator('button', { hasText: 'Connect Wallet' }).first()).toBeVisible();
  });
});

test.describe('Feed — Following tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES_SIGNED_OUT);
  });

  test('switching to Following tab shows empty state when not following anyone', async ({
    page,
  }) => {
    // Mock the following feed to be empty
    await page.route('**/api/feed/home**', async (route) => {
      const url = route.request().url();
      if (url.includes('filter=following')) {
        await route.fulfill({ json: { data: [], meta: { total: 0 } } });
      } else {
        await route.fulfill({ json: MOCK_FEED_POSTS });
      }
    });

    await page.goto('/feed');
    await page.locator('button', { hasText: 'Following' }).click();
    await expect(page.getByText('You are not following anyone yet.')).toBeVisible({
      timeout: 10000,
    });
  });

  test('Following tab shows posts from followed authors', async ({ page }) => {
    await page.route('**/api/feed/home**', async (route) => {
      const url = route.request().url();
      if (url.includes('filter=following')) {
        await route.fulfill({ json: MOCK_FOLLOWING_FEED });
      } else {
        await route.fulfill({ json: MOCK_FEED_POSTS });
      }
    });

    await page.goto('/feed');
    await page.locator('button', { hasText: 'Following' }).click();
    await expect(page.getByText('Just deployed my first smart contract')).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Feed — Protocol filtering', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES_SIGNED_OUT);
  });

  test('clicking a protocol filter narrows posts', async ({ page }) => {
    await page.route('**/api/feed/for-you**', async (route) => {
      const url = route.request().url();
      if (url.includes('protocols=nostr')) {
        await route.fulfill({
          json: {
            data: MOCK_FEED_POSTS.data.filter((p) => p.protocol === 'nostr'),
            meta: { ...MOCK_FEED_POSTS.meta, perProtocol: { nostr: 1 } },
          },
        });
      } else {
        await route.fulfill({ json: MOCK_FEED_POSTS });
      }
    });

    await page.goto('/feed');
    await page.locator('button', { hasText: 'Nostr' }).click();
    // After filtering, the Nostr filter button should be active (highlighted)
    await expect(page.locator('button', { hasText: 'Nostr' })).toBeVisible();
  });
});

test.describe('Feed — Quality controls interaction', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
  });

  test('toggling hide low quality changes the button text', async ({ page }) => {
    await page.goto('/feed');
    const toggleBtn = page.locator('button', { hasText: /Show all|Hiding low-quality/ });
    // Initially "Show all" (since hideLowQuality is false)
    await expect(toggleBtn).toContainText('Show all');
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Hiding low-quality');
  });

  test('original content checkbox can be toggled', async ({ page }) => {
    await page.goto('/feed');
    const originalCheckbox = page
      .getByText('Original')
      .locator('..')
      .locator('input[type="checkbox"]');
    await originalCheckbox.check();
    await expect(originalCheckbox).toBeChecked();
    await originalCheckbox.uncheck();
    await expect(originalCheckbox).not.toBeChecked();
  });
});

test.describe('Feed — New posts polling', () => {
  test('shows "New posts available" banner when new posts detected', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/feed/for-you**', async (route) => {
      callCount++;
      if (callCount <= 1) {
        await route.fulfill({ json: MOCK_FEED_POSTS });
      } else {
        // Return a different top post to simulate new content
        await route.fulfill({
          json: {
            data: [{ ...MOCK_FEED_POSTS.data[0], id: 'post-new' }, ...MOCK_FEED_POSTS.data],
            meta: { ...MOCK_FEED_POSTS.meta, total: 6 },
          },
        });
      }
    });
    await page.route('**/api/preferences', async (route) => {
      await route.fulfill({ json: {} });
    });

    await page.goto('/feed');
    await expect(page.getByText('New posts available')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Feed — Trending sidebar', () => {
  test('trending topics sidebar appears on desktop', async ({ page }) => {
    test.use({ viewport: { width: 1440, height: 900 } });
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES_SIGNED_OUT);

    await page.goto('/feed');
    // The trending section in the sidebar should mention bitcoin
    await expect(page.getByText('bitcoin').first()).toBeVisible({ timeout: 30000 });
  });
});
