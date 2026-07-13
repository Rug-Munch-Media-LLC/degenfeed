import { expect, test } from '@playwright/test';

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
      text: 'AT Protocol is the most underrated social graph protocol.',
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
    trending: [
      { topic: 'bitcoin', count: 1, score: 42 },
      { topic: 'base', count: 1, score: 128 },
    ],
    fetchedAt: Date.now(),
    topOfHour: 'post-2',
  },
};

const MOCK_REPLIES = {
  data: [
    {
      id: 'reply-1',
      protocol: 'nostr',
      text: 'Totally agree! Bitcoin fixes this.',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      author: {
        id: 'npub:def',
        displayName: 'Bitcoiner',
        avatarUrl: '',
        handle: 'bitcoiner',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 7, reposts: 1, replies: 0, quotes: 0 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: [],
      parentId: 'post-1',
      raw: {},
    },
    {
      id: 'reply-2',
      protocol: 'farcaster',
      text: 'Have you tried deploying on Optimism? Cheaper fees.',
      createdAt: new Date(Date.now() - 900000).toISOString(),
      author: {
        id: 'fid:456',
        displayName: 'Gas Saver',
        avatarUrl: '',
        handle: 'gassaver',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 3, reposts: 0, replies: 1, quotes: 0 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: [],
      parentId: 'post-2',
      raw: {},
    },
  ],
};

const MOCK_SINGLE_POST = {
  data: MOCK_POSTS.data[0],
};

test.describe('DegenFeed smoke tests', () => {
  test.describe('Feed', () => {
    test('feed page loads posts and shows For You tab', async ({ page }) => {
      await page.route('**/api/feed/home**', async (route) => {
        await route.fulfill({ json: MOCK_POSTS });
      });
      await page.route('**/api/preferences', async (route) => {
        await route.fulfill({ json: {} });
      });

      await page.goto('/feed');
      await expect(page.locator('article').first()).toBeVisible({ timeout: 30000 });
      await expect(page.locator('button', { hasText: 'For You' })).toBeVisible();
      await expect(page.locator('h1', { hasText: 'DegenFeed' })).toBeVisible();
    });
  });

  test.describe('Section navigation', () => {
    test('navigates to /home/nostr and renders section heading', async ({ page }) => {
      await page.route('**/api/feed/home**', async (route) => {
        await route.fulfill({ json: MOCK_POSTS });
      });
      await page.route('**/api/preferences', async (route) => {
        await route.fulfill({ json: {} });
      });

      await page.goto('/home/nostr');
      await expect(page.locator('h1', { hasText: 'Nostr' })).toBeVisible({ timeout: 30000 });
      await expect(page.locator('article').first()).toBeVisible();
    });
  });

  test.describe('Post detail', () => {
    test('displays post content and replies', async ({ page }) => {
      await page.route('**/api/feed/home**', async (route) => {
        await route.fulfill({ json: MOCK_POSTS });
      });
      await page.route('**/api/preferences', async (route) => {
        await route.fulfill({ json: {} });
      });
      await page.route('**/api/feed/post/post-1', async (route) => {
        await route.fulfill({ json: MOCK_SINGLE_POST });
      });
      await page.route('**/api/feed/post/post-1/replies**', async (route) => {
        await route.fulfill({ json: MOCK_REPLIES });
      });

      await page.goto('/post/post-1');
      await expect(page.locator('text=Back to feed')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('article')).toBeVisible();
      await expect(page.locator('text=Bitcoin is the future of money!')).toBeVisible();
      await expect(page.locator('text=replies')).toBeVisible();
    });
  });

  test.describe('Discover page', () => {
    test('renders heading and account cards', async ({ page }) => {
      const MOCK_DISCOVER = [
        {
          id: '1',
          username: 'alice',
          acct: 'alice',
          display_name: 'Alice',
          avatar: 'https://example.com/avatar.png',
          note: 'Crypto enthusiast',
          followers_count: 1234,
          instance: 'https://bitcoinhackers.org',
        },
        {
          id: '2',
          username: 'bob',
          acct: 'bob',
          display_name: 'Bob',
          avatar: 'https://example.com/avatar2.png',
          note: 'Bitcoin maxi',
          followers_count: 5678,
          instance: 'https://bitcoinhackers.org',
        },
      ];

      await page.route('**/api/discover**', async (route) => {
        await route.fulfill({ json: MOCK_DISCOVER });
      });

      await page.goto('/discover');
      await expect(page.locator('h1', { hasText: 'Fediverse Discovery' })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.locator('text=Alice')).toBeVisible();
      await expect(page.locator('text=Bob')).toBeVisible();
    });
  });

  test.describe('Videos page', () => {
    test('renders heading and video grid', async ({ page }) => {
      await page.route('**/api/feed/home?type=video**', async (route) => {
        await route.fulfill({ json: MOCK_POSTS });
      });

      await page.goto('/videos');
      await expect(page.locator('h1', { hasText: 'Video' })).toBeVisible({ timeout: 30000 });
      await expect(page.locator('text=Video Feed')).toBeVisible();
      await expect(page.locator('article, [class*="rounded-2xl"]').first()).toBeVisible();
    });
  });

  test.describe('News page', () => {
    test('renders news articles', async ({ page }) => {
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
            embeds: [
              {
                kind: 'link' as const,
                url: 'https://example.com/article',
              },
            ],
            metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
            },
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

      await page.route('**/api/feed/news**', async (route) => {
        await route.fulfill({ json: MOCK_NEWS });
      });

      await page.goto('/news');
      await expect(page.locator('text=Bitcoin reaches new all-time high')).toBeVisible({
        timeout: 30000,
      });
    });
  });

  test.describe('Profile page', () => {
    test('shows sign-in prompt when not authenticated', async ({ page }) => {
      await page.goto('/profile');
      await expect(page.locator('h1', { hasText: 'DegenFeed User' })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.locator('button', { hasText: 'Connect an account' })).toBeVisible();
    });
  });

  test.describe('Mobile navigation', () => {
    test('BottomNav is visible on mobile viewport', async ({ page }) => {
      test.use({ viewport: { width: 390, height: 844 } });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/feed');
      await expect(page.locator('nav[aria-label="Mobile"]')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('nav[aria-label="Mobile"] a', { hasText: 'Feed' })).toBeVisible();
      await expect(page.locator('nav[aria-label="Mobile"] a', { hasText: 'News' })).toBeVisible();
      await expect(page.locator('nav[aria-label="Mobile"] a', { hasText: 'Videos' })).toBeVisible();
      await expect(
        page.locator('nav[aria-label="Mobile"] a', { hasText: 'Explore' }),
      ).toBeVisible();
    });
  });
});
