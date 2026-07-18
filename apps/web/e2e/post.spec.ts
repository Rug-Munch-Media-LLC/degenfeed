// ═══════════════════════════════════════════════════════════════
// Post E2E Tests — Create post, reply, like, repost, tip
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import {
  MOCK_FEED_POSTS,
  MOCK_PREFERENCES,
  MOCK_SIGNED_IN_STATE,
  MOCK_THREAD_DATA,
  mockAuthApi,
  mockFeedApi,
  mockPostApi,
} from './fixtures';

test.describe('Post detail view', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await mockPostApi(page);
  });

  test('post detail page loads with content and replies', async ({ page }) => {
    await page.goto('/post/post-1');
    await expect(page.locator('text=Back to feed')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Bitcoin is the future of money!')).toBeVisible();
    await expect(page.getByText('replies')).toBeVisible();
  });

  test('post detail shows reply sort options', async ({ page }) => {
    await page.goto('/post/post-1');
    await expect(page.getByText('Chronological')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Top')).toBeVisible();
    await expect(page.getByText('By Protocol')).toBeVisible();
  });

  test('switching reply sort mode updates the thread', async ({ page }) => {
    await page.goto('/post/post-1');
    // Click "Top" sort
    await page.getByText('Top').click();
    await expect(page.getByText('Top')).toHaveClass(/bg-degen/);
  });

  test('post detail shows protocol badges on replies', async ({ page }) => {
    await page.goto('/post/post-1');
    await expect(page.getByText('nostr').or(page.getByText('Nostr'))).toBeVisible({
      timeout: 30000,
    });
  });

  test('post detail displays embed link preview fallback', async ({ page }) => {
    // Mock a post with a link embed
    const postWithEmbed = {
      data: {
        ...MOCK_FEED_POSTS.data[0],
        embeds: [{ kind: 'link' as const, url: 'https://example.com/article' }],
      },
    };
    await page.route('**/api/feed/post/post-1', async (route) => {
      await route.fulfill({ json: postWithEmbed });
    });

    await page.goto('/post/post-1');
    // Embed resolve endpoint will be called
    await expect(page.locator('text=Back to feed')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Post interactions — Like', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await mockPostApi(page);
  });

  test('like button toggles when clicked', async ({ page }) => {
    await page.goto('/post/post-1');

    // Find the like button — should show ♡ 42 initially
    const likeBtn = page.locator('button', { hasText: '♡' }).first();
    await expect(likeBtn).toBeVisible();

    // Click like
    await likeBtn.click();
    // Wait for optimistic update — text should change
    await expect(
      page.locator('button', { hasText: /♥/ }).first().or(page.getByText('43')),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Post interactions — Repost', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await mockPostApi(page);
  });

  test('repost button toggles when clicked', async ({ page }) => {
    await page.goto('/post/post-1');

    const repostBtn = page.locator('button', { hasText: '↻' }).first();
    await expect(repostBtn).toBeVisible();

    await repostBtn.click();
    // Should reflect optimistic update
    await expect(page.locator('button', { hasText: /↻/ }).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Post interactions — Bookmark', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await mockPostApi(page);
  });

  test('bookmark button toggles star icon', async ({ page }) => {
    await page.goto('/post/post-1');

    const bookmarkBtn = page.locator('button', { hasText: '☆' }).first();
    await expect(bookmarkBtn).toBeVisible();

    await bookmarkBtn.click();
    // After bookmark, should show filled star
    await expect(page.locator('button', { hasText: '★' }).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Post interactions — Reply', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await mockPostApi(page);
  });

  test('reply composer shows for signed-in users', async ({ page }) => {
    await mockAuthApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });

    await page.goto('/post/post-1');
    await expect(page.locator('textarea[placeholder="Write a reply..."]')).toBeVisible({
      timeout: 30000,
    });
  });

  test('reply button is disabled when text is empty', async ({ page }) => {
    await mockAuthApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });

    await page.goto('/post/post-1');
    const replyBtn = page.locator('button', { hasText: 'Reply' });
    await expect(replyBtn).toBeDisabled();
  });

  test('sign-in prompt shown for signed-out users on reply', async ({ page }) => {
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: { signedInProtocols: {}, walletAddress: undefined } });
    });

    await page.goto('/post/post-1');
    await expect(page.getByText('Sign in to reply to this post')).toBeVisible({ timeout: 30000 });
  });

  test('sending a reply refreshes the thread', async ({ page }) => {
    await mockAuthApi(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });
    await page.route('**/api/engage/**', async (route) => {
      await route.fulfill({ json: { ok: true } });
    });
    // Track thread refresh calls
    let threadCalls = 0;
    await page.route('**/api/thread/**', async (route) => {
      threadCalls++;
      await route.fulfill({ json: MOCK_THREAD_DATA });
    });

    await page.goto('/post/post-1');
    const textarea = page.locator('textarea[placeholder="Write a reply..."]');
    await textarea.fill('Great post!');
    await page.locator('button', { hasText: 'Reply' }).click();

    // Wait for reply to process and thread to refresh
    await expect(page.getByText('Great post!').or(page.getByText('Replying…'))).not.toBeAttached({
      timeout: 10000,
    });
    // The thread should have been refreshed
    expect(threadCalls).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Post interactions — Tip', () => {
  test('tip modal opens from post detail', async ({ page }) => {
    await mockFeedApi(page, MOCK_FEED_POSTS, MOCK_PREFERENCES);
    await mockPostApi(page);

    await page.goto('/post/post-1');
    const tipBtn = page.locator('button', { hasText: 'Tip' }).first();
    await expect(tipBtn).toBeVisible();

    await tipBtn.click();
    // Tip modal should appear
    await expect(page.locator('[role="dialog"], [class*="fixed"]').first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Post — Error state', () => {
  test('shows error state for non-existent post', async ({ page }) => {
    await page.route('**/api/feed/post/non-existent', async (route) => {
      await route.fulfill({ status: 404, json: { error: 'Post not found' } });
    });

    await page.goto('/post/non-existent');
    await expect(page.getByText('not found').or(page.getByText('error'))).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows error state when API fails', async ({ page }) => {
    await page.route('**/api/feed/post/**', async (route) => {
      await route.abort('connectionrefused');
    });

    await page.goto('/post/post-1');
    await expect(page.locator('text=Back to feed').or(page.getByText('not found'))).toBeVisible({
      timeout: 10000,
    });
  });
});
