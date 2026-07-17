// ═══════════════════════════════════════════════════════════════
// Search E2E Tests — Search posts, people, communities
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import {
  MOCK_SEARCH_RESULTS,
  MOCK_EMPTY_SEARCH,
  MOCK_PREFERENCES,
  mockSearchApi,
  mockFeedApi,
} from './fixtures';

test.describe('Search page', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearchApi(page);
    await mockFeedApi(page, undefined, MOCK_PREFERENCES);
  });

  test('search page loads with heading', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('h1', { hasText: 'Search' })).toBeVisible({ timeout: 30000 });
  });

  test('search input is visible and labeled', async ({ page }) => {
    await page.goto('/search');
    const searchInput = page.getByPlaceholder('Search posts, people, topics...');
    await expect(searchInput).toBeVisible();
  });

  test('search with query shows results', async ({ page }) => {
    await page.goto('/search?q=bitcoin');
    // Search results should appear
    await expect(page.getByText('Bitcoin is the future of money!')).toBeVisible({ timeout: 30000 });
  });

  test('search tabs are displayed after search', async ({ page }) => {
    await page.goto('/search?q=bitcoin');
    await expect(page.getByText('All')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Posts')).toBeVisible();
    await expect(page.getByText('People')).toBeVisible();
    await expect(page.getByText('Communities')).toBeVisible();
  });

  test('search shows protocol filter pills', async ({ page }) => {
    await page.goto('/search?q=bitcoin');
    // Protocol filter should be visible
    await expect(page.getByText('Nostr').or(page.getByText('Farcaster'))).toBeVisible({
      timeout: 30000,
    });
  });

  test('People tab shows identity results', async ({ page }) => {
    await page.goto('/search?q=bitcoin');
    await page.locator('button', { hasText: 'People' }).click();
    await expect(page.getByText('Satoshi').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bitcoin enthusiast')).toBeVisible();
  });

  test('Communities tab shows community results', async ({ page }) => {
    await page.goto('/search?q=bitcoin');
    await page.locator('button', { hasText: 'Communities' }).click();
    await expect(page.getByText('Bitcoin').first()).toBeVisible({ timeout: 10000 });
    // Community description should be visible
    await expect(page.getByText('Bitcoin discussion community')).toBeVisible();
  });

  test('Topics tab shows topic grid', async ({ page }) => {
    await page.goto('/search?q=bitcoin');
    await page.locator('button', { hasText: 'Topics' }).click();
    await expect(page.getByText('Crypto').or(page.getByText('Bitcoin'))).toBeVisible({
      timeout: 10000,
    });
  });

  test('post results show author name and protocol badge', async ({ page }) => {
    await page.goto('/search?q=bitcoin');
    await expect(page.getByText('Satoshi').first()).toBeVisible({ timeout: 30000 });
    // Protocol badges
    await expect(page.getByText('nostr').or(page.getByText('farcaster'))).toBeVisible();
  });

  test('post results show metrics', async ({ page }) => {
    await page.goto('/search?q=bitcoin');
    await expect(page.getByText(/♥/).or(page.getByText(/↻/).or(page.getByText(/✎/)))).toBeVisible({
      timeout: 30000,
    });
  });

  test('clicking a post result navigates to post detail', async ({ page }) => {
    // Mock the post detail page
    await page.route('**/api/feed/post/search-post-1', async (route) => {
      await route.fulfill({ json: { data: MOCK_SEARCH_RESULTS.data[0] } });
    });

    await page.goto('/search?q=bitcoin');
    const postResult = page.getByText('Bitcoin is the future of money!').first();
    await postResult.click();
    // Should navigate to post detail
    await expect(page).toHaveURL(/\/post\//);
  });
});

test.describe('Search — Empty state', () => {
  test('shows no results message for empty search', async ({ page }) => {
    await page.route('**/api/search**', async (route) => {
      const url = route.request().url();
      if (url.includes('q=')) {
        await route.fulfill({ json: MOCK_EMPTY_SEARCH });
      } else {
        await route.fulfill({ json: MOCK_SEARCH_RESULTS });
      }
    });
    await page.route('**/api/preferences', async (route) => {
      await route.fulfill({ json: {} });
    });

    await page.goto('/search?q=xyznonexistent');
    await expect(page.getByText(/No results for/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Search — URL-based search', () => {
  test('search query from URL triggers on page load', async ({ page }) => {
    await mockSearchApi(page);
    await page.goto('/search?q=bitcoin');
    // Search input should show the query
    const searchInput = page.getByPlaceholder('Search posts, people, topics...');
    await expect(searchInput).toHaveValue('bitcoin', { timeout: 10000 });
  });

  test('empty search does not show results', async ({ page }) => {
    await page.goto('/search');
    // Should not show results/loading for empty query
    await expect(page.getByText('Bitcoin is the future')).not.toBeVisible();
  });
});

test.describe('Search — Error state', () => {
  test('search error shows retry button', async ({ page }) => {
    await page.route('**/api/search**', async (route) => {
      await route.abort('connectionrefused');
    });
    await page.route('**/api/preferences', async (route) => {
      await route.fulfill({ json: {} });
    });

    await page.goto('/search?q=bitcoin');
    // Error state + retry
    await expect(page.getByText('Retry').or(page.getByText(/Failed|Error/))).toBeVisible({
      timeout: 10000,
    });
  });
});
