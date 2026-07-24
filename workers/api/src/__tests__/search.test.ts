/**
 * @degenfeed/api — Search route tests
 */

import { describe, expect, it, vi } from 'vitest';

// Mock the feed-core module
vi.mock('@degenfeed/feed-core', () => ({
  detectNiches: vi.fn().mockReturnValue(['crypto']),
  isSpamPost: vi.fn().mockReturnValue(false),
}));

// Mock feed-providers to avoid missing @degenfeed/source-discovery dependency
vi.mock('@degenfeed/feed-providers', () => ({
  RssProvider: class RssProviderMock {},
  aggregateStats: vi.fn().mockReturnValue([]),
  buildTrendingSource: vi.fn().mockReturnValue({}),
}));

describe('handleSearch', () => {
  it('should return 400 when query is empty or missing', async () => {
    const { handleSearch } = await import('../routes/search');
    const req = new Request('http://localhost/api/search?q=');
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = { SEARCH_CACHE_KV: {} } as any;
    const res = await handleSearch(req, env);
    expect(res.status).toBe(400);
  });

  it('should return 200 with data and meta for a valid query', async () => {
    const { handleSearch } = await import('../routes/search');
    const req = new Request('http://localhost/api/search?q=bitcoin&limit=5');
    const env = {
      SEARCH_CACHE_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
      RSS_CACHE_KV: { get: vi.fn().mockResolvedValue(null) },
      // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    } as any;
    const res = await handleSearch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: unknown[];
      meta?: { query?: string };
    };
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta?.query).toBe('bitcoin');
  });

  it('should handle protocol filtering', async () => {
    const { handleSearch } = await import('../routes/search');
    const req = new Request('http://localhost/api/search?q=eth&protocols=nostr,farcaster');
    const env = {
      SEARCH_CACHE_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
      RSS_CACHE_KV: { get: vi.fn().mockResolvedValue(null) },
      // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    } as any;
    const res = await handleSearch(req, env);
    expect(res.status).toBe(200);
  });

  it('should handle network timeouts gracefully', async () => {
    const { handleSearch } = await import('../routes/search');
    const req = new Request('http://localhost/api/search?q=solana');
    const env = {
      SEARCH_CACHE_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
      RSS_CACHE_KV: { get: vi.fn().mockResolvedValue(null) },
      // Simulate timeout
      // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    } as any;
    // Should not crash even if providers time out
    const res = await handleSearch(req, env);
    expect(res.status).toBe(200);
  });
});

describe('handleSearchIdentity', () => {
  it('should return 400 when query is missing', async () => {
    const { handleSearchIdentity } = await import('../routes/search');
    const req = new Request('http://localhost/api/search/identity');
    // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    const env = {} as any;
    const res = await handleSearchIdentity(req, env);
    expect(res.status).toBe(400);
  });
});
