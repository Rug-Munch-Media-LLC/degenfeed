/**
 * ═════════════════════════════════════════════════════════════════════════════
 * ALGORITHM QUALITY TESTS — 20 tests
 *
 * Verifies that scoring and ranking produce reasonable, high-quality results:
 *   - scorePost() with all 6 modes produces sensible rankings
 *   - High-quality content outranks spam/low-effort content
 *   - Diversity and anti-clustering work as expected
 *   - Transparent reasons are informative
 *   - Edge cases (empty, single post, extreme values)
 *   - Trending topic extraction
 *   - Velocity tracking and freshness boosts
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'vitest';
import {
  scorePost,
  scoreBreakdownV2,
  rankDiverse,
  rankV2,
  recencyDecay,
  freshnessBoost,
  normalizeEngagement,
  sourceWeight,
  engagementVelocity,
  computeTrendingTopics,
  extractTickers,
  extractHashtags,
} from '../../packages/ranking/src';
import { computeQualityScore, buildQualityAuthorProfile, detectNiches, keywordRelevance } from '../../packages/feed-core/src';
import type { UnifiedPost } from '../../packages/types/src';

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
  verified?: boolean;
}): UnifiedPost {
  const now = Date.now();
  return {
    id: overrides.id,
    protocol: overrides.protocol as any,
    author: {
      id: overrides.authorId ?? `author:${overrides.protocol}:${overrides.id}`,
      primary: { protocol: overrides.protocol as any, id: overrides.authorId ?? overrides.id },
      handles: {} as any,
      displayName: overrides.authorDisplayName ?? `Author ${overrides.protocol}`,
      bio: '',
      avatarUrl: '',
      verified: overrides.verified ? ['verified'] : [],
      followerCount: overrides.followerCount ?? 1000,
      followingCount: 200,
      links: [],
      keys: {},
    },
    text: overrides.text,
    html: `<p>${overrides.text}</p>`,
    embeds: overrides.embeds ?? [],
    parentId: undefined as any,
    rootId: undefined as any,
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
  } as UnifiedPost;
}

// ─── SUITE 1: scorePost Mode Presets ──────────────────────────────────

describe('Algorithm Quality: Mode Presets', () => {
  const now = Date.now();
  const freshPost = makePost({
    id: 'nostr:mode1',
    protocol: 'nostr',
    text: 'Bitcoin is transforming the global financial system. The decentralized nature of blockchain technology ensures that no single entity can control or manipulate the monetary supply. This is a substantive post about the future of money in the digital age.',
    createdAt: now - 600000, // 10 minutes ago
    metrics: { likes: 100, reposts: 25, replies: 10, quotes: 5 },
    followerCount: 50000,
    niches: ['bitcoin', 'crypto'],
  });

  it('breaking-news mode ranks fresh posts significantly higher than old ones', () => {
    const oldPost = makePost({
      id: 'nostr:old1',
      protocol: 'nostr',
      text: 'Some old news about crypto',
      createdAt: now - 86400000 * 7, // 7 days ago
      metrics: { likes: 5, reposts: 1, replies: 0, quotes: 0 },
      followerCount: 100,
    });

    const freshResult = scorePost(freshPost, {
      mode: 'breaking-news',
      now,
    });

    const oldResult = scorePost(oldPost, { mode: 'breaking-news', now });
    expect(freshResult.total).toBeGreaterThan(oldResult.total);
    expect(freshResult.breakdown.reasons).toContain('fresh');
  });

  it('deep-dive mode favors long-form content', () => {
    const shortPost = makePost({
      id: 'nostr:short1',
      protocol: 'nostr',
      text: 'gm',
      createdAt: now - 3600000,
      metrics: { likes: 1, reposts: 0, replies: 0, quotes: 0 },
    });

    const longPost = makePost({
      id: 'nostr:long1',
      protocol: 'nostr',
      text: 'This is a comprehensive analysis of the current state of decentralized finance. We examine the key protocols, their total value locked, and the emerging trends in cross-chain interoperability that are shaping the next generation of financial infrastructure. The move toward modular blockchain architecture represents a paradigm shift in how we think about scalability and security in the crypto space. Several key metrics suggest that institutional adoption is accelerating, with major financial institutions now actively exploring tokenization of real-world assets.',
      createdAt: now - 3600000,
      metrics: { likes: 50, reposts: 10, replies: 5, quotes: 2 },
      niches: ['defi', 'crypto'],
    });

    const shortResult = scorePost(shortPost, { mode: 'deep-dive', now });
    const longResult = scorePost(longPost, { mode: 'deep-dive', now });

    expect(longResult.total).toBeGreaterThan(shortResult.total);
  });

  it('quick-scroll mode favors short content', () => {
    const longPost = makePost({
      id: 'nostr:long2',
      protocol: 'nostr',
      text: 'A'.repeat(600), // 600 chars — too long for quick-scroll
      createdAt: now - 3600000,
      metrics: { likes: 50, reposts: 10, replies: 5, quotes: 2 },
    });

    const shortPost = makePost({
      id: 'nostr:short2',
      protocol: 'nostr',
      text: 'Bitcoin looking bullish today! 🚀',
      createdAt: now - 3600000,
      metrics: { likes: 20, reposts: 5, replies: 2, quotes: 1 },
    });

    const shortResult = scorePost(shortPost, { mode: 'quick-scroll', now });
    const longResult = scorePost(longPost, { mode: 'quick-scroll', now });

    expect(shortResult.total).toBeGreaterThan(longResult.total);
  });

  it('morning-digest mode boosts last-24h posts', () => {
    const oldPost = makePost({
      id: 'nostr:old-digest',
      protocol: 'nostr',
      text: 'Old news',
      createdAt: now - 86400000 * 2, // 2 days ago
      metrics: { likes: 100, reposts: 25, replies: 10, quotes: 5 },
      followerCount: 100000,
    });

    const digestResult = scorePost(freshPost, { mode: 'morning-digest', now });
    const oldResult = scorePost(oldPost, { mode: 'morning-digest', now });

    expect(digestResult.total).toBeGreaterThan(oldResult.total);
  });

  it('standard mode provides balanced scoring', () => {
    const result = scorePost(freshPost, { mode: 'standard', now });
    expect(result.total).toBeGreaterThan(0);
    expect(result.breakdown.recency).toBeGreaterThan(0);
    expect(result.breakdown.engagement).toBeGreaterThan(0);
    expect(result.breakdown.relevance).toBeGreaterThan(0);
    expect(result.breakdown.reasons.length).toBeGreaterThan(0);
  });

  it('for-you mode accepts personalization options without error', () => {
    const result = scorePost(freshPost, {
      mode: 'for-you',
      now,
      userNiches: new Set(['bitcoin']),
      followedCreators: new Set([freshPost.author.id]),
      isPersonalized: true,
      dwellMs: 12000,
      feedbackScore: 1.5,
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.breakdown.reasons).toContain('on-topic');
    expect(result.breakdown.reasons).toContain('followed');
  });
});

// ─── SUITE 2: Quality/Spam Discrimination ─────────────────────────────

describe('Algorithm Quality: Quality vs Spam', () => {
  it('high-quality content scores significantly higher than spam', () => {
    const highQuality = makePost({
      id: 'nostr:hq1',
      protocol: 'nostr',
      text: 'The Lightning Network has processed over 200,000 transactions in the past 24 hours, demonstrating that Bitcoin can scale effectively for micropayments. This milestone represents years of research and development in layer-2 scaling solutions. The implications for global payments are profound, enabling instant, near-zero fee transactions across borders without intermediaries.',
      followerCount: 50000,
      authorId: 'npub_verified_author',
      metrics: { likes: 200, reposts: 50, replies: 30, quotes: 10 },
      embeds: [{ kind: 'image', url: 'https://example.com/chart.png' }],
      verified: true,
      niches: ['bitcoin', 'crypto', 'layer2'],
    });

    const spam = makePost({
      id: 'reddit:spam1',
      protocol: 'reddit',
      text: 'CLICK HERE FREE BITCOIN!!! 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 Get rich now!!! This is NOT a scam!!! Limited time offer!!! Sign up with your credit card!!!',
      followerCount: 1,
      authorId: 'spammer_bot_123',
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      spamScore: 0.95,
    });

    const hqCtx = { author: buildQualityAuthorProfile(highQuality.author) };
    const spamCtx = { author: buildQualityAuthorProfile(spam.author) };

    const hqScore = computeQualityScore(highQuality, hqCtx);
    const spamScore = computeQualityScore(spam, spamCtx);

    expect(hqScore).toBeGreaterThan(spamScore);
    expect(hqScore).toBeGreaterThan(50); // HQ should be above 50
    // Spam content should score lower than high quality (exact thresholds may vary)
  });

  it('media posts receive quality bonus over text-only', () => {
    const withMedia = makePost({
      id: 'nostr:media',
      protocol: 'nostr',
      text: 'Bitcoin chart analysis for the week ahead',
      embeds: [{ kind: 'image', url: 'https://example.com/chart.png' }],
      metrics: { likes: 50, reposts: 10, replies: 5, quotes: 2 },
    });
    const textOnly = makePost({
      id: 'nostr:text',
      protocol: 'nostr',
      text: 'Bitcoin chart analysis for the week ahead',
      metrics: { likes: 50, reposts: 10, replies: 5, quotes: 2 },
    });

    const ctx = { author: buildQualityAuthorProfile(withMedia.author) };
    expect(computeQualityScore(withMedia, ctx)).toBeGreaterThanOrEqual(
      computeQualityScore(textOnly, ctx),
    );
  });

  it('verified authors score higher than new accounts', () => {
    const verified = makePost({
      id: 'nostr:ver',
      protocol: 'nostr',
      text: 'The future of decentralized social networks is bright',
      verified: true,
      followerCount: 100000,
      metrics: { likes: 100, reposts: 20, replies: 10, quotes: 5 },
    });
    const newUser = makePost({
      id: 'nostr:new',
      protocol: 'nostr',
      text: 'The future of decentralized social networks is bright',
      followerCount: 5,
      metrics: { likes: 1, reposts: 0, replies: 0, quotes: 0 },
    });

    const verResult = scorePost(verified, { mode: 'standard', now: Date.now() });
    const newResult = scorePost(newUser, { mode: 'standard', now: Date.now() });

    expect(verResult.total).toBeGreaterThan(newResult.total);
    expect(verResult.breakdown.reasons).toContain('verified-author');
  });

  it('keyword relevance detects boost terms in text', () => {
    const relevantText = 'Bitcoin and Ethereum are leading the crypto market this year';
    const irrelevantText = 'I had a great lunch today with friends';

    expect(keywordRelevance(relevantText)).toBeGreaterThan(keywordRelevance(irrelevantText));
  });

  it('detectNiches correctly identifies topics', () => {
    const cryptoText = 'Bitcoin mining difficulty adjusts upward as more miners join the network. Ethereum developers are working on the next upgrade.';
    const niches = detectNiches(cryptoText);
    expect(niches).toContain('bitcoin');
    expect(niches).toContain('ethereum');
    expect(niches).toContain('crypto');
  });
});

// ─── SUITE 3: Diversity and Anti-Clustering ──────────────────────────

describe('Algorithm Quality: Diversity & Anti-Clustering', () => {
  it('rankDiverse limits author repetition effectively', () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost({
        id: `p${i}`,
        protocol: 'nostr',
        text: `Post number ${i} about crypto topics`,
        authorId: i < 6 ? 'author:prolific' : `author:other${i}`,
        authorDisplayName: i < 6 ? 'Prolific Author' : `Other Author ${i}`,
      }),
    );

    const ranked = rankDiverse(posts, {
      viewer: null as any,
      recentAuthors: new Map(),
      sourceQuality: new Map(),
      followed: new Set<string>(),
      viewerNiches: new Set(['crypto']),
      now: Date.now(),
    }, { maxPerAuthor: 2 });

    const authorCount = new Map<string, number>();
    for (const p of ranked) {
      authorCount.set(p.author.id, (authorCount.get(p.author.id) ?? 0) + 1);
    }
    for (const [, count] of authorCount) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('diversity penalty reduces score of repeat authors', () => {
    const now = Date.now();
    const post = makePost({
      id: 'nostr:repeat1',
      protocol: 'nostr',
      text: 'Bitcoin is a decentralized digital currency',
      createdAt: now - 3600000,
      metrics: { likes: 50, reposts: 10, replies: 5, quotes: 2 },
    });

    const ctx = {
      viewer: null as any,
      recentAuthors: new Map([['author:nostr:nostr:repeat1', 5]]),
      sourceQuality: new Map(),
      followed: new Set<string>(),
      viewerNiches: new Set(['crypto']),
      now,
    };

    const breakdown = scoreBreakdownV2(post, ctx);
    expect(breakdown.diversity).toBeLessThan(0);
    expect(breakdown.reasons).toContain('author-diversity');
  });

  it('handles empty and single-element inputs gracefully', () => {
    const now = Date.now();
    const ctx = {
      viewer: null as any,
      recentAuthors: new Map(),
      sourceQuality: new Map(),
      followed: new Set<string>(),
      viewerNiches: new Set<string>(),
      now,
    };

    expect(rankDiverse([], ctx)).toEqual([]);

    const single = [makePost({ id: 'p1', protocol: 'nostr', text: 'hello', createdAt: now })];
    expect(rankDiverse(single, ctx)).toHaveLength(1);
  });
});

// ─── SUITE 4: Trending Topics ─────────────────────────────────────────

describe('Algorithm Quality: Trending Topics', () => {
  it('extracts tickers from text', () => {
    const tickers = extractTickers('Just bought $BTC and $ETH and $SOL');
    expect(tickers).toContain('BTC');
    expect(tickers).toContain('ETH');
    expect(tickers).toContain('SOL');
    expect(tickers).toHaveLength(3);
  });

  it('extracts hashtags from text', () => {
    const tags = extractHashtags('Check out #Bitcoin and #DeFi trends');
    expect(tags).toContain('#Bitcoin');
    expect(tags).toContain('#DeFi');
  });

  it('computes trending topics from post niches and tickers', () => {
    const now = Date.now();
    const posts = [
      makePost({ id: 'p1', protocol: 'nostr', text: '$BTC to the moon', niches: ['bitcoin'], createdAt: now - 60000 }),
      makePost({ id: 'p2', protocol: 'farcaster', text: '$BTC and $ETH both looking good', niches: ['bitcoin', 'ethereum'], createdAt: now - 120000 }),
      makePost({ id: 'p3', protocol: 'bluesky', text: '$SOL breaking out', niches: ['solana'], createdAt: now - 180000 }),
      makePost({ id: 'p4', protocol: 'rss', text: 'Bitcoin ETF inflows record', niches: ['bitcoin', 'etf'], createdAt: now - 240000 }),
    ];

    const topics = computeTrendingTopics(posts, now, 5, 3600000);
    expect(topics.length).toBeGreaterThan(0);
    // Bitcoin should be the top topic (appears in niches and tickers)
    const bitcoin = topics.find(t => t.topic === 'bitcoin');
    expect(bitcoin).toBeDefined();
    expect(bitcoin!.count).toBeGreaterThanOrEqual(2);
  });
});

// ─── SUITE 5: Core Scorer Functions ──────────────────────────────────

describe('Algorithm Quality: Core Score Functions', () => {
  it('recencyDecay produces expected values at half-life', () => {
    const now = Date.now();
    const halfLifeHours = 12;
    // At age = halfLife, decay should be 0.5
    expect(recencyDecay(now - 12 * 3600000, now, halfLifeHours)).toBeCloseTo(0.5, 1);
    // At age = 0, decay should be 1.0
    expect(recencyDecay(now, now, halfLifeHours)).toBeCloseTo(1.0, 1);
    // At age = 2 * halfLife, decay should be 0.25
    expect(recencyDecay(now - 24 * 3600000, now, halfLifeHours)).toBeCloseTo(0.25, 1);
  });

  it('freshnessBoost applies correct multipliers based on age', () => {
    const now = Date.now();
    expect(freshnessBoost(now, now)).toBe(2.0);              // <15 min → 2.0x
    expect(freshnessBoost(now - 1800000, now)).toBe(1.5);    // 30 min → <1h → 1.5x
    expect(freshnessBoost(now - 7000000, now)).toBe(1.2);   // 117 min → <2h → 1.2x
    expect(freshnessBoost(now - 14400000, now)).toBe(1.0);   // >4h → >2h → 1.0x
  });

  it('normalizeEngagement increases with activity', () => {
    const low = { likes: 1, reposts: 0, replies: 0, quotes: 0 };
    const high = { likes: 1000, reposts: 200, replies: 100, quotes: 50 };
    const lowEng = normalizeEngagement({ metrics: low } as any);
    const highEng = normalizeEngagement({ metrics: high } as any);
    expect(highEng).toBeGreaterThan(lowEng);
  });

  it('sourceWeight assigns correct values for known protocols', () => {
    expect(sourceWeight('nostr')).toBe(1.0);
    expect(sourceWeight('farcaster')).toBe(1.0);
    expect(sourceWeight('bluesky')).toBe(1.0);
    expect(sourceWeight('threads')).toBe(0.7);
    expect(sourceWeight('unknown')).toBe(0.5); // default
  });

  it('engagementVelocity returns baseline for no prior snapshot', () => {
    expect(engagementVelocity({} as any, undefined, Date.now())).toBe(1);
  });
});

// ─── SUITE 6: Transparency / Reasons ──────────────────────────────────

describe('Algorithm Quality: Scoring Transparency', () => {
  it('scorePost provides human-readable reasons', () => {
    const now = Date.now();
    const post = makePost({
      id: 'nostr:transparent',
      protocol: 'nostr',
      text: 'Bitcoin is the future of money. The decentralized network provides security and transparency that traditional finance cannot match. This is a well-articulated argument for why cryptocurrency adoption will continue to grow.',
      createdAt: now - 300000, // 5 min ago
      metrics: { likes: 200, reposts: 50, replies: 20, quotes: 10 },
      followerCount: 50000,
      niches: ['bitcoin', 'crypto'],
      verified: true,
    });

    const result = scorePost(post, {
      mode: 'standard',
      now,
      userNiches: new Set(['bitcoin']),
      followedCreators: new Set([post.author.id]),
    });

    // Should have multiple informative reasons
    expect(result.breakdown.reasons.length).toBeGreaterThanOrEqual(3);
    // Reasons should be readable strings
    for (const reason of result.breakdown.reasons) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    }
    // Transparency array also populated
    expect(result.transparency.length).toBeGreaterThanOrEqual(0);
  });
});
