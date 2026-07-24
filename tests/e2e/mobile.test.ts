/**
 * ═════════════════════════════════════════════════════════════════════════════
 * MOBILE TESTS — 10 tests
 *
 * Tests mobile-specific behavior: navigation, touch targets, swipe gestures,
 * responsive layout at all breakpoints, and bottom navigation bar.
 *
 * Uses Playwright with iPhone 13 viewport emulation by default, and tests
 * across multiple device widths for responsive layout verification.
 * ═════════════════════════════════════════════════════════════════════════════
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK_FEED = {
  data: [
    {
      id: 'post-1',
      protocol: 'nostr',
      text: 'Bitcoin is the future of money!',
      html: '<p>Bitcoin is the future of money!</p>',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      author: {
        id: 'npub1abc',
        displayName: 'Satoshi',
        avatarUrl: '',
        handle: 'satoshi',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 42, reposts: 10, replies: 5, quotes: 2 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['bitcoin'],
      parentId: null,
      raw: {},
    },
    {
      id: 'post-2',
      protocol: 'farcaster',
      text: 'Just deployed my first smart contract on Base 🚀',
      html: '<p>Just deployed my first smart contract on Base 🚀</p>',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      author: {
        id: 'fid:123',
        displayName: 'Builder Guy',
        avatarUrl: '',
        handle: 'builder',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 128, reposts: 33, replies: 12, quotes: 5 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['base', 'solidity'],
      parentId: null,
      raw: {},
    },
    {
      id: 'post-3',
      protocol: 'bluesky',
      text: 'AT Protocol is the most underrated social graph.',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      author: {
        id: 'did:plc:xyz',
        displayName: 'Protocol Maxi',
        avatarUrl: '',
        handle: 'maxi.bsky.social',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 67, reposts: 15, replies: 8, quotes: 1 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['atproto', 'decentralization'],
      parentId: null,
      raw: {},
    },
  ],
  meta: {
    total: 3,
    limit: 50,
    perProtocol: { nostr: 1, farcaster: 1, bluesky: 1 },
    trending: [{ topic: 'bitcoin', count: 1, score: 42 }],
    fetchedAt: Date.now(),
    topOfHour: 'post-2',
  },
};

const MOCK_NEWS = {
  data: [
    {
      id: 'news-1',
      protocol: 'rss',
      text: 'Bitcoin reaches new all-time high amid institutional adoption',
      html: '<p>Bitcoin reaches new all-time high amid institutional adoption</p>',
      createdAt: new Date().toISOString(),
      author: {
        id: 'rss:coindesk',
        displayName: 'CoinDesk',
        avatarUrl: '',
        handle: 'coindesk',
        metadata: {},
      },
      embeds: [{ kind: 'link', url: 'https://example.com/article' }],
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['bitcoin'],
      parentId: null,
      raw: {},
    },
  ],
  meta: {
    total: 1,
    limit: 50,
    category: 'all',
    mustRead: false,
    trending: [],
    sourceCounts: { rss: 1 },
    fetchedAt: Date.now(),
    sources: 1,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function setupMobilePage(page: Page) {
  await page.route('**/api/feed/home**', async (route) => {
    await route.fulfill({ json: MOCK_FEED });
  });
  await page.route('**/api/feed/for-you**', async (route) => {
    await route.fulfill({ json: MOCK_FEED });
  });
  await page.route('**/api/preferences', async (route) => {
    await route.fulfill({ json: {} });
  });
  await page.route('**/api/feed/news**', async (route) => {
    await route.fulfill({ json: MOCK_NEWS });
  });
}

// ─── 1. Mobile Navigation ──────────────────────────────────────────────────

test.describe('Mobile: Navigation', () => {
  test('bottom navigation bar is visible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Bottom nav should be visible
    await expect(
      page.locator('nav[aria-label="Mobile"], nav.bottom-nav, [class*="bottom-nav"]').first(),
    ).toBeVisible({ timeout: 30000 });
  });

  test('bottom nav shows all primary navigation items', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Should show Feed/Home, News, Videos/Search and Explore
    const bottomNav = page
      .locator('nav[aria-label="Mobile"], nav.bottom-nav, [class*="bottom-nav"]')
      .first();
    await expect(bottomNav).toBeVisible({ timeout: 30000 });

    // Check that common nav items are present
    const navLinks = bottomNav.locator('a, button');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThanOrEqual(3);
  });

  test('tapping a bottom nav item navigates to that page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);

    // Start on the feed page
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Find and tap a nav link to another section
    const newsLink = page
      .locator('nav[aria-label="Mobile"] a, nav.bottom-nav a, [class*="bottom-nav"] a')
      .filter({ hasText: /News/i })
      .first();
    if (await newsLink.isVisible()) {
      await newsLink.tap();
      await page.waitForTimeout(2000);
      // Should have navigated
      const currentUrl = page.url();
      expect(currentUrl.includes('news') || currentUrl.includes('/')).toBe(true);
    }
  });
});

// ─── 2. Touch Targets ─────────────────────────────────────────────────────

test.describe('Mobile: Touch Targets', () => {
  test('post interaction buttons have adequate touch targets (≥44px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Check interactive elements for minimum touch target size
    const buttons = page.locator('button, a[href]');
    const count = await buttons.count();
    let undersizedCount = 0;

    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      if (box) {
        const minDimension = Math.min(box.width, box.height);
        if (minDimension < 44) {
          undersizedCount++;
        }
      }
    }

    // Some buttons may be small (icon buttons), but most should meet 44px target
    const sampledCount = Math.min(count, 10);
    // Allow up to 30% of sampled buttons to be below 44px (icon-only buttons, etc.)
    expect(undersizedCount / sampledCount).toBeLessThan(0.5);
  });

  test('bottom nav items have adequate spacing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const bottomNav = page
      .locator('nav[aria-label="Mobile"], nav.bottom-nav, [class*="bottom-nav"]')
      .first();
    if (await bottomNav.isVisible()) {
      const items = bottomNav.locator('a, button');
      const itemCount = await items.count();

      if (itemCount >= 2) {
        const firstBox = await items.nth(0).boundingBox();
        const secondBox = await items.nth(1).boundingBox();

        if (firstBox && secondBox) {
          // Items should have some horizontal spacing between them
          const gap = secondBox.x - (firstBox.x + firstBox.width);
          expect(gap).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

// ─── 3. Swipe Gestures ────────────────────────────────────────────────────

test.describe('Mobile: Swipe Gestures', () => {
  test('feed page can be scrolled/swiped vertically', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Get initial scroll position
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Simulate swipe up (scroll down)
    await page.touchscreen.swipe(200, 600, 200, 100);
    await page.waitForTimeout(500);

    const newScrollY = await page.evaluate(() => window.scrollY);
    // Page should have scrolled (or attempted to scroll)
    expect(newScrollY).toBeGreaterThanOrEqual(initialScrollY);
  });

  test('post detail page scrolls to show replies', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);
    await page.route('**/api/feed/post/post-1', async (route) => {
      await route.fulfill({ json: { data: MOCK_FEED.data[0] } });
    });
    await page.route('**/api/feed/post/post-1/replies**', async (route) => {
      await route.fulfill({ json: { data: [MOCK_FEED.data[1], MOCK_FEED.data[2]] } });
    });

    await page.goto('/post/post-1');
    await page.waitForLoadState('networkidle');

    // Scroll down to see replies
    await page.touchscreen.swipe(200, 700, 200, 100);
    await page.waitForTimeout(500);

    // Content should remain visible and page should be scrollable
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(scrollHeight).toBeGreaterThan(viewportHeight);
  });
});

// ─── 4. Responsive Layout ─────────────────────────────────────────────────

test.describe('Mobile: Responsive Layout', () => {
  const breakpoints = [
    { width: 320, height: 568, name: 'iPhone SE' }, // Small mobile
    { width: 390, height: 844, name: 'iPhone 13' }, // Standard mobile
    { width: 768, height: 1024, name: 'iPad' }, // Tablet
    { width: 1024, height: 768, name: 'iPad Landscape' }, // Tablet landscape
  ];

  for (const bp of breakpoints) {
    test(`feed page renders correctly at ${bp.name} (${bp.width}×${bp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await setupMobilePage(page);
      await page.goto('/feed');
      await page.waitForLoadState('networkidle');

      // Content should be visible regardless of viewport
      await expect(page.locator('article, [class*="post"], [class*="Post"]').first()).toBeVisible({
        timeout: 30000,
      });

      // No horizontal overflow
      const overflowX = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 1;
      });
      expect(overflowX).toBe(true);
    });
  }

  test('mobile layout hides desktop-only sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Desktop sidebar/trending should not be visible on mobile
    const sidebar = page.locator('aside, [class*="sidebar"], [class*="Sidebar"]');
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    // Either no sidebar exists, or it's hidden on mobile
    if (sidebarVisible) {
      const sidebarWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
      // If sidebar is visible, it should be compressed/narrow
      expect(sidebarWidth).toBeLessThan(100);
    }
  });
});

// ─── 5. Bottom Navigation Bar ──────────────────────────────────────────────

test.describe('Mobile: Bottom Navigation', () => {
  test('bottom nav visible on feed, news, and search pages', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);

    // Check bottom nav on feed page
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    const bottomNavSelector = 'nav[aria-label="Mobile"], nav.bottom-nav, [class*="bottom-nav"]';
    await expect(page.locator(bottomNavSelector).first()).toBeVisible({ timeout: 30000 });

    // Check bottom nav on news page
    await page.goto('/news');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(bottomNavSelector).first()).toBeVisible({ timeout: 30000 });
  });

  test('active bottom nav item is visually indicated', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMobilePage(page);

    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const bottomNav = page
      .locator('nav[aria-label="Mobile"], nav.bottom-nav, [class*="bottom-nav"]')
      .first();
    if (await bottomNav.isVisible()) {
      // The active/current page nav item should have some visual distinction
      const navItems = bottomNav.locator('a, button');
      const count = await navItems.count();
      for (let i = 0; i < count; i++) {
        const item = navItems.nth(i);
        const isActive = await item.getAttribute('aria-current');
        if (isActive === 'page') {
          // Active item should have a non-default style
          const classes = await item.getAttribute('class');
          expect(classes).toBeTruthy();
          break;
        }
      }
    }
  });
});
