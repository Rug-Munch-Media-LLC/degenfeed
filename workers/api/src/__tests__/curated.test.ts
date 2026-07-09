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

vi.mock('@degenfeed/rss-sdk', () => ({
  GenericRssSource: {
    fetch: vi.fn().mockResolvedValue({
      source: 'generic',
      url: 'https://example.com/feed',
      feed: {
        title: 'Mock Feed',
        link: 'https://example.com',
        items: [
          {
            title: 'Mock Post',
            contentSnippet: 'This is a mock newsletter post.',
            link: 'https://example.com/post',
            pubDate: new Date().toISOString(),
          },
        ],
      },
    }),
  },
  feedToUnifiedPosts: vi.fn().mockReturnValue([
    {
      id: 'rss:generic:mock',
      protocol: 'rss',
      author: {
        id: 'rss:generic:Mock Feed',
        primary: { protocol: 'rss', id: 'rss:generic:Mock Feed' },
        handles: {},
        displayName: 'Mock Feed',
      },
      text: 'This is a mock newsletter post.',
      html: '<p>This is a mock newsletter post.</p>',
      embeds: [],
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      niches: [],
    },
  ]),
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
