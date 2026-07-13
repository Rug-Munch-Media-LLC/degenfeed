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
  RedditProvider: createMockProvider('rss'),
  RmiDataBusProvider: createMockProvider('rmi'),
  RssProvider: createMockProvider('rss'),
  ThreadsProvider: createMockProvider('threads'),
}));

import type { Env } from '../index';
import {
  handleFeedHealth,
  handleHomeFeed,
  handleProviderFeed,
  handleTrendingFeed,
} from '../routes/feed';

describe('handleHomeFeed', () => {
  const mockEnv: Env = {};

  beforeEach(() => {
    mockFetchFeed.mockReset();
    mockFetchFeed.mockResolvedValue({ posts: [] });
  });

  it('should return a response with data array', async () => {
    const req = new Request('http://localhost/api/feed/home?limit=5');
    const res = await handleHomeFeed(req, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: Record<string, unknown> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
    expect(body.meta.limit).toBe(5);
    expect(body.meta.total).toBe(0);
    expect(body.meta.perProtocol).toBeDefined();
  });

  it('should default to all protocols', async () => {
    const req = new Request('http://localhost/api/feed/home');
    const res = await handleHomeFeed(req, mockEnv);
    const body = (await res.json()) as { data: unknown[]; meta: Record<string, unknown> };
    expect(body.meta).toBeDefined();
    expect(body.meta.perProtocol).toBeDefined();
  });

  it('should handle empty results gracefully', async () => {
    const req = new Request('http://localhost/api/feed/home?protocols=nostr');
    const res = await handleHomeFeed(req, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: Record<string, unknown> };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should cap limit to 200', async () => {
    const req = new Request('http://localhost/api/feed/home?limit=500');
    const res = await handleHomeFeed(req, mockEnv);
    const body = (await res.json()) as { meta: { limit: number } };
    expect(body.meta.limit).toBe(200);
  });

  it('should include fetchedAt in meta', async () => {
    const req = new Request('http://localhost/api/feed/home');
    const res = await handleHomeFeed(req, mockEnv);
    const body = (await res.json()) as { meta: { fetchedAt: number } };
    expect(typeof body.meta.fetchedAt).toBe('number');
  });

  it('should include posts from providers', async () => {
    mockFetchFeed.mockResolvedValue({
      posts: [
        {
          id: 'nostr:test',
          protocol: 'nostr',
          author: {
            id: 'nostr:pk',
            primary: { protocol: 'nostr', id: 'pk' },
            handles: {
              nostr: 'pk',
              farcaster: null,
              lens: null,
              bluesky: null,
              threads: null,
              rss: null,
              mastodon: null,
            },
            displayName: 'pk',
            bio: '',
            avatarUrl: '',
            verified: [],
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: 'hello world this is a real post about bitcoin',
          embeds: [],
          createdAt: Date.now(),
          metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: null,
          niches: [],
        },
      ],
    });
    const req = new Request('http://localhost/api/feed/home?protocols=nostr');
    const res = await handleHomeFeed(req, mockEnv);
    const body = (await res.json()) as { data: unknown[]; meta: Record<string, unknown> };
    expect(body.data.length).toBe(1);
  });

  it('should handle provider results with scoring metadata', async () => {
    mockFetchFeed.mockResolvedValue({
      posts: [
        {
          id: 'nostr:bitcoin',
          protocol: 'nostr',
          author: {
            id: 'nostr:abc',
            primary: { protocol: 'nostr', id: 'abc' },
            handles: {
              nostr: 'abc',
              farcaster: null,
              lens: null,
              bluesky: null,
              threads: null,
              rss: null,
              mastodon: null,
            },
            displayName: 'Satoshi',
            bio: '',
            avatarUrl: '',
            verified: [],
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: 'Bitcoin is a decentralized cryptocurrency that enables peer-to-peer transactions without intermediaries, powered by blockchain technology',
          embeds: [],
          createdAt: Date.now(),
          metrics: { likes: 42, reposts: 5, replies: 3, quotes: 1 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 42, reposts: 5, replies: 3, quotes: 1 },
          },
          raw: null,
          niches: [],
        },
      ],
    });
    const req = new Request('http://localhost/api/feed/home?protocols=nostr&allowNonCrypto=true');
    const res = await handleHomeFeed(req, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: unknown[];
      meta: { total: number; limit: number; perProtocol: Record<string, number> };
    };
    expect(body.meta.limit).toBe(50);
    expect(body.meta.perProtocol).toBeDefined();
  });
});

describe('handleTrendingFeed', () => {
  it('should delegate to home feed', async () => {
    const req = new Request('http://localhost/api/feed/trending?limit=5');
    const res = await handleTrendingFeed(req, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: Record<string, unknown> };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('handleProviderFeed', () => {
  it('returns posts for a single provider', async () => {
    mockFetchFeed.mockResolvedValue({
      posts: [
        {
          id: 'bsky:test',
          protocol: 'bluesky',
          author: {
            id: 'bluesky:did',
            primary: { protocol: 'bluesky', id: 'did' },
            handles: {
              nostr: null,
              farcaster: null,
              lens: null,
              bluesky: 'test',
              threads: null,
              rss: null,
              mastodon: null,
            },
            displayName: 'test',
            bio: '',
            avatarUrl: '',
            verified: [],
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: 'bluesky post about solana',
          embeds: [],
          createdAt: Date.now(),
          metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: null,
          niches: [],
        },
      ],
    });
    const req = new Request('http://localhost/api/feed/bluesky?limit=5');
    const res = await handleProviderFeed(req, {}, 'bluesky');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; meta: { protocol: string } };
    expect(body.data.length).toBe(1);
    expect(body.meta.protocol).toBe('bluesky');
  });

  it('returns 400 for unknown provider', async () => {
    const req = new Request('http://localhost/api/feed/unknown');
    const res = await handleProviderFeed(req, {}, 'unknown');
    expect(res.status).toBe(400);
  });
});

describe('handleFeedHealth', () => {
  it('returns health status for all providers', async () => {
    mockHealthCheck.mockResolvedValue({ healthy: true, latencyMs: 10 });
    const req = new Request('http://localhost/api/feed/health');
    const res = await handleFeedHealth(req, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { health: Record<string, unknown> };
    expect(body.health.nostr).toBeDefined();
    expect(body.health.bluesky).toBeDefined();
  });
});
