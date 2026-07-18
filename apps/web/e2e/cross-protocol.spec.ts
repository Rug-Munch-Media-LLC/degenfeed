// ═══════════════════════════════════════════════════════════════
// Cross-protocol E2E Tests — Cross-protocol reply, bridge verification
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import {
  MOCK_FEED_POSTS,
  MOCK_PREFERENCES,
  MOCK_SIGNED_IN_STATE,
  MOCK_SINGLE_POST,
  MOCK_THREAD_DATA,
  mockAuthApi,
  mockCrossProtocolApi,
  mockFeedApi,
  mockPostApi,
} from './fixtures';

test.describe('Cross-protocol reply', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await mockPostApi(page);
    await mockAuthApi(page);
    await mockCrossProtocolApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });
  });

  test('reply composer shows protocol selector for cross-protocol reply', async ({ page }) => {
    await page.goto('/post/post-1');
    // The reply protocol pills should be visible for signed-in users
    const replySection = page.locator('textarea[placeholder="Write a reply..."]');
    await expect(replySection).toBeVisible({ timeout: 30000 });

    // Protocol selector buttons should be visible
    await expect(page.getByText('Reply as:')).toBeVisible();
  });

  test('cross-protocol reply shows bridge indicator', async ({ page }) => {
    await page.goto('/post/post-1');
    // Click the non-native protocol (e.g., farcaster for a nostr post)
    const farcasterBtn = page.locator('button', { hasText: 'Farcaster' }).first();
    await farcasterBtn.click();

    // Bridge indicator should appear
    await expect(page.getByText(/Bridging your reply/)).toBeVisible({ timeout: 10000 });
  });

  test('cross-protocol reply sends via bridge endpoint', async ({ page }) => {
    let bridgeCalled = false;
    await page.route('**/api/bridge/reply', async (route) => {
      bridgeCalled = true;
      await route.fulfill({
        json: { ok: true, reply: { id: 'bridge-reply-1', protocol: 'nostr' } },
      });
    });

    await page.goto('/post/post-1');
    // Switch to a different protocol for reply
    const farcasterBtn = page.locator('button', { hasText: 'Farcaster' }).first();
    await farcasterBtn.click();

    await page.waitForTimeout(500);
    const textarea = page.locator('textarea[placeholder="Write a reply..."]');
    await textarea.fill('Cross-protocol reply from farcaster!');
    await page.locator('button', { hasText: 'Reply' }).click();

    // The bridge endpoint should have been called
    await expect(async () => {
      expect(bridgeCalled).toBeTruthy();
    }).toPass({ timeout: 10000 });
  });
});

test.describe('Bridge verification', () => {
  test('thread shows bridged badge on cross-protocol replies', async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await page.route('**/api/feed/post/post-1', async (route) => {
      await route.fulfill({ json: MOCK_SINGLE_POST });
    });
    await page.route('**/api/thread/**', async (route) => {
      await route.fulfill({ json: MOCK_THREAD_DATA });
    });

    await page.goto('/post/post-1');
    // Bridged badge should appear in the thread
    await expect(page.getByText(/bridged/)).toBeVisible({ timeout: 30000 });
  });

  test('thread shows cross-protocol reply count across protocols', async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await page.route('**/api/feed/post/post-1', async (route) => {
      await route.fulfill({ json: MOCK_SINGLE_POST });
    });
    await page.route('**/api/thread/**', async (route) => {
      await route.fulfill({ json: MOCK_THREAD_DATA });
    });

    await page.goto('/post/post-1');
    // Should show "across 2 protocols"
    await expect(page.getByText(/across 2 protocols/)).toBeVisible({ timeout: 30000 });
  });

  test('thread shows bridge count', async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await page.route('**/api/feed/post/post-1', async (route) => {
      await route.fulfill({ json: MOCK_SINGLE_POST });
    });
    await page.route('**/api/thread/**', async (route) => {
      await route.fulfill({ json: MOCK_THREAD_DATA });
    });

    await page.goto('/post/post-1');
    // Should show "1 bridged"
    await expect(page.getByText(/1 bridged/)).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Bridge status page', () => {
  test('bridge status endpoint returns active bridges', async ({ page }) => {
    await mockCrossProtocolApi(page);
    const response = await page.request.get('/api/bridge/status');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.ok).toBeTruthy();
    expect(data.bridges.length).toBeGreaterThan(0);
  });
});

test.describe('Cross-protocol identity', () => {
  test('cross-protocol identity linking available on profile', async ({ page }) => {
    await mockAuthApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });

    await page.goto('/profile');
    // The IdentityLinker component should be present
    await expect(page.locator('text=Linked Identities').or(page.getByText(/link/i))).toBeVisible({
      timeout: 30000,
    });
  });
});
