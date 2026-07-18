/**
 * @degenfeed/api — Feed route tests
 *
 * Tests the feed route handlers including handleHomeFeed,
 * handleProviderFeed, and handleFeedHealth.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock feed providers at module level
vi.mock('@degenfeed/feed-providers', () => ({
  NostrProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  FarcasterProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  BlueskyProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  LensProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  MastodonProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  LemmyProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  RedditProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  RssProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  ThreadsProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  RmiDataBusProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
  PonderProvider: vi.fn(() => ({ fetchFeed: vi.fn(), healthCheck: vi.fn() })),
}));

describe('handleHomeFeed', () => {
  it('should return 200 with data array and meta', async () => {
    const { handleHomeFeed } = await import('../routes/feed');
    const req = new Request('http://localhost/api/feed/home?limit=10');
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = {} as any;
    const res = await handleHomeFeed(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: unknown[]; meta?: Record<string, unknown> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
  });

  it('should parse protocol query parameter', async () => {
    const { handleHomeFeed } = await import('../routes/feed');
    const req = new Request('http://localhost/api/feed/home?protocols=nostr,farcaster');
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = {} as any;
    const res = await handleHomeFeed(req, env);
    expect(res.status).toBe(200);
  });

  it('should handle missing query parameters gracefully', async () => {
    const { handleHomeFeed } = await import('../routes/feed');
    const req = new Request('http://localhost/api/feed/home');
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = {} as any;
    const res = await handleHomeFeed(req, env);
    expect(res.status).toBe(200);
  });
});

describe('handleFeedHealth', () => {
  it('should return 200 with health status', async () => {
    const { handleFeedHealth } = await import('../routes/feed-misc');
    const req = new Request('http://localhost/api/feed/health');
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = {} as any;
    const res = await handleFeedHealth(req, env);
    expect(res.status).toBe(200);
  });
});
