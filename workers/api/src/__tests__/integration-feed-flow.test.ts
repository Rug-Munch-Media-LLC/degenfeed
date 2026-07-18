/**
 * @degenfeed/api — Integration test: Full feed flow
 *
 * Tests the end-to-end feed pipeline: fetch → deduplicate → score → respond.
 * Uses mocked providers but tests the actual handler flow.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock the feed providers
const mockFetchFeed = vi.fn().mockResolvedValue({
  posts: [
    {
      id: 'nostr:note1',
      protocol: 'nostr',
      author: {
        id: 'nostr:author1',
        displayName: 'Alice',
        handles: { nostr: 'alice' },
        followerCount: 100,
        followingCount: 50,
        verified: [],
        links: [],
        keys: {},
        primary: { protocol: 'nostr', id: 'author1' },
        bio: 'Crypto enthusiast',
        avatarUrl: '',
      },
      text: 'Bitcoin is the future of decentralized finance.',
      embeds: [],
      createdAt: Date.now() - 3600000,
      metrics: { likes: 10, reposts: 5, replies: 2, quotes: 0 },
    },
    {
      id: 'farcaster:cast1',
      protocol: 'farcaster',
      author: {
        id: 'farcaster:author2',
        displayName: 'Bob',
        handles: { farcaster: 'bob' },
        followerCount: 500,
        followingCount: 200,
        verified: [{ protocol: 'farcaster', badge: 'verified' }],
        links: [],
        keys: {},
        primary: { protocol: 'farcaster', id: 'author2' },
        bio: 'Builder',
        avatarUrl: '',
      },
      text: 'Just deployed a new smart contract on Ethereum L2.',
      embeds: [{ kind: 'link', url: 'https://etherscan.io/tx/0xabc' }],
      createdAt: Date.now() - 7200000,
      metrics: { likes: 25, reposts: 10, replies: 5, quotes: 1 },
    },
  ],
  meta: { fetchedFrom: 'nostr' },
});

vi.mock('@degenfeed/feed-providers', () => ({
  NostrProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  FarcasterProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  BlueskyProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  LensProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  MastodonProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  LemmyProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  RedditProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  RssProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  ThreadsProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  RmiDataBusProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
  PonderProvider: vi.fn(() => ({ fetchFeed: mockFetchFeed, healthCheck: vi.fn() })),
}));

describe('Feed pipeline: fetch → respond', () => {
  it('should return posts from the feed handler', async () => {
    const { handleHomeFeed } = await import('../routes/feed');
    const req = new Request('http://localhost/api/feed/home?protocols=nostr,farcaster&limit=10');
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = {} as any;
    const res = await handleHomeFeed(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: unknown[]; meta?: Record<string, unknown> };
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
    expect(body.meta?.limit).toBe(10);
  });

  it('should include protocol metadata in the response', async () => {
    const { handleHomeFeed } = await import('../routes/feed');
    const req = new Request('http://localhost/api/feed/home?protocols=nostr');
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = {} as any;
    const res = await handleHomeFeed(req, env);
    const body = (await res.json()) as { meta?: { perProtocol?: Record<string, unknown> } };
    expect(body.meta?.perProtocol).toBeDefined();
  });

  it('should handle multiple protocol feeds concurrently', async () => {
    const { handleHomeFeed } = await import('../routes/feed');
    const req = new Request(
      'http://localhost/api/feed/home?protocols=nostr,farcaster,lens,bluesky',
    );
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = {} as any;
    const res = await handleHomeFeed(req, env);
    expect(res.status).toBe(200);
  });
});
