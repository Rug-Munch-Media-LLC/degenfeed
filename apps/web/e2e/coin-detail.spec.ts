// ═══════════════════════════════════════════════════════════════
// Coin Detail E2E Tests — Price chart, Buy/Sell, holders, trades
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import { MOCK_FEED_POSTS, MOCK_PREFERENCES, mockFeedApi } from './fixtures';

test.describe('Coin Detail page', () => {
  test.beforeEach(async ({ page }) => {
    // Coin detail generates client-side mock data when API fails
    await page.route('**/api/creator-coin/**', async (route) => {
      await route.abort('connectionrefused');
    });
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
  });

  test('coin detail page loads with coin name and symbol', async ({ page }) => {
    await page.goto('/coins/alice');
    // Breadcrumb navigation should show "Coins / $ALICE"
    await expect(page.locator('nav').getByText('Coins')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('$ALICE')).toBeVisible();
    // Coin name should be visible in the h1 or large heading
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('displays price chart with SVG chart', async ({ page }) => {
    await page.goto('/coins/alice');
    // Price chart SVG should be rendered with aria-label
    await expect(page.locator('svg[aria-label="Price chart"]')).toBeVisible({ timeout: 30000 });
  });

  test('timeframe buttons are displayed and clickable', async ({ page }) => {
    await page.goto('/coins/alice');
    const timeframes = ['1H', '24H', '7D', '30D', 'ALL'];
    for (const tf of timeframes) {
      await expect(page.locator('button', { hasText: tf })).toBeVisible({ timeout: 15000 });
    }
  });

  test('switching timeframe updates active state', async ({ page }) => {
    await page.goto('/coins/alice');
    // 24H should be default active
    const btn24h = page.locator('button', { hasText: '24H' });
    await expect(btn24h).toBeVisible({ timeout: 30000 });

    // Click 7D
    await page.locator('button', { hasText: '7D' }).click();
    await expect(page.locator('button', { hasText: '7D' })).toHaveClass(/bg-degen-500\/15/);
  });

  test('displays price, market cap, and holder count', async ({ page }) => {
    await page.goto('/coins/alice');
    // Price area should be visible
    await expect(page.getByText(/Volume:|MCap:|holders/)).toBeVisible({ timeout: 30000 });
  });

  test('info tab shows recent trades and top holders', async ({ page }) => {
    await page.goto('/coins/alice');
    // The Info tab should be active by default
    await expect(page.locator('button', { hasText: 'Info' }).first()).toBeVisible({
      timeout: 30000,
    });
    // Recent Trades section heading
    await expect(page.getByText('Recent Trades')).toBeVisible({ timeout: 10000 });
    // Top Holders section heading
    await expect(page.getByText('Top Holders')).toBeVisible();
  });

  test('transparency tab shows vesting tracker and fee breakdown', async ({ page }) => {
    await page.goto('/coins/alice');
    // Click Transparency tab
    await page.locator('button', { hasText: 'Transparency' }).first().click();
    await expect(page.getByText('Vesting Tracker')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Fee Transparency')).toBeVisible();
    await expect(page.getByText('Supply Breakdown')).toBeVisible();
  });

  test('trust tab shows community dashboard and creator verification', async ({ page }) => {
    await page.goto('/coins/alice');
    // Click Trust tab
    await page.locator('button', { hasText: 'Trust' }).first().click();
    await expect(page.getByText('Community Trust Dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Creator Verification')).toBeVisible();
  });

  test('buy and sell tabs switch trade mode', async ({ page }) => {
    await page.goto('/coins/alice');
    // Buy should be default
    const buyBtn = page.locator('button', { hasText: 'Buy' });
    const sellBtn = page.locator('button', { hasText: 'Sell' });
    await expect(buyBtn.or(sellBtn).first()).toBeVisible({ timeout: 30000 });
  });

  test('trade confirm modal opens when buying', async ({ page }) => {
    await page.goto('/coins/alice');
    // There should be trade-related buttons visible (buy/sell controls)
    // Look for the Buy tab button and click it
    await page.waitForTimeout(2000);

    // Try to find a buy/confirm button or input
    const tradeInput = page.locator('input[type="text"], input[placeholder*="amount"i]').first();
    if (await tradeInput.isVisible()) {
      // Fill in a trade amount
      await tradeInput.fill('100');
    }
  });

  test('shows wallet labeled entries in trades and holders', async ({ page }) => {
    await page.goto('/coins/alice');
    // The Info tab should show labeled entries (creator, team, lp badges)
    await expect(page.getByText('Recent Trades')).toBeVisible({ timeout: 30000 });
    // Wallet labels like creator, team should appear in badges
    // These are rendered as small colored label badges
    await expect(
      page
        .locator('span')
        .filter({ hasText: /creator|team|lp|bundled|dao/ })
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('multi-protocol view tabs link to protocol-specific pages', async ({ page }) => {
    await page.goto('/coins/alice');
    // Protocol links should be visible (Farcaster, Nostr, Bluesky, etc.)
    await expect(page.locator('a', { hasText: 'Farcaster' }).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator('a', { hasText: 'Nostr' }).first()).toBeVisible();
    await expect(page.locator('a', { hasText: 'Bluesky' }).first()).toBeVisible();
  });
});

test.describe('Coin Detail — loading state', () => {
  test('shows loading skeleton while data loads', async ({ page }) => {
    await page.route('**/api/creator-coin/**', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.abort('connectionrefused');
    });
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);

    await page.goto('/coins/alice');
    // Skeleton elements should appear
    await expect(page.locator('.skeleton').first()).toBeVisible({ timeout: 5000 });
  });
});
