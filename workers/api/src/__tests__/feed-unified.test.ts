/**
 * Tests for the unified feed route (/api/feed/unified).
 *
 * Verifies the fix that wires REAL aggregated content instead of demo
 * seed fallback:
 *  1. Default request (no protocols/sources params) fetches core
 *     protocols in parallel and returns real posts.
 *  2. Quality scores are attached to every post.
 *  3. Diversity caps authors (max 2 per page) and interleaves protocols.
 *  4. Seed/demo fallback only triggers when every source returns empty.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetchFeed, mockHealthCheck } = vi.hoisted(() => ({
  mockFetchFeed: vi.fn(),
  mockHealthCheck: vi.fn(),
}));

function createMockProvider(protocol: string) {
  // biome-ignore lint/complexity/useArrowFunction: must be constructable for vi.fn() mock
  return vi.fn(function () {
    return { protocol, fetchFeed: mockFetchFeed, healthCheck: mockHealthCheck };
  });
}

vi.mock('@degenfeed/feed-providers', () => ({
  BlueskyProvider: createMockProvider('bluesky'),
  FarcasterProvider: createMockProvider('farcaster'),
  LemmyProvider: createMockProvider('lemmy'),
  LensProvider: createMockProvider('lens'),
  MastodonProvider: createMockProvider('mastodon'),
  NostrProvider: createMockProvider('nostr'),
  PonderProvider: createMockProvider('ponder'),
  RedditProvider: createMockProvider('reddit'),
  RmiDataBusProvider: createMockProvider('rmi'),
  RssProvider: createMockProvider('rss'),
  ThreadsProvider: createMockProvider('threads'),
}));

vi.mock('../feed/unified-fetchers', () => ({
  fetchLemmyPosts: vi.fn(async () => ({ posts: [] })),
  fetchPeerTubeVideos: vi.fn(async () => []),
  fetchYouTubeVideos: vi.fn(async () => ({ posts: [] })),
}));

import type { UnifiedPost } from '@degenfeed/types';
import { handleUnifiedFeed } from '../routes/feed-unified';

function makePost(protocol: string, id: string, overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  const now = Date.now();
  return {
    id: `${protocol}:${id}`,
    protocol: protocol as UnifiedPost['protocol'],
    author: {
      id: `author-${protocol}-${id}`,
      displayName: `Author ${protocol} ${id}`,
      bio: '',
      avatarUrl: '',
      followerCount: 100,
      followingCount: 10,
      verified: [],
      links: [],
      keys: {},
      handles: {},
      primary: { protocol: protocol as UnifiedPost['protocol'], id: `primary-${id}` },
    },
    text: `Real ${protocol} post ${id} about bitcoin and defi yield staking.`,
    html: '',
    embeds: [],
    createdAt: now - 3600000 * (Number(id) || 1),
    metrics: { likes: 50, reposts: 10, replies: 5, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 50, reposts: 10, replies: 5, quotes: 0 },
    },
    raw: { protocol, id },
    niches: ['crypto', 'defi'],
    ...overrides,
  };
}

const PROTOCOLS: Array<UnifiedPost['protocol']> = [
  'nostr',
  'farcaster',
  'mastodon',
  'bluesky',
  'rss',
];

describe('handleUnifiedFeed', () => {
  beforeEach(() => {
    mockFetchFeed.mockReset();
    mockHealthCheck.mockReset();
  });

  it('returns real aggregated posts from 3+ protocols (no demo) on default request', async () => {
    const postsByProtocol = new Map<string, UnifiedPost[]>();
    for (const protocol of PROTOCOLS) {
      const posts = [1, 2, 3].map((n) => makePost(protocol, String(n)));
      postsByProtocol.set(protocol, posts);
      mockFetchFeed.mockReturnValueOnce({ posts });
    }

    const req = new Request('http://localhost/api/feed/unified?limit=50');
    const res = await handleUnifiedFeed(req, {});
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: Array<UnifiedPost & { qualityScore?: number; protocol: string }>;
      meta: { isDemo?: boolean; total?: number };
    };

    // Real posts, not demo
    expect(body.data.length).toBeGreaterThanOrEqual(5);
    expect(body.meta.isDemo).toBe(false);
    for (const post of body.data) {
      expect(post.protocol).not.toBe('_demo');
    }

    // 3+ protocols represented
    const protocols = new Set(body.data.map((p) => p.protocol));
    expect(protocols.size).toBeGreaterThanOrEqual(3);

    // Quality scores attached (0-100)
    for (const post of body.data) {
      expect(typeof post.qualityScore).toBe('number');
      expect(post.qualityScore!).toBeGreaterThanOrEqual(0);
      expect(post.qualityScore!).toBeLessThanOrEqual(100);
    }
  });

  it('sorts by date newest first when sort=latest', async () => {
    for (const protocol of PROTOCOLS) {
      const posts = [
        makePost(protocol, '1', { createdAt: Date.now() - 30 * 3600000 }),
        makePost(protocol, '2', { createdAt: Date.now() - 5 * 3600000 }),
        makePost(protocol, '3', { createdAt: Date.now() - 2 * 3600000 }),
      ];
      mockFetchFeed.mockReturnValueOnce({ posts });
    }

    const req = new Request('http://localhost/api/feed/unified?limit=50&sort=latest');
    const res = await handleUnifiedFeed(req, {});
    const body = (await res.json()) as { data: Array<{ createdAt: number }> };

    const timestamps = body.data.map((p) => p.createdAt);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]!).toBeGreaterThanOrEqual(timestamps[i]!);
    }
  });

  it('rotates creators (max 2 posts per author per page)', async () => {
    // One protocol floods 6 posts from the same author
    const sameAuthor = makePost('nostr', '1');
    const flood = [1, 2, 3, 4, 5, 6].map((n) => ({
      ...makePost('nostr', `f${n}`),
      author: sameAuthor.author,
    }));
    mockFetchFeed.mockReturnValueOnce({ posts: flood });
    for (const protocol of PROTOCOLS.slice(1)) {
      mockFetchFeed.mockReturnValueOnce({ posts: [] });
    }

    const req = new Request('http://localhost/api/feed/unified?limit=50');
    const res = await handleUnifiedFeed(req, {});
    const body = (await res.json()) as { data: Array<{ author: { id: string } }> };

    const authorCount = body.data.filter((p) => p.author.id === sameAuthor.author.id).length;
    expect(authorCount).toBeLessThanOrEqual(2);
  });

  it('falls back to demo content only when every source returns empty', async () => {
    for (const _protocol of PROTOCOLS) {
      mockFetchFeed.mockReturnValueOnce({ posts: [] });
    }

    const req = new Request('http://localhost/api/feed/unified?limit=5');
    const res = await handleUnifiedFeed(req, {});
    const body = (await res.json()) as {
      data: Array<{ protocol: string }>;
      meta: { isDemo?: boolean };
    };

    expect(body.meta.isDemo).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]?.protocol).toBe('_demo');
  });

  it('accepts niches + timeRange params and filters by them', async () => {
    for (const protocol of PROTOCOLS) {
      const posts = [
        makePost(protocol, '1', {
          text: 'Trading signal: BTC breakout on high volume. $BTC',
          niches: ['trading', 'bitcoin'],
          createdAt: Date.now() - 3600000,
        }),
        makePost(protocol, '2', {
          text: 'Music review: new album drops this week.',
          niches: ['music'],
          createdAt: Date.now() - 48 * 3600000,
        }),
      ];
      mockFetchFeed.mockReturnValueOnce({ posts });
    }

    const req = new Request(
      'http://localhost/api/feed/unified?limit=50&niches=trading,bitcoin&time=24h',
    );
    const res = await handleUnifiedFeed(req, {});
    const body = (await res.json()) as { data: Array<{ niches: string[] }> };

    expect(body.data.length).toBeGreaterThan(0);
    for (const post of body.data) {
      // The 24h window excludes the 48h-old music post
      const matchesNiche = post.niches.some((n) => n === 'trading' || n === 'bitcoin');
      expect(matchesNiche).toBe(true);
    }
  });
});
