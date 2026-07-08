import { describe, expect, it } from 'vitest';

describe('@degenfeed/ranking', () => {
  it('should export constants and functions', async () => {
    const mod = await import('./index');
    expect(mod.WEIGHTS).toBeDefined();
    expect(mod.WEIGHTS_V2).toBeDefined();
    expect(typeof mod.score).toBe('function');
    expect(typeof mod.scoreV2).toBe('function');
    expect(typeof mod.rank).toBe('function');
    expect(typeof mod.rankV2).toBe('function');
    expect(typeof mod.rankDiverse).toBe('function');
    expect(typeof mod.recencyDecay).toBe('function');
    expect(typeof mod.scoreBreakdownV2).toBe('function');
  });

  it('should have correct weight defaults', async () => {
    const { WEIGHTS, WEIGHTS_V2 } = await import('./index');
    expect(WEIGHTS.w1).toBe(1.0);
    expect(WEIGHTS.w2).toBe(1.5);
    expect(WEIGHTS.w6).toBe(3.0);
    expect(WEIGHTS_V2.recency).toBeGreaterThan(0);
  });

  it('should calculate recency decay', async () => {
    const { recencyDecay } = await import('./index');
    // At age = halfLife, decay should be 0.5
    const now = Date.now();
    const halfLifeHours = 12;
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
    expect(recencyDecay(twelveHoursAgo, now, halfLifeHours)).toBeCloseTo(0.5, 1);
  });

  it('should return empty array for empty rank input', async () => {
    const { rank } = await import('./index');
    const ctx = {
      viewer: null,
      recentAuthors: new Map(),
      sourceQuality: new Map(),
      viewerNiches: new Set<string>(),
      followed: new Set<string>(),
      now: Date.now(),
    };
    expect(rank([], ctx)).toEqual([]);
  });

  it('should provide v2 score breakdown with reasons', async () => {
    const { scoreBreakdownV2 } = await import('./index');
    const now = Date.now();
    const post = {
      id: 'nostr:test',
      protocol: 'nostr' as const,
      author: {
        id: 'nostr:abc',
        primary: { protocol: 'nostr' as const, id: 'abc' },
        handles: {
          nostr: null,
          farcaster: null,
          lens: null,
          bluesky: null,
          threads: null,
          rss: null,
          mastodon: null,
        },
        displayName: 'Alice',
        bio: 'Bitcoin and Ethereum maximalist',
        avatarUrl: '',
        verified: [],
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: 'Just bought more $BTC and $ETH. Crypto is going to moon.',
      embeds: [],
      createdAt: now,
      metrics: { likes: 50, reposts: 10, replies: 5, quotes: 1 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 50, reposts: 10, replies: 5, quotes: 1 },
      },
      raw: null,
      niches: ['bitcoin', 'ethereum'],
    };
    const ctx = {
      viewer: null,
      recentAuthors: new Map(),
      sourceQuality: new Map(),
      viewerNiches: new Set<string>(['bitcoin']),
      followed: new Set<string>(),
      now,
    };
    const bd = scoreBreakdownV2(post, ctx);
    expect(bd.total).toBeGreaterThan(0);
    expect(bd.recency).toBeCloseTo(1, 1);
    expect(bd.engagement).toBeGreaterThan(0);
    expect(bd.relevance).toBeGreaterThan(1);
    expect(Array.isArray(bd.reasons)).toBe(true);
  });

  it('should respect diversity cap in rankDiverse', async () => {
    const { rankDiverse } = await import('./index');
    const makePost = (id: string) => ({
      id,
      protocol: 'nostr' as const,
      author: {
        id: 'same-author',
        primary: { protocol: 'nostr' as const, id: 'x' },
        handles: {
          nostr: null,
          farcaster: null,
          lens: null,
          bluesky: null,
          threads: null,
          rss: null,
          mastodon: null,
        },
        displayName: 'Same',
        bio: '',
        avatarUrl: '',
        verified: [],
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: 'A post',
      embeds: [],
      createdAt: Date.now(),
      metrics: { likes: 1, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 1, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: null,
      niches: ['crypto'],
    });
    const posts = Array.from({ length: 10 }, (_, i) => makePost(`p-${i}`));
    const ctx = {
      viewer: null,
      recentAuthors: new Map(),
      sourceQuality: new Map(),
      viewerNiches: new Set<string>(),
      followed: new Set<string>(),
      now: Date.now(),
    };
    const ranked = rankDiverse(posts, ctx, { maxPerAuthor: 2 });
    expect(ranked.length).toBeLessThanOrEqual(2);
  });
});
