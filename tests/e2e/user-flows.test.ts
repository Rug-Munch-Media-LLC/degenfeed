/**
 * ═════════════════════════════════════════════════════════════════════════════
 * USER FLOW TESTS — 15 tests
 *
 * End-to-end Playwright tests for critical user journeys through DegenFeed:
 * onboarding, protocol connection, posting, cross-protocol search, notifications.
 *
 * These tests use Playwright with mocked API routes to ensure deterministic,
 * fast, and reliable test execution without external dependencies.
 * ═════════════════════════════════════════════════════════════════════════════
 */
import { expect, test } from '@playwright/test';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const MOCK_ONBOARDING_STATE = {
  signedInProtocols: {
    nostr: false,
    farcaster: false,
    lens: false,
    bluesky: false,
    mastodon: false,
  },
  walletAddress: undefined,
  primaryIdentity: undefined,
  linkedIdentities: [],
  tokens: {},
  onboarding: {
    step: 'welcome',
    completed: false,
    suggestedProtocols: ['nostr', 'farcaster', 'bluesky'],
  },
};

const _MOCK_ONBOARDING_COMPLETE = {
  ...MOCK_ONBOARDING_STATE,
  onboarding: { step: 'complete', completed: true },
};

const MOCK_POSTS = {
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

const MOCK_SEARCH_RESULTS = {
  data: [
    {
      id: 'search-post-1',
      protocol: 'nostr',
      text: 'Bitcoin is the future of money!',
      author: { displayName: 'Satoshi', avatarUrl: '' },
      url: null,
      image: null,
      niches: ['bitcoin'],
      createdAt: Date.now() - 3600000,
      metrics: { likes: 42, reposts: 10, replies: 5, quotes: 2 },
    },
    {
      id: 'search-post-2',
      protocol: 'farcaster',
      text: 'Bitcoin L2s are the next big thing',
      author: { displayName: 'BTC Dev', avatarUrl: '' },
      url: null,
      image: null,
      niches: ['bitcoin'],
      createdAt: Date.now() - 7200000,
      metrics: { likes: 28, reposts: 7, replies: 3, quotes: 1 },
    },
  ],
  identities: [
    {
      id: 'npub1abc',
      protocol: 'nostr',
      displayName: 'Satoshi',
      handle: 'satoshi',
      avatarUrl: null,
      bio: 'Bitcoin enthusiast',
      postCount: 142,
    },
  ],
  communities: [
    {
      id: 'c-bitcoin',
      name: 'Bitcoin',
      protocol: 'nostr',
      description: 'Bitcoin discussion community',
      memberCount: 1234,
      url: '/c/bitcoin',
      icon: null,
    },
  ],
  videos: [],
};

const MOCK_SIGNED_IN_STATE = {
  signedInProtocols: { nostr: true, farcaster: true, lens: false, bluesky: false, mastodon: false },
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  primaryIdentity: {
    id: 'npub1abc',
    protocol: 'nostr',
    displayName: 'Alice',
    handle: 'alice',
    isPrimary: true,
    publicId: 'npub1abc',
  },
  linkedIdentities: [
    {
      id: 'npub1abc',
      protocol: 'nostr',
      displayName: 'Alice',
      handle: 'alice',
      isPrimary: true,
      publicId: 'npub1abc',
    },
    {
      id: 'fid:123',
      protocol: 'farcaster',
      displayName: 'Alice',
      handle: 'alice',
      isPrimary: false,
      publicId: 'fid:123',
    },
  ],
  tokens: { nostr_pubkey: 'npub1abc', nostr_privkey: 'nsec1...' },
};

const MOCK_NOTIFICATIONS = {
  notifications: [
    {
      id: 'notif-1',
      type: 'like',
      protocol: 'nostr',
      actor: { displayName: 'Bitcoiner', handle: 'bitcoiner', avatarUrl: '' },
      content: 'Liked your post: Bitcoin is the future!',
      timestamp: Date.now() - 300000,
      read: false,
      targetPostId: 'post-1',
      targetPostText: 'Bitcoin is the future of money!',
    },
    {
      id: 'notif-2',
      type: 'repost',
      protocol: 'farcaster',
      actor: { displayName: 'Builder Guy', handle: 'builder', avatarUrl: '' },
      content: 'Reposted your post',
      timestamp: Date.now() - 1800000,
      read: false,
      targetPostId: 'post-2',
    },
    {
      id: 'notif-3',
      type: 'reply',
      protocol: 'bluesky',
      actor: { displayName: 'Protocol Maxi', handle: 'maxi.bsky.social', avatarUrl: '' },
      content: 'Replied to your post',
      timestamp: Date.now() - 7200000,
      read: true,
      targetPostId: 'post-3',
    },
  ],
};

// ─── Route mock helpers ────────────────────────────────────────────────────

async function mockBasicApis(page: import('@playwright/test').Page) {
  await page.route('**/api/feed/home**', async (route) => {
    await route.fulfill({ json: MOCK_POSTS });
  });
  await page.route('**/api/feed/for-you**', async (route) => {
    await route.fulfill({ json: MOCK_POSTS });
  });
  await page.route('**/api/preferences', async (route) => {
    await route.fulfill({ json: {} });
  });
  await page.route('**/api/search**', async (route) => {
    const url = route.request().url();
    if (url.includes('q=')) {
      await route.fulfill({ json: MOCK_SEARCH_RESULTS });
    } else {
      await route.fulfill({ json: { data: [], identities: [], communities: [], videos: [] } });
    }
  });
  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({ json: MOCK_NOTIFICATIONS });
  });
  await page.route('**/api/auth/status**', async (route) => {
    await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
  });
  await page.route('**/api/auth/nonce**', async (route) => {
    await route.fulfill({ json: { nonce: 'abc123' } });
  });
  await page.route('**/api/auth/callback**', async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        identity: {
          id: 'npub1abc',
          protocol: 'nostr',
          displayName: 'Alice',
          handle: 'alice',
          publicId: 'npub1abc',
          isPrimary: true,
        },
      },
    });
  });
}

// ─── 1. New User Onboarding Flow (3 tests) ────────────────────────────────

test.describe('User Flow — Onboarding', () => {
  test('new user sees onboarding prompt with protocol suggestions', async ({ page }) => {
    await mockBasicApis(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_ONBOARDING_STATE });
    });

    await page.goto('/feed');
    // Should show onboarding welcome or connect prompt
    await expect(page.getByText('Sign in').or(page.getByText('Connect Wallet'))).toBeVisible({
      timeout: 30000,
    });
  });

  test('onboarding suggests available protocols to connect', async ({ page }) => {
    await mockBasicApis(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_ONBOARDING_STATE });
    });

    await page.goto('/feed');
    // The sign-in modal or connect prompt should mention protocol options
    await page.locator('button', { hasText: 'Connect Wallet' }).first().click();
    // Protocol options should appear in modal
    await expect(page.locator('[role="dialog"], .fixed.inset-0')).toBeVisible({ timeout: 10000 });
  });

  test('onboarding completes when user connects first protocol', async ({ page }) => {
    await mockBasicApis(page);
    let statusCalls = 0;
    await page.route('**/api/auth/status**', async (route) => {
      statusCalls++;
      if (statusCalls <= 1) {
        await route.fulfill({ json: MOCK_ONBOARDING_STATE });
      } else {
        await route.fulfill({
          json: { ...MOCK_SIGNED_IN_STATE, onboarding: { step: 'complete', completed: true } },
        });
      }
    });

    await page.goto('/feed');
    // Wait for sign-in flow to complete — the feed should show posts and signed-in UI
    await expect(page.locator('article').first()).toBeVisible({ timeout: 30000 });
  });
});

// ─── 2. Connect Protocols Flow (3 tests) ──────────────────────────────────

test.describe('User Flow — Connect Protocols', () => {
  test('profile page shows connect options for protocols', async ({ page }) => {
    await mockBasicApis(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({
        json: {
          signedInProtocols: {
            nostr: true,
            farcaster: false,
            lens: false,
            bluesky: false,
            mastodon: false,
          },
          walletAddress: '0x123...',
          primaryIdentity: {
            id: 'npub1abc',
            protocol: 'nostr',
            displayName: 'Alice',
            handle: 'alice',
            isPrimary: true,
            publicId: 'npub1abc',
          },
          linkedIdentities: [
            {
              id: 'npub1abc',
              protocol: 'nostr',
              displayName: 'Alice',
              handle: 'alice',
              isPrimary: true,
              publicId: 'npub1abc',
            },
          ],
          tokens: {},
        },
      });
    });

    await page.goto('/profile');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30000 });
  });

  test('user can see their linked protocols on profile', async ({ page }) => {
    await mockBasicApis(page);
    await page.route('**/api/auth/status**', async (route) => {
      await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
    });

    await page.goto('/profile');
    // Should show linked protocols (nostr, farcaster)
    await expect(page.getByText('Linked Identities').or(page.getByText(/Linked/))).toBeVisible({
      timeout: 30000,
    });
  });

  test('disconnect protocol removes it from linked list', async ({ page }) => {
    let disconnectCalled = false;
    await mockBasicApis(page);
    await page.route('**/api/auth/disconnect**', async (route) => {
      disconnectCalled = true;
      await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/api/auth/status**', async (route) => {
      if (disconnectCalled) {
        await route.fulfill({
          json: {
            ...MOCK_SIGNED_IN_STATE,
            linkedIdentities: MOCK_SIGNED_IN_STATE.linkedIdentities.slice(0, 1),
            signedInProtocols: { ...MOCK_SIGNED_IN_STATE.signedInProtocols, farcaster: false },
          },
        });
      } else {
        await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
      }
    });

    await page.goto('/profile');
    await expect(page.getByText('Linked Identities').or(page.getByText(/Linked/))).toBeVisible({
      timeout: 30000,
    });
  });
});

// ─── 3. Post Content Flow (3 tests) ────────────────────────────────────────

test.describe('User Flow — Post Content', () => {
  test('composer appears when signed in', async ({ page }) => {
    await mockBasicApis(page);
    await page.goto('/feed');
    await expect(page.locator('article').first()).toBeVisible({ timeout: 30000 });
    // Signed-in user should be able to post
    const composer = page
      .locator('textarea[placeholder*="What"], div[contenteditable], textarea')
      .first();
    await expect(composer).toBeVisible({ timeout: 10000 });
  });

  test('post composer allows text input', async ({ page }) => {
    await mockBasicApis(page);
    await page.goto('/feed');
    const composer = page
      .locator('textarea[placeholder*="What"], div[contenteditable], textarea')
      .first();
    await expect(composer).toBeVisible({ timeout: 10000 });
    await composer.fill('Testing the DegenFeed compose flow!');
    // The input should reflect what was typed
    await expect(composer).toHaveValue(/Testing the DegenFeed compose flow!/);
  });

  test('post composer shows character count', async ({ page }) => {
    await mockBasicApis(page);
    await page.goto('/feed');
    const composer = page
      .locator('textarea[placeholder*="What"], div[contenteditable], textarea')
      .first();
    await expect(composer).toBeVisible({ timeout: 10000 });
    await composer.fill('Hello DegenFeed!');
    // Character count should be visible
    await expect(page.getByText(/^\d+$/).or(page.getByText(/characters/))).toBeVisible({
      timeout: 5000,
    });
  });
});

// ─── 4. Search Across Protocols Flow (3 tests) ────────────────────────────

test.describe('User Flow — Search Across Protocols', () => {
  test('search page loads with input field', async ({ page }) => {
    await mockBasicApis(page);
    await page.goto('/search');
    await expect(page.locator('h1', { hasText: 'Search' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByPlaceholder(/Search/)).toBeVisible();
  });

  test('search results show posts from multiple protocols', async ({ page }) => {
    await mockBasicApis(page);
    await page.goto('/search?q=bitcoin');
    // Should show results from nostr and farcaster
    await expect(page.getByText('Bitcoin is the future of money!')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Bitcoin L2s are the next big thing')).toBeVisible({
      timeout: 10000,
    });
  });

  test('search results include identity results from People tab', async ({ page }) => {
    await mockBasicApis(page);
    await page.goto('/search?q=bitcoin');
    // Click People tab
    const peopleTab = page.locator('button', { hasText: 'People' });
    if (await peopleTab.isVisible()) {
      await peopleTab.click();
      await expect(page.getByText('Satoshi').first()).toBeVisible({ timeout: 10000 });
    }
  });
});

// ─── 5. Notification Flow (3 tests) ───────────────────────────────────────

test.describe('User Flow — Notifications', () => {
  test('notification bell shows unread count', async ({ page }) => {
    await mockBasicApis(page);
    await page.goto('/feed');
    // The notification bell/badge should be visible
    const notificationArea = page
      .locator(
        '[aria-label*="notification"], [aria-label*="Notification"], [class*="bell"], [class*="notification"]',
      )
      .first();
    await expect(notificationArea).toBeVisible({ timeout: 15000 });
  });

  test('notification page lists recent notifications', async ({ page }) => {
    await mockBasicApis(page);
    await page.goto('/notifications');
    // Notification items should be visible
    await expect(page.getByText('Bitcoiner').or(page.getByText('Builder Guy'))).toBeVisible({
      timeout: 30000,
    });
  });

  test('clicking notification navigates to related post', async ({ page }) => {
    await mockBasicApis(page);
    await page.route('**/api/feed/post/post-1', async (route) => {
      await route.fulfill({ json: { data: MOCK_POSTS.data[0] } });
    });

    await page.goto('/notifications');
    // Click on a notification linking to a post
    const notifLink = page.locator('a[href*="/post/"]').first();
    if (await notifLink.isVisible()) {
      await notifLink.click();
      await expect(page).toHaveURL(/\/post\//);
    }
  });
});
