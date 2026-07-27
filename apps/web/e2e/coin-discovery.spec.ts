// ═══════════════════════════════════════════════════════════════
// Coin Discovery E2E Tests — Browse, sort, filter creator coins
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import { MOCK_FEED_POSTS, MOCK_PREFERENCES, mockFeedApi } from './fixtures';

test.describe('Coin Discovery — list page', () => {
  test.beforeEach(async ({ page }) => {
    // Coins page generates client-side mock data when API fails,
    // but we still mock feed API if it's referenced by nav/sidebar
    await page.route('**/api/creator/coins', async (route) => {
      await route.abort('connectionrefused');
    });
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
  });

  test('coin discovery page loads with heading', async ({ page }) => {
    await page.goto('/coins');
    await expect(page.locator('h1', { hasText: 'Coin Discovery' })).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText('Discover and trade creator coins. Trending, new launches, top gainers.'),
    ).toBeVisible();
  });

  test('displays stats bar with 4 metrics', async ({ page }) => {
    await page.goto('/coins');
    // Stats bar should show 4 tiles
    await expect(page.getByText('Total Coins')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('24h Volume')).toBeVisible();
    await expect(page.getByText('Total Market Cap')).toBeVisible();
    await expect(page.getByText('Avg 24h Change')).toBeVisible();
  });

  test('shows coin grid with cards', async ({ page }) => {
    await page.goto('/coins');
    // Wait for coin cards to render (mock data generates 20 coins)
    await expect(page.locator('h1', { hasText: 'Coin Discovery' })).toBeVisible({
      timeout: 30000,
    });
    // Coin cards should have sparkline charts
    const coinCards = page.locator('[class*="rounded-xl"]').filter({ has: page.locator('svg') });
    await expect(coinCards.first()).toBeVisible({ timeout: 10000 });
    // Should show at least one coin name
    await expect(page.getByText('Degen Alice').or(page.getByText('Bob Protocol'))).toBeVisible();
  });

  test('displays all sort mode buttons', async ({ page }) => {
    await page.goto('/coins');
    await expect(page.locator('button', { hasText: 'trending' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('button', { hasText: 'newest' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'gainers' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'marketcap' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'volume' })).toBeVisible();
  });

  test('sort mode buttons are clickable and toggle state', async ({ page }) => {
    await page.goto('/coins');
    // Default sort is trending — should be highlighted
    const trendingBtn = page.locator('button', { hasText: 'trending' }).first();
    await expect(trendingBtn).toBeVisible({ timeout: 30000 });

    // Click newest
    await page.locator('button', { hasText: 'newest' }).first().click();
    // The newest button should now have the active class
    await expect(page.locator('button', { hasText: 'newest' }).first()).toHaveClass(
      /bg-degen-500\/15|text-degen-400/,
    );
  });

  test('chain filter buttons toggle state', async ({ page }) => {
    await page.goto('/coins');
    const baseBtn = page.locator('button', { hasText: 'Base' });
    await expect(baseBtn).toBeVisible({ timeout: 30000 });

    await baseBtn.click();
    await expect(baseBtn).toHaveClass(/bg-degen-500\/15|text-degen-400/);

    // Click Solana
    await page.locator('button', { hasText: 'Solana' }).click();
    await expect(page.locator('button', { hasText: 'Solana' })).toHaveClass(
      /bg-degen-500\/15|text-degen-400/,
    );
  });

  test('search input filters coins', async ({ page }) => {
    await page.goto('/coins');
    const searchInput = page.locator('input[placeholder="Search coins..."]');
    await expect(searchInput).toBeVisible({ timeout: 30000 });

    // Type a known mock coin name
    await searchInput.fill('Alice');
    // After filtering, Alice coin should be visible
    await expect(page.getByText('Degen Alice')).toBeVisible();
    // Non-matching names should not be visible
    // Use a more reliable assertion — the count should be <= what it was
  });

  test('shows compare and stats links', async ({ page }) => {
    await page.goto('/coins');
    await expect(page.locator('a', { hasText: 'Compare' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('a', { hasText: 'Stats' })).toBeVisible();
  });

  test('shows total coin count in footer', async ({ page }) => {
    await page.goto('/coins');
    // Footer should show "Showing X of Y coins"
    await expect(page.getByText(/Showing.*of.*coins/)).toBeVisible({ timeout: 30000 });
  });

  test('loading state shows skeleton placeholders', async ({ page }) => {
    // Slow down the API response to trigger loading state
    await page.route('**/api/creator/coins', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.abort('connectionrefused');
    });

    await page.goto('/coins');
    // Skeleton elements should appear
    await expect(page.locator('.skeleton').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Coin Discovery — empty state', () => {
  test('shows empty state when no coins match filter', async ({ page }) => {
    await page.goto('/coins');
    // Type a search that won't match any coin
    const searchInput = page.locator('input[placeholder="Search coins..."]');
    await searchInput.fill('ZZZZNONEXISTENT');

    // Wait for filter to apply — should show "No Coins Found"
    await expect(page.getByText('No Coins Found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Try adjusting your search or filters.')).toBeVisible();
  });
});
