import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import {
  applyFeedControls,
  DEFAULT_FEED_CONTROLS,
  type FeedControls,
  filterFeed,
  parseControlsFromParams,
  serializeControls,
  sortFeed,
  timeCutoffMs,
} from './feedRanking';

function makePost(overrides: Partial<UnifiedPost> & { id: string }): UnifiedPost {
  return {
    protocol: 'nostr',
    author: { id: 'a1', displayName: 'A', handle: 'a', bio: '', avatar: '' },
    text: 'test post',
    embeds: [],
    createdAt: Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: null,
    niches: [],
    ...overrides,
  } as unknown as UnifiedPost;
}

describe('feedRanking — filtering', () => {
  it('filters by protocol', () => {
    const posts = [
      makePost({ id: '1', protocol: 'nostr' }),
      makePost({ id: '2', protocol: 'farcaster' }),
    ];
    const controls: FeedControls = { ...DEFAULT_FEED_CONTROLS, protocols: ['nostr'] };
    const out = filterFeed(posts, controls);
    expect(out.map((p) => p.id)).toEqual(['1']);
  });

  it('filters by time range', () => {
    const now = Date.now();
    const old = makePost({ id: 'old', createdAt: now - 2 * 60 * 60 * 1000 });
    const fresh = makePost({ id: 'fresh', createdAt: now - 1000 });
    const controls: FeedControls = { ...DEFAULT_FEED_CONTROLS, timeRange: '1h' };
    const out = filterFeed([old, fresh], controls, now);
    expect(out.map((p) => p.id)).toEqual(['fresh']);
  });

  it('filters by content type (media)', () => {
    const media = makePost({
      id: 'm',
      contentType: 'video',
      embeds: [{ kind: 'video', url: 'https://x/y.mp4' }],
    });
    const text = makePost({ id: 't' });
    const controls: FeedControls = { ...DEFAULT_FEED_CONTROLS, contentTypes: ['media'] };
    const out = filterFeed([text, media], controls);
    expect(out.map((p) => p.id)).toEqual(['m']);
  });

  it('filters by niche', () => {
    const p1 = makePost({ id: '1', niches: ['defi'] });
    const p2 = makePost({ id: '2', niches: ['nft'] });
    const controls: FeedControls = { ...DEFAULT_FEED_CONTROLS, niches: ['nft'] };
    const out = filterFeed([p1, p2], controls);
    expect(out.map((p) => p.id)).toEqual(['2']);
  });
});

describe('feedRanking — sorting', () => {
  it('latest sorts newest first', () => {
    const now = Date.now();
    const a = makePost({ id: 'a', createdAt: now - 10_000 });
    const b = makePost({ id: 'b', createdAt: now - 1_000 });
    expect(sortFeed([a, b], 'latest', now).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('engaged sorts by log engagement', () => {
    const low = makePost({ id: 'low', metrics: { likes: 1, reposts: 0, replies: 0, quotes: 0 } });
    const high = makePost({
      id: 'high',
      metrics: { likes: 500, reposts: 100, replies: 50, quotes: 5 },
    });
    expect(sortFeed([low, high], 'engaged').map((p) => p.id)).toEqual(['high', 'low']);
  });

  it('zapped sorts by tipCount', () => {
    const z = makePost({ id: 'z', tipCount: 42 });
    const n = makePost({ id: 'n' });
    expect(sortFeed([n, z], 'zapped').map((p) => p.id)).toEqual(['z', 'n']);
  });

  it('quality prefers higher quality ratio', () => {
    const good = makePost({
      id: 'good',
      qualityScore: { score: 90, max: 100, ratio: 0.9, reasons: [] },
    });
    const bad = makePost({
      id: 'bad',
      qualityScore: { score: 20, max: 100, ratio: 0.2, reasons: [] },
    });
    expect(sortFeed([bad, good], 'quality').map((p) => p.id)).toEqual(['good', 'bad']);
  });
});

describe('feedRanking — algorithm blend', () => {
  it('keeps latest chronological even with weights', () => {
    const now = Date.now();
    const a = makePost({ id: 'a', createdAt: now - 1000 });
    const b = makePost({ id: 'b', createdAt: now - 50_000 });
    const controls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'latest',
      algorithm: {
        recencyQuality: 100,
        engagementDiversity: 100,
        protocolDiversity: 100,
        familiarDiscover: 50,
        creatorSize: 50,
      },
    };
    const out = applyFeedControls([a, b], controls, now);
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('protocol diversity interleaves mixed networks', () => {
    const now = Date.now();
    const posts = [
      makePost({ id: 'n1', protocol: 'nostr' }),
      makePost({ id: 'n2', protocol: 'nostr' }),
      makePost({ id: 'n3', protocol: 'nostr' }),
      makePost({ id: 'f1', protocol: 'farcaster' }),
      makePost({ id: 'f2', protocol: 'farcaster' }),
      makePost({ id: 'b1', protocol: 'bluesky' }),
    ];
    const controls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'engaged',
      algorithm: {
        recencyQuality: 50,
        engagementDiversity: 50,
        protocolDiversity: 100,
        familiarDiscover: 50,
        creatorSize: 50,
      },
    };
    const out = applyFeedControls(posts, controls, now);
    // No two consecutive posts from the same protocol.
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1];
      const cur = out[i];
      if (!prev || !cur) continue;
      expect(cur.protocol).not.toBe(prev.protocol);
    }
  });

  it('boosts posts with media over plain text at equal engagement', () => {
    const now = Date.now();
    const text = makePost({
      id: 'text',
      metrics: { likes: 100, reposts: 10, replies: 5, quotes: 0 },
    });
    const media = makePost({
      id: 'media',
      contentType: 'image',
      embeds: [{ kind: 'image', url: 'https://x/img.png' }],
      metrics: { likes: 100, reposts: 10, replies: 5, quotes: 0 },
    });
    const controls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'engaged',
      algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm },
    };
    const out = applyFeedControls([text, media], controls, now);
    expect(out[0]?.id).toBe('media');
  });

  it('downweights low-engagement posts from big accounts', () => {
    const now = Date.now();
    // 1M-follower account with near-zero engagement (signal-poor).
    const bigLowEng = makePost({
      id: 'big-low',
      metrics: { likes: 3, reposts: 0, replies: 0, quotes: 0 },
      author: { ...makePost({ id: 'x' }).author, followerCount: 1_000_000 },
    });
    // Small account with strong engagement.
    const smallHighEng = makePost({
      id: 'small-high',
      metrics: { likes: 300, reposts: 50, replies: 20, quotes: 0 },
      author: { ...makePost({ id: 'x' }).author, followerCount: 200 },
    });
    const controls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'engaged',
      algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm },
    };
    const out = applyFeedControls([bigLowEng, smallHighEng], controls, now);
    expect(out[0]?.id).toBe('small-high');
  });

  it('creatorSize slider prefers indie creators when low, big accounts when high', () => {
    const now = Date.now();
    const indie = makePost({
      id: 'indie',
      metrics: { likes: 50, reposts: 5, replies: 2, quotes: 0 },
      author: { ...makePost({ id: 'x' }).author, followerCount: 50 },
    });
    const big = makePost({
      id: 'big',
      metrics: { likes: 500, reposts: 50, replies: 20, quotes: 0 },
      author: { ...makePost({ id: 'x' }).author, followerCount: 500_000 },
    });
    const indieControls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'engaged',
      algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm, creatorSize: 0 },
    };
    const bigControls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'engaged',
      algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm, creatorSize: 100 },
    };
    const indieFirst = applyFeedControls([indie, big], indieControls, now);
    const bigFirst = applyFeedControls([indie, big], bigControls, now);
    // Low creatorSize → indie outranks big (follower penalty dominates).
    expect(indieFirst[0]?.id).toBe('indie');
    // High creatorSize → big account is boosted above indie.
    expect(bigFirst[0]?.id).toBe('big');
  });

  it('freshness slider changes engaged ranking (fresh beats engaged)', () => {
    const now = Date.now();
    // Older post with much higher engagement.
    const oldEngaged = makePost({
      id: 'old-engaged',
      createdAt: now - 20 * 60 * 60 * 1000, // 20h old
      metrics: { likes: 1000, reposts: 200, replies: 50, quotes: 0 },
      qualityScore: { score: 90, max: 100, ratio: 0.9, reasons: [] },
    });
    // Fresh post with modest engagement.
    const freshLight = makePost({
      id: 'fresh-light',
      createdAt: now - 10 * 60 * 1000, // 10m old
      metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    });
    const freshControls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'engaged',
      algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm, recencyQuality: 0 },
    };
    const qualityControls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'engaged',
      algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm, recencyQuality: 100 },
    };
    const freshFirst = applyFeedControls([oldEngaged, freshLight], freshControls, now);
    const engagedFirst = applyFeedControls([oldEngaged, freshLight], qualityControls, now);
    // rq=0 → pure freshness blend → fresh post first.
    expect(freshFirst[0]?.id).toBe('fresh-light');
    // rq=100 → quality/engagement dominates → old engaged post first.
    expect(engagedFirst[0]?.id).toBe('old-engaged');
  });

  it('familiarDiscover slider boosts verified creators when high', () => {
    const now = Date.now();
    const verified = makePost({
      id: 'verified',
      qualityBadge: 'verified',
      metrics: { likes: 5, reposts: 0, replies: 0, quotes: 0 },
    });
    const anonymous = makePost({
      id: 'anon',
      metrics: { likes: 8, reposts: 1, replies: 0, quotes: 0 },
    });
    const familiarControls: FeedControls = {
      ...DEFAULT_FEED_CONTROLS,
      sort: 'engaged',
      algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm, familiarDiscover: 100 },
    };
    const out = applyFeedControls([anonymous, verified], familiarControls, now);
    expect(out[0]?.id).toBe('verified');
  });
});

describe('feedRanking — URL serialization', () => {
  it('round-trips through params', () => {
    const controls: FeedControls = {
      sort: 'trending',
      protocols: ['nostr', 'farcaster'],
      contentTypes: ['media'],
      timeRange: '7d',
      niches: ['defi'],
      algorithm: {
        recencyQuality: 70,
        engagementDiversity: 40,
        protocolDiversity: 80,
        familiarDiscover: 30,
        creatorSize: 60,
      },
    };
    const params = serializeControls(controls);
    const parsed = parseControlsFromParams(new URLSearchParams(params));
    expect(parsed).toMatchObject({
      sort: 'trending',
      protocols: ['nostr', 'farcaster'],
      contentTypes: ['media'],
      timeRange: '7d',
      niches: ['defi'],
      algorithm: {
        recencyQuality: 70,
        engagementDiversity: 40,
        protocolDiversity: 80,
        familiarDiscover: 30,
        creatorSize: 60,
      },
    });
  });

  it('returns null when no feed params present', () => {
    expect(parseControlsFromParams(new URLSearchParams('?foo=bar'))).toBeNull();
  });

  it('timeCutoffMs maps ranges', () => {
    const now = 1_000_000;
    expect(timeCutoffMs('1h', now)).toBe(now - 3_600_000);
    expect(timeCutoffMs('all', now)).toBe(0);
  });
});
