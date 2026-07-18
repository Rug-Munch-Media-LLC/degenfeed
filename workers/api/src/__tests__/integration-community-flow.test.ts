/**
 * @degenfeed/api — Integration test: Community flow
 *
 * Tests browse → join → content flow for cross-protocol communities.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/feed-providers', () => ({
  NostrProvider: vi.fn(() => ({ fetchFeed: vi.fn().mockResolvedValue({ posts: [] }), healthCheck: vi.fn() })),
}));

describe('Community flow: browse → community feed', () => {
  it('should list available communities', async () => {
    const { handleCommunitiesList } = await import('../routes/community');
    const req = new Request('http://localhost/api/communities');
    const env = {
      COMMUNITY_KV: { list: vi.fn().mockResolvedValue({ keys: [] }) },
    } as any;
    const res = await handleCommunitiesList(req, env);
    expect(res.status).toBe(200);
  });

  it('should return community feed', async () => {
    const { handleCommunityFeed } = await import('../routes/community');
    const req = new Request('http://localhost/api/community/crypto/feed');
    const env = {
      COMMUNITY_KV: { get: vi.fn().mockResolvedValue(null) },
    } as any;
    const res = await handleCommunityFeed(req, env);
    expect(res.status).toBe(200);
  });
});
