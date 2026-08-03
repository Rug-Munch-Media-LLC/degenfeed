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
      algorithm: { recencyQuality: 100, engagementDiversity: 100, protocolDiversity: 100 },
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
      algorithm: { recencyQuality: 50, engagementDiversity: 50, protocolDiversity: 100 },
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
});

describe('feedRanking — URL serialization', () => {
  it('round-trips through params', () => {
    const controls: FeedControls = {
      sort: 'trending',
      protocols: ['nostr', 'farcaster'],
      contentTypes: ['media'],
      timeRange: '7d',
      niches: ['defi'],
      algorithm: { recencyQuality: 70, engagementDiversity: 40, protocolDiversity: 80 },
    };
    const params = serializeControls(controls);
    const parsed = parseControlsFromParams(new URLSearchParams(params));
    expect(parsed).toMatchObject({
      sort: 'trending',
      protocols: ['nostr', 'farcaster'],
      contentTypes: ['media'],
      timeRange: '7d',
      niches: ['defi'],
      algorithm: { recencyQuality: 70, engagementDiversity: 40, protocolDiversity: 80 },
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
