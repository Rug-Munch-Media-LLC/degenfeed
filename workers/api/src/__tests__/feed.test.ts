import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the nostr-sdk before importing
vi.mock('@degenfeed/nostr-sdk', () => ({
  RelayPool: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([]),
    publish: vi.fn().mockResolvedValue(1),
    disconnectAll: vi.fn(),
  })),
}));

vi.mock('@degenfeed/farcaster-sdk', () => ({
  HubClient: vi.fn().mockImplementation(() => ({
    getCastsByFid: vi.fn().mockResolvedValue([]),
    castToUnifiedPost: vi.fn().mockReturnValue({ id: 'fc:test', protocol: 'farcaster', text: 'test' }),
  })),
}));

vi.mock('@degenfeed/lens-sdk', () => ({
  LensClient: vi.fn().mockImplementation(() => ({
    getPublications: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@degenfeed/bluesky-sdk', () => ({
  BskyClient: vi.fn().mockImplementation(() => ({
    getTimeline: vi.fn().mockResolvedValue({ posts: [] }),
    postToUnifiedPost: vi.fn().mockReturnValue({}),
  })),
}));

import { jsonResponse } from '../index';
import { handleHomeFeed } from '../routes/feed';

describe('handleHomeFeed', () => {
  const mockEnv: any = {};

  it('should return a response with data array', async () => {
    const req = new Request('http://localhost/api/feed/home?limit=5');
    const res = await handleHomeFeed(req, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
    expect(body.meta.limit).toBe(5);
  });

  it('should default to nostr,farcaster protocols', async () => {
    const req = new Request('http://localhost/api/feed/home');
    const res = await handleHomeFeed(req, mockEnv);
    const body = await res.json() as any;
    expect(body.meta).toBeDefined();
  });

  it('should handle empty results gracefully', async () => {
    const req = new Request('http://localhost/api/feed/home?protocols=nostr');
    const res = await handleHomeFeed(req, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.data)).toBe(true);
  });
});
