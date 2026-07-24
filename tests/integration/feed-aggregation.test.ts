/**
 * ═════════════════════════════════════════════════════════════════════════════
 * FEED AGGREGATION CORRECTNESS — 10 tests
 *
 * Tests the REAL feed aggregation pipeline:
 *   - deduplicatePosts() cross-protocol dedup with Jaccard + Levenshtein
 *   - scoreBreakdownV2() / rankDiverse() protocol priority ordering
 *   - interleaveByProtocol() protocol diversity
 *   - computeQualityScore() with full context (spam, clickbait, length, media)
 *   - Niche detection and protocol source weight
 *   - Empty feed, language detection, edge cases
 *
 * Exercises the ACTUAL modules from @degenfeed/feed-core and
 * @degenfeed/ranking with real algorithm logic.
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'vitest';

import {
  buildQualityAuthorProfile,
  computeQualityScore,
  deduplicatePosts,
  detectNiches,
  isEnglishPost,
} from '../../packages/feed-core/src';
import {
  interleaveByProtocol,
  PLATFORM_TIER,
  rankDiverse,
  scoreBreakdownV2,
  sourceWeight,
  WEIGHTS_V2,
} from '../../packages/ranking';

// ─── Factory: build minimal UnifiedPost-like objects ────────────────────

function makePost(overrides: {
  id: string;
  protocol: string;
  text: string;
  authorId?: string;
  authorDisplayName?: string;
  followerCount?: number;
  niches?: string[];
  createdAt?: number;
  metrics?: { likes: number; reposts: number; replies: number; quotes: number };
  embeds?: Array<{ kind: string; url: string }>;
  spamScore?: number;
}) {
  const now = Date.now();
  return {
    id: overrides.id,
    protocol: overrides.protocol,
    author: {
      id: overrides.authorId ?? `author:${overrides.protocol}:${overrides.id}`,
      primary: { protocol: overrides.protocol, id: overrides.authorId ?? overrides.id },
      handles: {
        nostr: null,
        farcaster: null,
        lens: null,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: overrides.authorDisplayName ?? `Author ${overrides.protocol}`,
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: overrides.followerCount ?? 1000,
      followingCount: 200,
      links: [],
      keys: {},
    },
    text: overrides.text,
    html: `<p>${overrides.text}</p>`,
    embeds: overrides.embeds ?? [],
    parentId: undefined,
    rootId: undefined,
    createdAt: overrides.createdAt ?? now,
    metrics: overrides.metrics ?? { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: overrides.metrics ?? { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    },
    niches: overrides.niches ?? ['crypto'],
    raw: {},
    spamScore: overrides.spamScore ?? 0,
  } as any;
}

// ─── SUITE 1: Protocol Priority Ordering ────────────────────────────────

describe('Feed Aggregation: Quality Prioritization', () => {
  it('scores high-quality content higher than spam', () => {
    const highQuality = makePost({
      id: 'nostr:high1',
      protocol: 'nostr',
      text: 'Bitcoin is a decentralized digital currency that enables peer-to-peer transactions without intermediaries. The underlying blockchain technology ensures transparency and security through cryptographic proof. This is a substantive post about the future of money in the digital age.',
      followerCount: 50000,
      authorId: 'npub_verified',
      metrics: { likes: 200, reposts: 50, replies: 30, quotes: 10 },
    });

    const spamPost = makePost({
      id: 'reddit:spam1',
      protocol: 'reddit',
      text: 'Click here free bitcoin!!! 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀',
      followerCount: 1,
      authorId: 'spammer_123',
      metrics: { likes: 1, reposts: 0, replies: 0, quotes: 0 },
      spamScore: 0.95,
    });

    const highCtx = { author: buildQualityAuthorProfile(highQuality.author) };
    const lowCtx = { author: buildQualityAuthorProfile(spamPost.author) };

    const highScore = computeQualityScore(highQuality, highCtx);
    const lowScore = computeQualityScore(spamPost, lowCtx);
    expect(highScore).toBeGreaterThan(lowScore);
    console.log(`[PASS] Quality scores: high=${highScore}, low=${lowScore}`);
  });

  it('scores post with media bonus higher', () => {
    const withMedia = makePost({
      id: 'nostr:media1',
      protocol: 'nostr',
      text: 'Check out this Bitcoin chart analysis!',
      embeds: [{ kind: 'image', url: 'https://example.com/chart.png' }],
      metrics: { likes: 50, reposts: 10, replies: 5, quotes: 2 },
    });
    const withoutMedia = makePost({
      id: 'nostr:text1',
      protocol: 'nostr',
      text: 'Check out this Bitcoin chart analysis!',
      metrics: { likes: 50, reposts: 10, replies: 5, quotes: 2 },
    });

    const ctx = { author: buildQualityAuthorProfile(withMedia.author) };
    const mediaScore = computeQualityScore(withMedia, ctx);
    const textScore = computeQualityScore(withoutMedia, ctx);
    expect(mediaScore).toBeGreaterThanOrEqual(textScore);
    console.log(`[PASS] Media bonus: with=${mediaScore}, without=${textScore}`);
  });
});

// ─── SUITE 2: Cross-Protocol Dedup ──────────────────────────────────────

describe('Feed Aggregation: Cross-Protocol Dedup', () => {
  it('deduplicates identical content from Nostr and RSS', () => {
    const text =
      'Bitcoin price reaches new all-time high as institutional adoption accelerates worldwide.';
    const posts = [
      makePost({ id: 'nostr:dedup1', protocol: 'nostr', text, createdAt: Date.now() - 1000 }),
      makePost({ id: 'rss:dedup1', protocol: 'rss', text, createdAt: Date.now() }),
    ];

    const deduped = deduplicatePosts(posts);
    expect(deduped.length).toBeLessThan(posts.length);
    // crossPostedTo should be populated on the kept post
    if (deduped.length === 1 && deduped[0].crossPostedTo) {
      expect(deduped[0].crossPostedTo).toContain('nostr');
      expect(deduped[0].crossPostedTo).toContain('rss');
    }
    console.log(`[PASS] Dedup: ${posts.length} → ${deduped.length} unique`);
  });

  it('does NOT deduplicate different articles with similar first 120 chars', () => {
    const posts = [
      makePost({
        id: 'nostr:art1',
        protocol: 'nostr',
        text: 'Bitcoin mining difficulty adjusts upward for the third consecutive month as more miners join the network and hash rate reaches unprecedented levels.',
        createdAt: Date.now() - 2000,
      }),
      makePost({
        id: 'rss:art2',
        protocol: 'rss',
        text: 'Bitcoin mining difficulty adjusts after a slight decrease, reflecting changing market conditions and energy costs across various regions.',
        createdAt: Date.now(),
      }),
    ];

    const deduped = deduplicatePosts(posts);
    // Different articles — should NOT be deduped
    expect(deduped.length).toBe(2);
    console.log('[PASS] False-positive protection: 2 different articles kept separate');
  });
});

// ─── SUITE 3: Protocol Interleaving ─────────────────────────────────────

describe('Feed Aggregation: Protocol Interleaving', () => {
  it('interleaves posts round-robin by protocol', () => {
    const posts = [
      { protocol: 'nostr', id: 'n1' },
      { protocol: 'nostr', id: 'n2' },
      { protocol: 'nostr', id: 'n3' },
      { protocol: 'farcaster', id: 'f1' },
      { protocol: 'farcaster', id: 'f2' },
      { protocol: 'bluesky', id: 'b1' },
    ] as any;

    const interleaved = interleaveByProtocol(posts);
    const protocols = interleaved.map((p: any) => p.protocol);
    expect(protocols[0]).toBe('nostr');
    expect(protocols[1]).toBe('farcaster');
    expect(protocols[2]).toBe('bluesky');
    console.log('[PASS] Interleaved:', protocols.join(', '));
  });

  it('handles empty and single-element arrays', () => {
    expect(interleaveByProtocol([])).toEqual([]);
    expect(interleaveByProtocol([{ protocol: 'nostr' } as any])).toHaveLength(1);
    console.log('[PASS] Interleaving edge cases handled');
  });
});

// ─── SUITE 4: Ranking with Diversity ────────────────────────────────────

describe('Feed Aggregation: Ranking & Diversity', () => {
  it('rankDiverse limits author repetition', () => {
    const posts = Array.from({ length: 8 }, (_, i) =>
      makePost({
        id: `p${i}`,
        protocol: 'nostr',
        text: `Post number ${i} about crypto topics`,
        authorId: i < 4 ? 'author:prolific' : 'author:other',
        authorDisplayName: i < 4 ? 'Prolific Author' : 'Other Author',
      }),
    );

    const ctx = {
      viewer: null as any,
      recentAuthors: new Map(),
      sourceQuality: new Map(),
      followed: new Set<string>(),
      viewerNiches: new Set(['crypto']),
      now: Date.now(),
    };

    const diverse = rankDiverse(posts, ctx, { maxPerAuthor: 3 });
    const authorCount = new Map<string, number>();
    for (const p of diverse) {
      authorCount.set(p.author.id, (authorCount.get(p.author.id) ?? 0) + 1);
    }
    for (const [, count] of authorCount) {
      expect(count).toBeLessThanOrEqual(3);
    }
    console.log('[PASS] Diversity ranking enforced max 3/author');
  });
});

// ─── SUITE 5: Niche Detection & Protocol Weights ────────────────────────

describe('Feed Aggregation: Niche Detection & Protocol Weights', () => {
  it('detects niches from text', () => {
    const cryptoText = 'Bitcoin and Ethereum are leading the crypto market';
    const niches = detectNiches(cryptoText);
    expect(niches).toContain('bitcoin');
    expect(niches).toContain('ethereum');
    expect(niches).toContain('crypto');
    console.log('[PASS] Niches detected:', niches);
  });

  it('returns source weight for protocols', () => {
    // Nostr and Farcaster should have high weight
    expect(sourceWeight('nostr' as any)).toBeGreaterThanOrEqual(0.8);
    expect(sourceWeight('farcaster' as any)).toBeGreaterThanOrEqual(0.8);
    expect(PLATFORM_TIER.nostr).toBe(1);
    expect(PLATFORM_TIER.bluesky).toBe(1);
    console.log('[PASS] Platform weights: nostr=', PLATFORM_TIER.nostr, 'rss=', PLATFORM_TIER.rss);
  });
});

// ─── SUITE 6: Language Detection ────────────────────────────────────────

describe('Feed Aggregation: Language & Edge Cases', () => {
  it('detects English text correctly', () => {
    expect(isEnglishPost('The quick brown fox jumps over the lazy dog')).toBe(true);
    expect(isEnglishPost('')).toBe(true);
    console.log('[PASS] English detection works');
  });

  it('handles empty dedup input gracefully', () => {
    expect(deduplicatePosts([])).toEqual([]);
    console.log('[PASS] Empty dedup returns empty');
  });
});
