import { describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/nostr-sdk', () => ({
  RelayPool: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([]),
    publish: vi.fn().mockResolvedValue(1),
    disconnectAll: vi.fn(),
  })),
}));

vi.mock('@degenfeed/farcaster-sdk', () => ({
  HubClient: vi.fn().mockImplementation(() => ({
    getCastsByFids: vi.fn().mockResolvedValue([]),
    castToUnifiedPost: vi
      .fn()
      .mockReturnValue({ id: 'fc:test', protocol: 'farcaster', text: 'test' }),
    profileToIdentity: vi.fn().mockReturnValue({ id: 'farcaster:1' }),
    getUserNameProofByName: vi.fn().mockResolvedValue({ fid: 1, name: 'test' }),
  })),
  CURATED_FARCASTER_FIDS: [1, 2, 3],
}));

vi.mock('@degenfeed/lens-sdk', () => ({
  LensClient: vi.fn().mockImplementation(() => ({
    getPublicationsByHandles: vi.fn().mockResolvedValue([]),
    publicationToUnifiedPost: vi
      .fn()
      .mockReturnValue({ id: 'lens:test', protocol: 'lens', text: 'test' }),
    profileToIdentity: vi.fn().mockReturnValue({ id: 'lens:1' }),
  })),
  CURATED_LENS_HANDLES: ['aaveaave', 'stani'],
}));

vi.mock('@degenfeed/bluesky-sdk', () => ({
  BskyClient: vi.fn().mockImplementation(() => ({
    getActorFeeds: vi.fn().mockResolvedValue([]),
    searchActorsTypeahead: vi.fn().mockResolvedValue({ actors: [] }),
    postToUnifiedPost: vi
      .fn()
      .mockReturnValue({ id: 'bsky:test', protocol: 'bluesky', text: 'test' }),
    authorToIdentity: vi.fn().mockReturnValue({ id: 'bluesky:1' }),
  })),
  CURATED_BSKY_ACTORS: ['test.bsky.social'],
}));

vi.mock('@degenfeed/mastodon-sdk', () => ({
  GtSClient: vi.fn().mockImplementation(() => ({
    getPublicTimeline: vi.fn().mockResolvedValue([]),
  })),
  statusToUnifiedPost: vi
    .fn()
    .mockReturnValue({ id: 'mastodon:test', protocol: 'mastodon', text: 'test' }),
}));

vi.mock('@degenfeed/threads-sdk', () => ({
  ThreadsClient: vi.fn().mockImplementation(() => ({
    getAuthorFeeds: vi.fn().mockResolvedValue([]),
    postToUnifiedPost: vi
      .fn()
      .mockReturnValue({ id: 'threads:test', protocol: 'threads', text: 'test' }),
    authorToIdentity: vi.fn().mockReturnValue({ id: 'threads:1' }),
  })),
  CURATED_THREADS_HANDLES: ['threads', 'mosseri'],
}));

vi.mock('@degenfeed/rss-sdk', () => ({
  RedditSource: { fetch: vi.fn().mockResolvedValue({ source: 'reddit', feed: { items: [] } }) },
  feedToUnifiedPosts: vi.fn().mockReturnValue([]),
}));

import type { Env } from '../index';
import { handleHomeFeed, handleTrendingFeed } from '../routes/feed';

describe('handleHomeFeed', () => {
  const mockEnv: Env = {};

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

  it('should cap limit to 100', async () => {
    const req = new Request('http://localhost/api/feed/home?limit=500');
    const res = await handleHomeFeed(req, mockEnv);
    const body = (await res.json()) as { meta: { limit: number } };
    expect(body.meta.limit).toBe(100);
  });

  it('should include fetchedAt in meta', async () => {
    const req = new Request('http://localhost/api/feed/home');
    const res = await handleHomeFeed(req, mockEnv);
    const body = (await res.json()) as { meta: { fetchedAt: number } };
    expect(typeof body.meta.fetchedAt).toBe('number');
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
