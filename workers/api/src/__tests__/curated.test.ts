import { describe, expect, it, vi } from 'vitest';

vi.mock('@degenfeed/nostr-sdk', () => ({
  RelayPool: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([]),
    disconnectAll: vi.fn(),
  })),
}));

vi.mock('@degenfeed/farcaster-sdk', () => ({
  HubClient: vi.fn().mockImplementation(() => ({
    getCastsByFid: vi.fn().mockResolvedValue([]),
    castToUnifiedPost: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock('@degenfeed/bluesky-sdk', () => ({
  BskyClient: vi.fn().mockImplementation(() => ({
    getTimeline: vi.fn().mockResolvedValue({ posts: [] }),
    postToUnifiedPost: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock('@degenfeed/mastodon-sdk', () => ({
  GtSClient: vi.fn().mockImplementation(() => ({
    getPublicTimeline: vi.fn().mockResolvedValue([]),
  })),
}));

import type { Env } from '../index';
import { handleNewsletterFeed, handleTopFeed } from '../routes/curated';

describe('handleTopFeed', () => {
  it('should return top posts with heat scores', async () => {
    const req = new Request('http://localhost/api/feed/top?limit=10');
    const res = await handleTopFeed(req, {} as Env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { meta: Record<string, unknown> };
    expect(body.meta).toBeDefined();
    expect(body.meta.type).toBe('top');
  });
});

describe('handleNewsletterFeed', () => {
  it('should fetch from newsletter sources', async () => {
    const req = new Request('http://localhost/api/feed/newsletters?limit=5');
    const res = await handleNewsletterFeed(req, {} as Env);
    expect(res.status).toBe(200);
  });
});
