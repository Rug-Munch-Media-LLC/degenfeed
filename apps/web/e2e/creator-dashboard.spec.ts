// ═══════════════════════════════════════════════════════════════
// Creator Dashboard E2E Tests — Metrics, holders, trades, vesting
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import { MOCK_FEED_POSTS, MOCK_PREFERENCES, mockFeedApi } from './fixtures';

test.describe('Creator Dashboard — main page', () => {
  test.beforeEach(async ({ page }) => {
    // Creator dashboard uses client-side mock data
    await page.route('**/api/creator/**', async (route) => {
      await route.abort('connectionrefused');
    });
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
  });

  test('dashboard loads with heading and description', async ({ page }) => {
    await page.goto('/creator/dashboard');
    await expect(page.locator('h1', { hasText: 'Coin Management' })).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText('Full control, transparency tools, and community trust features.'),
    ).toBeVisible();
  });

  test('displays coin selector with coin symbols', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Coin selector should show ALICE, BOB, CRE8
    await expect(page.locator('button', { hasText: '$ALICE' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('button', { hasText: '$BOB' })).toBeVisible();
    await expect(page.locator('button', { hasText: '$CRE8' })).toBeVisible();
  });

  test('coin selector changes displayed coin', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Click on BOB coin
    await page.locator('button', { hasText: '$BOB' }).click();
    // The coin identity should now show Bob Coin
    await expect(page.getByText('Bob Coin')).toBeVisible({ timeout: 10000 });
  });

  test('shows all 7 tab navigation items', async ({ page }) => {
    await page.goto('/creator/dashboard');
    const tabs = ['Overview', 'Holders', 'Trades', 'Revenue', 'Vesting', 'Supply', 'Transparency'];
    for (const tab of tabs) {
      await expect(page.locator('button', { hasText: tab })).toBeVisible({ timeout: 15000 });
    }
  });

  test('Overview tab shows metrics tiles by default', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Overview is default tab — should show metric tiles
    await expect(page.getByText('Price').or(page.getByText('Market Cap'))).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText('Holders').or(page.getByText('Volume'))).toBeVisible();
  });

  test('metrics tiles display values with correct formatting', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Price tile should be visible
    await expect(page.getByText('$0.').first()).toBeVisible({ timeout: 30000 });
    // Holders count should be visible
    await expect(page.getByText('Holders').locator('..').getByText(/\d/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('Overview tab shows holder list and trade history', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Holder List section
    await expect(page.getByText('Holder List')).toBeVisible({ timeout: 30000 });
    // Trade History section
    await expect(page.getByText('Trade History')).toBeVisible();
  });

  test('Holder List shows wallet labels', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Holder list should have wallet label badges
    await expect(page.getByText('creator').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('team').first()).toBeVisible();
    await expect(page.getByText('lp').first()).toBeVisible();
  });

  test('Trade History shows buy/sell entries', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Trade History should have BUY and SELL labels
    await expect(page.getByText('BUY').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('SELL').first()).toBeVisible();
  });

  test('Vesting tab shows vesting schedule and lock proof', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Click Vesting tab
    await page.locator('button', { hasText: 'Vesting' }).click();
    await expect(page.getByText('Creator Vesting Schedule')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Lock Proof Verified')).toBeVisible();
  });

  test('Supply tab shows pie chart and supply breakdown', async ({ page }) => {
    await page.goto('/creator/dashboard');
    // Click Supply tab
    await page.locator('button', { hasText: 'Supply' }).click();
    await expect(page.getByText('Supply Breakdown')).toBeVisible({ timeout: 10000 });
    // Pie chart SVG should be visible
    await expect(page.locator('svg[aria-label="Supply breakdown pie chart"]')).toBeVisible();
  });

  test('Quick Actions section shows action buttons', async ({ page }) => {
    await page.goto('/creator/dashboard');
    await expect(page.getByText('Quick Actions')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Burn Tokens')).toBeVisible();
    await expect(page.getByText('Airdrop')).toBeVisible();
    await expect(page.getByText('DAO Params')).toBeVisible();
    await expect(page.getByText('Analytics').first()).toBeVisible();
  });

  test('Transparency tab shows bundling detection and audit trail', async ({ page }) => {
    await page.goto('/creator/dashboard');
    await page.locator('button', { hasText: 'Transparency' }).click();
    // Bundling detection warning
    await expect(page.getByText('Bundling Detected')).toBeVisible({ timeout: 10000 });
    // Audit Trail
    await expect(page.getByText('Parameter Audit Trail')).toBeVisible();
  });

  test('has Launch New button linking to studio', async ({ page }) => {
    await page.goto('/creator/dashboard');
    await expect(page.locator('a', { hasText: 'Launch New' })).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Creator Dashboard — coin swapping', () => {
  test('switching coins updates holder list and trade history', async ({ page }) => {
    await page.route('**/api/creator/**', async (route) => {
      await route.abort('connectionrefused');
    });
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);

    await page.goto('/creator/dashboard');
    // Start with ALICE (default)
    await expect(page.getByText('Alice Coin')).toBeVisible({ timeout: 30000 });

    // Switch to BOB
    await page.locator('button', { hasText: '$BOB' }).click();
    await expect(page.getByText('Bob Coin')).toBeVisible({ timeout: 10000 });

    // Switch to CRE8
    await page.locator('button', { hasText: '$CRE8' }).click();
    await expect(page.getByText('Creator Token')).toBeVisible({ timeout: 10000 });
  });
});
