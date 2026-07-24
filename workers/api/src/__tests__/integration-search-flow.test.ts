/**
 * @degenfeed/api — Integration test: Full search flow
 *
 * Tests the end-to-end search pipeline: query → federate → respond.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/feed-core', () => ({
  detectNiches: vi.fn().mockReturnValue(['crypto']),
  isSpamPost: vi.fn().mockReturnValue(false),
}));

vi.mock('@degenfeed/feed-providers', () => ({
  RssProvider: vi.fn(),
}));

describe('Search flow: query → federate → respond', () => {
  it('should respond with results for a valid search query', async () => {
    const { handleSearch } = await import('../routes/search');
    const req = new Request('http://localhost/api/search?q=bitcoin&limit=10');
    const env = {
      SEARCH_CACHE_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
      RSS_CACHE_KV: { get: vi.fn().mockResolvedValue(null) },
      // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    } as any;
    const res = await handleSearch(req, env);
    expect(res.status).toBe(200);
  });

  it('should include meta with query information', async () => {
    const { handleSearch } = await import('../routes/search');
    const req = new Request('http://localhost/api/search?q=solana&limit=5');
    const env = {
      SEARCH_CACHE_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() },
      RSS_CACHE_KV: { get: vi.fn().mockResolvedValue(null) },
      // biome-ignore lint/suspicious/noExplicitAny: intentional mock/test cast
    } as any;
    const res = await handleSearch(req, env);
    const body = (await res.json()) as {
      meta?: { query?: string; limit?: number };
    };
    expect(body.meta?.query).toBe('solana');
    expect(body.meta?.limit).toBe(5);
  });
});
