/**
 * @degenfeed/integration — Shorts Algorithm Tests
 *
 * Exercises the ShortsAlgorithm class (pure algorithm logic),
 * phase transitions, personalization, creator diversity, and
 * the ShortsAggregatorV2 dedup & quality scoring pipeline.
 */
import { describe, expect, it, vi } from 'vitest';

// ─── Mock external deps ───────────────────────────────────────────────

vi.mock('@degenfeed/feed-core', () => ({
  detectNiches: (text: string) => {
    const found: string[] = [];
    if (/\b(bitcoin|crypto|defi)\b/.test(text)) found.push('crypto');
    if (/\b(meme|memecoin|pepe|doge)\b/.test(text)) found.push('memecoin');
    if (/\b(ai|machine learning|llm|gpt)\b/.test(text)) found.push('ai');
    if (/\b(gaming|gamefi|play-to-earn)\b/.test(text)) found.push('gaming');
    return found;
  },
}));

vi.mock('@degenfeed/shorts-provider', () => ({
  fetchPeerTubeShorts: vi.fn().mockResolvedValue([]),
  fetchYouTubeShorts: vi.fn().mockResolvedValue([]),
  fetchTikTokShorts: vi.fn().mockResolvedValue([]),
  fetchInstagramReels: vi.fn().mockResolvedValue([]),
  SOURCE_COLORS: {
    owncast: '#6441a5',
    youtube: '#ff0000',
    peertube: '#f1680d',
  },
}));

// ─── Helper: create a minimal AggregatedShort ──────────────────────────

import type { AggregatedShort } from '../../workers/api/src/feed/shorts-aggregator-v2';

function makeShort(
  overrides: Partial<AggregatedShort> & { id: string; creatorName: string },
): AggregatedShort {
  return {
    source: 'peertube',
    sourceLabel: 'PeerTube',
    sourceColor: '#f1680d',
    sourceUrl: '',
    title: 'Test Short',
    description: '',
    thumbnailUrl: '',
    videoUrl: `https://example.com/video/${overrides.id}`,
    duration: 30,
    creatorAvatar: undefined,
    creatorHandle: undefined,
    views: 1000,
    likes: 50,
    tags: overrides.tags ?? ['crypto'],
    categories: overrides.categories ?? ['crypto'],
    publishedAt: Date.now() - 3600000,
    qualityScore: 0.6,
    engagementRate: 0.05,
    canTip: true,
    contentHash: `hash:${overrides.id}`,
    vertical: true,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('Shorts Algorithm — Phase Detection', () => {
  it('returns cold_start for new users (<10 watches)', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    expect(algo.getPhase()).toBe('cold_start');
    expect(algo.getPhase({ totalWatches: 0 } as any)).toBe('cold_start');
    expect(algo.getPhase({ totalWatches: 5 } as any)).toBe('cold_start');
    expect(algo.getPhase({ totalWatches: 9 } as any)).toBe('cold_start');
  });

  it('returns learning for users with 10-49 watches', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    expect(algo.getPhase({ totalWatches: 10 } as any)).toBe('learning');
    expect(algo.getPhase({ totalWatches: 30 } as any)).toBe('learning');
    expect(algo.getPhase({ totalWatches: 49 } as any)).toBe('learning');
  });

  it('returns personalized for users with 50+ watches', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    expect(algo.getPhase({ totalWatches: 50 } as any)).toBe('personalized');
    expect(algo.getPhase({ totalWatches: 500 } as any)).toBe('personalized');
  });
});

describe('Shorts Algorithm — Cold Start', () => {
  it('returns shorts for a new user with no profile', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const pool = [
      makeShort({ id: 's1', creatorName: 'Alice', tags: ['crypto'], views: 50000 }),
      makeShort({ id: 's2', creatorName: 'Bob', tags: ['memecoin'], views: 100 }),
      makeShort({ id: 's3', creatorName: 'Charlie', tags: ['ai'], views: 20000 }),
    ];

    const result = algo.recommend(pool, { limit: 3 });
    expect(result.phase).toBe('cold_start');
    expect(result.shorts.length).toBe(3);
    expect(result.scores).toBeDefined();
    expect(Object.keys(result.scores).length).toBeGreaterThanOrEqual(1);
  });

  it('excludes seen shorts via seenIds', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const pool = [
      makeShort({ id: 's1', creatorName: 'Alice', tags: ['crypto'] }),
      makeShort({ id: 's2', creatorName: 'Bob', tags: ['memecoin'] }),
    ];

    const result = algo.recommend(pool, { limit: 10, seenIds: new Set(['s1']) });
    expect(result.shorts.length).toBe(1);
    expect(result.shorts[0]?.id).toBe('s2');
  });

  it('filters by category', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const pool = [
      makeShort({ id: 's1', creatorName: 'Alice', tags: ['crypto'], categories: ['crypto'] }),
      makeShort({ id: 's2', creatorName: 'Bob', tags: ['gaming'], categories: ['gaming'] }),
      makeShort({
        id: 's3',
        creatorName: 'Charlie',
        tags: ['crypto', 'defi'],
        categories: ['crypto'],
      }),
    ];

    const result = algo.recommend(pool, { limit: 10, category: 'gaming' });
    expect(result.shorts.length).toBe(1);
    expect(result.shorts[0]?.id).toBe('s2');
  });

  it('returns empty result when no shorts available', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const result = algo.recommend([], { limit: 10 });
    expect(result.shorts).toEqual([]);
    expect(result.scores).toEqual({});
    expect(result.reasons).toEqual({});
  });
});

describe('Shorts Algorithm — Learning Phase', () => {
  it('scores based on tag affinities from limited watch history', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const profile = {
      totalWatches: 20,
      tagAffinities: { crypto: 0.8, memecoin: 0.2 },
      creatorAffinities: {},
      sourceAffinities: {},
      creatorCompletion: {},
      tagCompletion: {},
      recentShorts: [],
      recentCreators: [],
      avgWatchPercent: 0.6,
      preferredDuration: 30,
      algorithmVersion: 'v2',
      updatedAt: Date.now(),
    };

    const pool = [
      makeShort({ id: 's1', creatorName: 'Alice', tags: ['crypto'], views: 100 }),
      makeShort({ id: 's2', creatorName: 'Bob', tags: ['memecoin'], views: 100 }),
      makeShort({ id: 's3', creatorName: 'Charlie', tags: ['gaming'], views: 100 }),
    ];

    const result = algo.recommend(pool, { limit: 3, profile });
    expect(result.phase).toBe('learning');

    // Crypto should be ranked higher due to tag affinity
    const cryptoIndex = result.shorts.findIndex((s) => s.id === 's1');
    const gamingIndex = result.shorts.findIndex((s) => s.id === 's3');
    expect(cryptoIndex).toBeLessThan(gamingIndex);
  });
});

describe('Shorts Algorithm — Personalized Phase', () => {
  it('uses full scoring formula for 50+ watch users', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const profile = {
      totalWatches: 100,
      tagAffinities: { crypto: 0.9, memecoin: 0.1 },
      creatorAffinities: { Alice: 0.8 },
      sourceAffinities: { peertube: 0.7 },
      creatorCompletion: { Alice: { totalMs: 300000, count: 10 } },
      tagCompletion: { crypto: { totalMs: 500000, count: 15 } },
      recentShorts: ['s_old'],
      recentCreators: ['Bob'],
      avgWatchPercent: 0.75,
      preferredDuration: 30,
      algorithmVersion: 'v2',
      updatedAt: Date.now(),
    };

    const pool = [
      makeShort({ id: 's1', creatorName: 'Alice', tags: ['crypto'], views: 1000, likes: 100 }),
      makeShort({ id: 's2', creatorName: 'Bob', tags: ['memecoin'], views: 500, likes: 10 }),
      makeShort({ id: 's3', creatorName: 'David', tags: ['crypto'], views: 100, likes: 5 }),
    ];

    const result = algo.recommend(pool, { limit: 3, profile });
    expect(result.phase).toBe('personalized');

    // Alice with high creator affinity + crypto = should be first
    expect(result.shorts[0]?.id).toBe('s1');
  });
});

describe('Shorts Algorithm — Watch Event Processing', () => {
  it('updates profile based on watch events', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const profile = algo.createDefaultProfile();
    expect(profile.totalWatches).toBe(0);

    const short = makeShort({ id: 'watch-1', creatorName: 'Alice', tags: ['crypto', 'defi'] });

    const updated = algo.updateProfile(
      profile,
      {
        shortId: 'watch-1',
        watchPercent: 0.9,
        liked: true,
        shared: false,
        watchedFull: true,
        skipped: false,
        watchDurationMs: 25000,
        timestamp: Date.now(),
      },
      short,
    );

    expect(updated.totalWatches).toBe(1);
    expect(updated.tagAffinities.crypto).toBeGreaterThan(0.1);
    expect(updated.creatorAffinities.Alice).toBeGreaterThan(0.1);
    expect(updated.recentShorts).toContain('watch-1');
  });

  it('reduces affinity for skipped content', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const profile = algo.createDefaultProfile();
    // Pre-establish some affinity
    profile.tagAffinities.crypto = 0.5;
    profile.creatorAffinities.Bob = 0.5;

    const short = makeShort({ id: 'skip-1', creatorName: 'Bob', tags: ['crypto'] });

    const updated = algo.updateProfile(
      profile,
      {
        shortId: 'skip-1',
        watchPercent: 0.1,
        liked: false,
        shared: false,
        watchedFull: false,
        skipped: true,
        watchDurationMs: 2000,
        timestamp: Date.now(),
      },
      short,
    );

    expect(updated.tagAffinities.crypto).toBeLessThan(0.5);
    expect(updated.creatorAffinities.Bob).toBeLessThan(0.5);
  });
});

describe('Shorts Algorithm — Creator Diversity', () => {
  it('prevents consecutive shorts from the same creator when possible', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const pool = [
      makeShort({ id: 's1', creatorName: 'Alice', tags: ['crypto'] }),
      makeShort({ id: 's2', creatorName: 'Bob', tags: ['memecoin'] }),
      makeShort({ id: 's3', creatorName: 'Charlie', tags: ['defi'] }),
      makeShort({ id: 's4', creatorName: 'Alice', tags: ['nft'] }),
      makeShort({ id: 's5', creatorName: 'David', tags: ['gaming'] }),
    ];

    const result = algo.recommend(pool, { limit: 5 });

    // Should have at most 1 pair of consecutives from same creator
    // (with enough diverse creators, the algorithm tries to avoid)
    let consecutivePairs = 0;
    for (let i = 1; i < result.shorts.length; i++) {
      if (result.shorts[i]?.creatorName === result.shorts[i - 1]?.creatorName) {
        consecutivePairs++;
      }
    }
    expect(consecutivePairs).toBeLessThanOrEqual(1);
  });
});

describe('Shorts Algorithm — Freshness Boost', () => {
  it('boosts shorts published within the last hour during session', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const now = Date.now();
    const pool = [
      makeShort({
        id: 'fresh',
        creatorName: 'Alice',
        tags: ['crypto'],
        publishedAt: now - 30 * 60 * 1000,
      }),
      makeShort({
        id: 'old',
        creatorName: 'Bob',
        tags: ['crypto'],
        publishedAt: now - 48 * 3600 * 1000,
      }),
    ];

    const result = algo.recommend(pool, { limit: 2, sessionStartedAt: now });
    expect(result.shorts[0]?.id).toBe('fresh');
  });
});

describe('Shorts Algorithm — Trending Categories', () => {
  it('returns trending categories from a pool', async () => {
    const { ShortsAlgorithm } = await import('../../workers/api/src/feed/shorts-algorithm');
    const algo = new ShortsAlgorithm();

    const now = Date.now();
    const pool = [
      makeShort({
        id: 's1',
        creatorName: 'A',
        tags: ['crypto'],
        categories: ['crypto'],
        publishedAt: now - 1000,
      }),
      makeShort({
        id: 's2',
        creatorName: 'B',
        tags: ['crypto'],
        categories: ['crypto'],
        publishedAt: now - 2000,
      }),
      makeShort({
        id: 's3',
        creatorName: 'C',
        tags: ['memecoin'],
        categories: ['memecoin'],
        publishedAt: now - 3000,
      }),
      makeShort({
        id: 's4',
        creatorName: 'D',
        tags: ['ai'],
        categories: ['ai'],
        publishedAt: now - 10000,
      }),
    ];

    const trending = algo.getTrendingCategories(pool, 24);
    expect(trending.length).toBeGreaterThan(0);
    expect(trending[0]?.category).toBe('crypto');
  });
});

describe('Shorts Aggregator — Deduplication', () => {
  it('deduplicates shorts by URL hash', async () => {
    const { ShortsAggregatorV2 } = await import('../../workers/api/src/feed/shorts-aggregator-v2');
    const env = { CACHE: { get: vi.fn(), put: vi.fn() } } as any;
    const agg = new ShortsAggregatorV2(env);

    const shorts = [
      makeShort({ id: 'a', creatorName: 'Alice', videoUrl: 'https://example.com/video/1' }),
      makeShort({ id: 'b', creatorName: 'Bob', videoUrl: 'https://example.com/video/1' }), // same URL
      makeShort({ id: 'c', creatorName: 'Charlie', videoUrl: 'https://example.com/video/2' }),
    ];

    const deduped = agg.deduplicate(shorts);
    expect(deduped.length).toBe(2);
  });
});

describe('Shorts Aggregator — Source Health', () => {
  it('checks all sources and returns health status', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ online: true }), { status: 200 }));

    const { ShortsAggregatorV2 } = await import('../../workers/api/src/feed/shorts-aggregator-v2');
    const env = {
      OWCAST_INSTANCE_URL: 'https://owncast.example.com',
      RSS_BRIDGE_URL: '',
      LEMMY_INSTANCES: '',
      PIXELFED_INSTANCES: '',
      CACHE: { get: vi.fn(), put: vi.fn() },
    } as any;

    const agg = new ShortsAggregatorV2(env);
    const health = await agg.checkSourcesHealth();
    expect(health.length).toBeGreaterThanOrEqual(6);

    const owncastHealth = health.find((h) => h.source === 'owncast');
    expect(owncastHealth).toBeDefined();

    vi.stubGlobal('fetch', undefined);
  });
});
