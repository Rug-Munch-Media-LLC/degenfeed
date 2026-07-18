/**
 * Tests for feed-curation-rules — additive diversity scoring and round-robin interleaving.
 *
 * Verifies that:
 * 1. addDiversityBonus adds correct bonuses per protocol/category/content type
 * 2. interleaveProtocolsRoundRobin alternates protocols without destroying score ordering
 * 3. applyCurationPipeline with additive scoring produces diverse yet well-ranked output
 * 4. No two consecutive posts share the same protocol after round-robin
 */

import { describe, expect, it } from 'vitest';
import type { UnifiedPost } from '@degenfeed/types';
import {
  addDiversityBonus,
  applyCurationPipeline,
  interleaveProtocolsRoundRobin,
} from '../feed/feed-curation-rules';

function makePost(
  overrides: Partial<UnifiedPost> & { id: string; protocol: string },
): UnifiedPost {
  return {
    author: {
      id: 'author:1',
      primary: { protocol: overrides.protocol, id: '1' },
      handles: { nostr: null, farcaster: null, lens: null, bluesky: null, threads: null, rss: null, mastodon: null },
      displayName: 'Test',
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: 'Test post content for the feed curation pipeline.',
    embeds: [],
    createdAt: Date.now() - 3600000,
    metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 10, reposts: 2, replies: 1, quotes: 0 } },
    raw: null,
    niches: [],
    score: { total: 50, recency: 0.5, engagement: 1, relevance: 0.5, quality: 0.5, reputation: 0.5, diversity: 0, source: 0.5, velocity: 1, spam: 0, qualityScore: 50, reasons: [] },
    ...overrides,
  } as UnifiedPost;
}

describe('addDiversityBonus', () => {
  it('adds protocol diversity bonus based on unique protocol count', () => {
    const posts = [
      makePost({ id: 'a', protocol: 'nostr' }),
      makePost({ id: 'b', protocol: 'farcaster' }),
      makePost({ id: 'c', protocol: 'lens' }),
    ];

    const scored = new Map(posts.map((p) => [p.id, { total: 50, freshness: 1.0 }]));
    const results = addDiversityBonus(posts, scored, {
      interleaveProtocols: true,
      categoryRotation: false,
      contentTypeVariety: false,
    });

    // 3 unique protocols → +0.5 * min(3,5) = +1.5 bonus
    for (const [, entry] of results) {
      expect(entry.protocolBonus).toBe(1.5);
      expect(entry.finalScore).toBe(50 + 1.5); // base + protocol bonus
    }
  });

  it('adds category diversity bonus', () => {
    const posts = [
      makePost({ id: 'a', protocol: 'nostr', niches: ['defi'] }),
      makePost({ id: 'b', protocol: 'farcaster', niches: ['nft'] }),
      makePost({ id: 'c', protocol: 'lens', niches: ['trading'] }),
    ];

    const scored = new Map(posts.map((p) => [p.id, { total: 50, freshness: 1.0 }]));
    const results = addDiversityBonus(posts, scored, {
      interleaveProtocols: false,
      categoryRotation: true,
      contentTypeVariety: false,
    });

    // 3 unique categories → +0.3 * min(3,8) = +0.9
    for (const [, entry] of results) {
      expect(entry.categoryBonus).toBeCloseTo(0.9, 5);
    }
  });

  it('adds content type diversity bonus', () => {
    const posts = [
      makePost({ id: 'a', protocol: 'nostr', contentType: 'text' }),
      makePost({ id: 'b', protocol: 'farcaster', contentType: 'image', embeds: [{ kind: 'image', url: 'https://example.com/img.png' }] }),
      makePost({ id: 'c', protocol: 'lens', contentType: 'video', embeds: [{ kind: 'video', url: 'https://example.com/vid.mp4' }] }),
    ];

    const scored = new Map(posts.map((p) => [p.id, { total: 50, freshness: 1.0 }]));
    const results = addDiversityBonus(posts, scored, {
      interleaveProtocols: false,
      categoryRotation: false,
      contentTypeVariety: true,
    });

    // 3 unique content types → +0.2 * min(3,5) = +0.6
    for (const [, entry] of results) {
      expect(entry.contentTypeBonus).toBeCloseTo(0.6, 5);
    }
  });

  it('combines all diversity bonuses', () => {
    const posts = [
      makePost({ id: 'a', protocol: 'nostr', niches: ['defi'], contentType: 'text' }),
      makePost({ id: 'b', protocol: 'farcaster', niches: ['nft'], contentType: 'image', embeds: [{ kind: 'image', url: 'https://example.com/img.png' }] }),
      makePost({ id: 'c', protocol: 'lens', niches: ['trading'], contentType: 'video', embeds: [{ kind: 'video', url: 'https://example.com/vid.mp4' }] }),
    ];

    const scored = new Map(posts.map((p) => [p.id, { total: 50, freshness: 1.0 }]));
    addDiversityBonus(posts, scored, {
      interleaveProtocols: true,
      categoryRotation: true,
      contentTypeVariety: true,
    });

    // 3 unique protocols (+1.5) + 3 categories (+0.9) + 3 types (+0.6) = +3.0
    for (const [, entry] of scored) {
      expect(entry.total).toBe(53); // 50 + 3.0
    }
  });
});

describe('interleaveProtocolsRoundRobin', () => {
  it('alternates protocols in round-robin fashion', () => {
    const posts = [
      makePost({ id: 'a', protocol: 'nostr', score: { ...makePost({ id: 'a', protocol: 'nostr' }).score!, total: 100 } }),
      makePost({ id: 'b', protocol: 'farcaster', score: { ...makePost({ id: 'b', protocol: 'farcaster' }).score!, total: 90 } }),
      makePost({ id: 'c', protocol: 'lens', score: { ...makePost({ id: 'c', protocol: 'lens' }).score!, total: 80 } }),
      makePost({ id: 'd', protocol: 'nostr', score: { ...makePost({ id: 'd', protocol: 'nostr' }).score!, total: 70 } }),
      makePost({ id: 'e', protocol: 'farcaster', score: { ...makePost({ id: 'e', protocol: 'farcaster' }).score!, total: 60 } }),
    ];

    const scored = new Map(posts.map((p) => [p.id, { total: p.score?.total ?? 50, freshness: 1.0 }]));
    const result = interleaveProtocolsRoundRobin(posts, scored);

    expect(result.length).toBe(5);

    // No two consecutive posts from the same protocol
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.protocol).not.toBe(result[i - 1]!.protocol);
    }

    // Highest-scored posts from each protocol come first
    // nostr: a(id=a,100) then d(id=d,70)
    // farcaster: b(id=b,90) then e(id=e,60)
    // lens: c(id=c,80)
    expect(result[0]!.id).toBe('a'); // highest nostr
    expect(result[1]!.id).toBe('b'); // highest farcaster
    expect(result[2]!.id).toBe('c'); // highest lens
    expect(result[3]!.id).toBe('d'); // second nostr
    expect(result[4]!.id).toBe('e'); // second farcaster
  });

  it('handles uneven protocol counts', () => {
    const posts = [
      makePost({ id: 'a', protocol: 'nostr', score: { ...makePost({ id: 'a', protocol: 'nostr' }).score!, total: 100 } }),
      makePost({ id: 'b', protocol: 'nostr', score: { ...makePost({ id: 'b', protocol: 'nostr' }).score!, total: 90 } }),
      makePost({ id: 'c', protocol: 'nostr', score: { ...makePost({ id: 'c', protocol: 'nostr' }).score!, total: 80 } }),
      makePost({ id: 'd', protocol: 'farcaster', score: { ...makePost({ id: 'd', protocol: 'farcaster' }).score!, total: 70 } }),
    ];

    const scored = new Map(posts.map((p) => [p.id, { total: p.score?.total ?? 50, freshness: 1.0 }]));
    const result = interleaveProtocolsRoundRobin(posts, scored);

    // Should interleave: nostr, farcaster, nostr, nostr
    expect(result.length).toBe(4);
    expect(result[0]!.protocol).toBe('nostr');
    expect(result[1]!.protocol).toBe('farcaster');
    expect(result[2]!.protocol).toBe('nostr');
    expect(result[3]!.protocol).toBe('nostr');
  });

  it('preserves score ordering within each protocol', () => {
    const posts = [
      makePost({ id: 'a', protocol: 'farcaster', score: { ...makePost({ id: 'a', protocol: 'farcaster' }).score!, total: 30 } }),
      makePost({ id: 'b', protocol: 'farcaster', score: { ...makePost({ id: 'b', protocol: 'farcaster' }).score!, total: 60 } }),
      makePost({ id: 'c', protocol: 'farcaster', score: { ...makePost({ id: 'c', protocol: 'farcaster' }).score!, total: 90 } }),
      makePost({ id: 'd', protocol: 'nostr', score: { ...makePost({ id: 'd', protocol: 'nostr' }).score!, total: 100 } }),
    ];

    const scored = new Map(posts.map((p) => [p.id, { total: p.score?.total ?? 50, freshness: 1.0 }]));
    const result = interleaveProtocolsRoundRobin(posts, scored);

    // Farcaster posts should appear in score order: c(90), b(60), a(30)
    const farcasterPosts = result.filter((p) => p.protocol === 'farcaster');
    expect(farcasterPosts[0]!.id).toBe('c');
    expect(farcasterPosts[1]!.id).toBe('b');
    expect(farcasterPosts[2]!.id).toBe('a');
  });

  it('returns input as-is for 1-2 posts', () => {
    const one = [makePost({ id: 'a', protocol: 'nostr' })];
    expect(interleaveProtocolsRoundRobin(one, new Map())).toBe(one);

    const two = [
      makePost({ id: 'a', protocol: 'nostr' }),
      makePost({ id: 'b', protocol: 'farcaster' }),
    ];
    expect(interleaveProtocolsRoundRobin(two, new Map())).toBe(two);
  });
});

describe('applyCurationPipeline (additive scoring)', () => {
  it('produces well-diversified output with single sort', () => {
    const posts = [
      // 5 nostr posts, 5 farcaster posts, 5 lens posts
      ...Array.from({ length: 5 }, (_, i) =>
        makePost({
          id: `nostr:${i}`,
          protocol: 'nostr',
          niches: ['defi'],
          contentType: 'text',
          score: { total: 100 - i * 5, recency: 0.5, engagement: 1, relevance: 0.5, quality: 0.5, reputation: 0.5, diversity: 0, source: 0.5, velocity: 1, spam: 0, qualityScore: 50, reasons: [] },
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePost({
          id: `fc:${i}`,
          protocol: 'farcaster',
          niches: ['nft'],
          contentType: 'image',
          embeds: [{ kind: 'image', url: 'https://example.com/img.png' }],
          score: { total: 95 - i * 5, recency: 0.5, engagement: 1, relevance: 0.5, quality: 0.5, reputation: 0.5, diversity: 0, source: 0.5, velocity: 1, spam: 0, qualityScore: 50, reasons: [] },
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePost({
          id: `lens:${i}`,
          protocol: 'lens',
          niches: ['trading'],
          contentType: 'link',
          embeds: [{ kind: 'link', url: 'https://example.com' }],
          score: { total: 90 - i * 5, recency: 0.5, engagement: 1, relevance: 0.5, quality: 0.5, reputation: 0.5, diversity: 0, source: 0.5, velocity: 1, spam: 0, qualityScore: 50, reasons: [] },
        }),
      ),
    ];

    const result = applyCurationPipeline(posts, {
      freshnessBoost: false, // disable freshness to isolate diversity bonus test
      interleaveProtocols: true,
      categoryRotation: true,
      contentTypeVariety: true,
    });

    // All 15 posts returned
    expect(result.length).toBe(15);

    // No two consecutive same protocol
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.protocol).not.toBe(result[i - 1]!.protocol);
    }

    // The highest-scored overall post should appear first
    expect(result[0]!.id).toBe('nostr:0');
  });

  it('returns single post unchanged', () => {
    const posts = [makePost({ id: 'a', protocol: 'nostr' })];
    const result = applyCurationPipeline(posts);
    expect(result).toEqual(posts);
  });

  it('returns 2 posts with interleaving', () => {
    const posts = [
      makePost({ id: 'a', protocol: 'nostr' }),
      makePost({ id: 'b', protocol: 'farcaster' }),
    ];
    const result = applyCurationPipeline(posts, { interleaveProtocols: true });
    expect(result.length).toBe(2);
    expect(result[0]!.protocol).toBe('nostr');
    expect(result[1]!.protocol).toBe('farcaster');
  });
});
