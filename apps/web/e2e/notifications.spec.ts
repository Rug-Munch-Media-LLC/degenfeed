// ═══════════════════════════════════════════════════════════════
// Notifications E2E Tests — Notification list, filters, read state
// ═══════════════════════════════════════════════════════════════

import { expect, test } from '@playwright/test';
import { MOCK_PREFERENCES, mockFeedApi } from './fixtures';

const MOCK_NOTIFICATIONS_RESPONSE = [
  {
    id: 'notif-1',
    type: 'like',
    protocol: 'nostr',
    actorName: 'Satoshi',
    actorHandle: 'satoshi',
    postText: 'Bitcoin is the future of money!',
    createdAt: Date.now() - 600000,
    read: false,
  },
  {
    id: 'notif-2',
    type: 'repost',
    protocol: 'farcaster',
    actorName: 'Builder Guy',
    actorHandle: 'builder',
    postText: 'Just deployed my first smart contract on Base 🚀',
    createdAt: Date.now() - 3600000,
    read: false,
  },
  {
    id: 'notif-3',
    type: 'reply',
    protocol: 'bluesky',
    actorName: 'Protocol Maxi',
    actorHandle: 'maxi.bsky.social',
    postText: 'AT Protocol is the most underrated.',
    createdAt: Date.now() - 10800000,
    read: true,
  },
  {
    id: 'notif-4',
    type: 'follow',
    protocol: 'lens',
    actorName: 'Lens Maxi',
    actorHandle: 'lensmaxi',
    createdAt: Date.now() - 86400000,
    read: true,
  },
  {
    id: 'notif-5',
    type: 'tip',
    protocol: 'tip',
    actorName: 'Bitcoiner',
    amount: '0.01',
    currency: 'ETH',
    createdAt: Date.now() - 1800000,
    read: false,
  },
];

test.describe('Notifications — signed out', () => {
  test('shows sign-in prompt when not authenticated', async ({ page }) => {
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: { signedInProtocols: {}, walletAddress: undefined } });
    });

    await page.goto('/notifications');
    await expect(page.getByText('Stay in the loop')).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator('button', { hasText: 'Connect Wallet to Get Started' }),
    ).toBeVisible();
  });
});

test.describe('Notifications — signed in', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth state as signed in
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({
        json: {
          signedInProtocols: { nostr: true, farcaster: true, lens: true, bluesky: true },
          walletAddress: '0x1234',
        },
      });
    });
    // Mock notifications
    await page.route('**/api/notifications', async (route) => {
      await route.fulfill({ json: MOCK_NOTIFICATIONS_RESPONSE });
    });
    // Mock notification prefs
    await page.route('**/api/notifications/prefs', async (route) => {
      await route.fulfill({
        json: {
          nostr: { likes: true, replies: true, reposts: true, follows: true, mentions: true },
          farcaster: { likes: true, replies: true, reposts: true, follows: true, mentions: true },
        },
      });
    });
    // Mock feed/preferences (for nav/sidebar)
    await mockFeedApi(page, undefined, MOCK_PREFERENCES);
  });

  test('notifications page loads with heading', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.locator('h1', { hasText: 'Notifications' })).toBeVisible({
      timeout: 30000,
    });
  });

  test('shows notification list with items', async ({ page }) => {
    await page.goto('/notifications');
    // Wait for notifications to load
    await expect(page.getByText('Satoshi').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Builder Guy')).toBeVisible();
    await expect(page.getByText('Protocol Maxi')).toBeVisible();
  });

  test('shows unread count in the header', async ({ page }) => {
    await page.goto('/notifications');
    // There are 3 unread notifications in our mock data
    await expect(page.getByText(/unread/)).toBeVisible({ timeout: 30000 });
  });

  test('shows different notification types', async ({ page }) => {
    await page.goto('/notifications');
    // Like type notification
    await expect(page.getByText('Liked your post')).toBeVisible({ timeout: 30000 });
    // Repost type notification
    await expect(page.getByText('Reposted your post')).toBeVisible();
    // Reply type
    await expect(page.getByText('Replied to you')).toBeVisible();
  });

  test('displays protocol badges on notifications', async ({ page }) => {
    await page.goto('/notifications');
    // Protocol badges should be visible (Nostr, Farcaster, Bluesky)
    await expect(page.getByText('Nostr').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Farcaster').first()).toBeVisible();
    await expect(page.getByText('Bluesky').first()).toBeVisible();
  });

  test('shows type group filter tabs', async ({ page }) => {
    await page.goto('/notifications');
    const typeTabs = ['All', 'Likes', 'Reposts', 'Replies', 'Follows', 'Mentions', 'Tips'];
    for (const tab of typeTabs) {
      await expect(page.getByText(tab).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('protocol filter pills are visible', async ({ page }) => {
    await page.goto('/notifications');
    const protocols = ['All', 'Nostr', 'Farcaster', 'Lens', 'Bluesky', 'Tips'];
    for (const p of protocols) {
      await expect(page.getByText(p).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('show post text preview on notifications', async ({ page }) => {
    await page.goto('/notifications');
    // Post text should be visible in quotes
    await expect(
      page.getByText('Bitcoin is the future of money!').or(page.getByText('Just deployed')),
    ).toBeVisible({ timeout: 15000 });
  });

  test('display time ago for notifications', async ({ page }) => {
    await page.goto('/notifications');
    // Time ago text
    await expect(page.getByText(/ago|just now/).first()).toBeVisible({ timeout: 15000 });
  });

  test('mark all read button is visible when unread exist', async ({ page }) => {
    await page.goto('/notifications');
    // Mark all read button should be visible (3 unread)
    await expect(page.locator('button', { hasText: 'Mark all read' })).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('Notifications — empty state', () => {
  test('shows empty state when no notifications', async ({ page }) => {
    // Mock auth as signed in
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({
        json: {
          signedInProtocols: { nostr: true },
          walletAddress: '0x1234',
        },
      });
    });
    // Return empty notifications
    await page.route('**/api/notifications', async (route) => {
      await route.fulfill({ json: [] });
    });
    await page.route('**/api/notifications/prefs', async (route) => {
      await route.fulfill({ json: {} });
    });
    await mockFeedApi(page, undefined, MOCK_PREFERENCES);

    await page.goto('/notifications');
    await expect(page.getByText('No notifications yet')).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText('When someone likes, reposts, or replies, it will show up here.'),
    ).toBeVisible();
  });
});
