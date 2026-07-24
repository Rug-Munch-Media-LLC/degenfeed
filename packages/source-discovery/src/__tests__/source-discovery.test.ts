import { describe, expect, it } from 'vitest';
import {
  aggregateStats,
  buildTrendingSource,
  CRYPTO_KEYWORDS,
  computeQualityScore,
  computeSourceHealthScore,
  computeTrendingScore,
  DEFAULT_DISCOVERY_CONFIG,
  detectStaleSources,
  estimateRelevance,
  getNewThisWeek,
  isBlocklisted,
  SEARCH_KEYWORDS,
} from '../index';
import type { DiscoveredSource, SourceHealth } from '../types';

const MINIMAL_SOURCE = {
  id: 'test:1',
  platform: 'reddit' as const,
  name: 'r/test',
  url: 'https://reddit.com/r/test',
  subscriberCount: 1000,
  weeklyActivity: 5,
  relevanceScore: 0.8,
};

const SAMPLE_SOURCE: Omit<DiscoveredSource, 'score' | 'autoApproved' | 'status' | 'discoveredAt'> =
  {
    id: 'reddit:crypto',
    platform: 'reddit',
    name: 'r/CryptoCurrency',
    url: 'https://reddit.com/r/CryptoCurrency',
    iconUrl: undefined,
    description: 'All about cryptocurrency',
    subscriberCount: 5000000,
    weeklyActivity: 50,
    sourceCreatedAt: Date.now() - 365 * 86400000,
    relevanceScore: 0.95,
    metadata: { keyword: 'crypto' },
  };

describe('DEFAULT_DISCOVERY_CONFIG', () => {
  it('has auto-approve threshold of 0.7', () => {
    expect(DEFAULT_DISCOVERY_CONFIG.autoApproveThreshold).toBe(0.7);
  });

  it('has minimum subscriber count of 100', () => {
    expect(DEFAULT_DISCOVERY_CONFIG.minSubscribers).toBe(100);
  });

  it('has blocklist patterns for spam/scam keywords', () => {
    expect(DEFAULT_DISCOVERY_CONFIG.blocklistPatterns.length).toBeGreaterThan(0);
    expect(DEFAULT_DISCOVERY_CONFIG.blocklistPatterns[0]).toBeInstanceOf(RegExp);
  });
});

describe('CRYPTO_KEYWORDS and SEARCH_KEYWORDS', () => {
  it('CRYPTO_KEYWORDS contains major crypto terms', () => {
    expect(CRYPTO_KEYWORDS).toContain('bitcoin');
    expect(CRYPTO_KEYWORDS).toContain('ethereum');
    expect(CRYPTO_KEYWORDS).toContain('solana');
    expect(CRYPTO_KEYWORDS).toContain('defi');
    expect(CRYPTO_KEYWORDS).toContain('web3');
  });

  it('SEARCH_KEYWORDS is a subset of relevant terms', () => {
    expect(SEARCH_KEYWORDS.length).toBeGreaterThanOrEqual(5);
    for (const kw of SEARCH_KEYWORDS) {
      expect(CRYPTO_KEYWORDS).toContain(kw);
    }
  });
});

describe('computeQualityScore', () => {
  it('returns score and signals for a valid source', () => {
    const result = computeQualityScore(SAMPLE_SOURCE, DEFAULT_DISCOVERY_CONFIG);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.signals).toHaveProperty('subscribers');
    expect(result.signals).toHaveProperty('activity');
    expect(result.signals).toHaveProperty('age');
    expect(result.signals).toHaveProperty('relevance');
    expect(result.signals).toHaveProperty('penalty');
  });

  it('passes threshold for high-quality sources', () => {
    const result = computeQualityScore(SAMPLE_SOURCE, DEFAULT_DISCOVERY_CONFIG);
    expect(result.passed).toBe(true);
  });

  it('fails sources below minimum subscribers', () => {
    const lowSubSource = { ...MINIMAL_SOURCE, subscriberCount: 10 };
    const result = computeQualityScore(lowSubSource, DEFAULT_DISCOVERY_CONFIG);
    expect(result.passed).toBe(false);
  });

  it('applies penalty for blocklisted names', () => {
    const spamSource = { ...MINIMAL_SOURCE, name: 'spam crypto free money' };
    const result = computeQualityScore(spamSource, DEFAULT_DISCOVERY_CONFIG);
    expect(result.signals.penalty).toBeLessThan(0);
  });

  it('returns score of 0 when all signals are zero', () => {
    const zeroSource = {
      ...MINIMAL_SOURCE,
      subscriberCount: 0,
      weeklyActivity: 0,
      relevanceScore: 0,
      sourceCreatedAt: undefined,
    };
    const result = computeQualityScore(zeroSource, DEFAULT_DISCOVERY_CONFIG);
    expect(result.score).toBe(0.05); // default age score
    expect(result.passed).toBe(false);
  });

  it('caps score at 1.0', () => {
    const maxSource = {
      ...SAMPLE_SOURCE,
      subscriberCount: 100_000_000,
      weeklyActivity: 1000,
      relevanceScore: 1.0,
    };
    const result = computeQualityScore(maxSource, DEFAULT_DISCOVERY_CONFIG);
    expect(result.score).toBeLessThanOrEqual(1.0);
  });
});

describe('isBlocklisted', () => {
  it('returns true for names containing spam patterns', () => {
    expect(isBlocklisted('free scam tokens', undefined, DEFAULT_DISCOVERY_CONFIG)).toBe(true);
    expect(isBlocklisted('ponzi scheme club', undefined, DEFAULT_DISCOVERY_CONFIG)).toBe(true);
  });

  it('returns false for clean names', () => {
    expect(isBlocklisted('Bitcoin Magazine', undefined, DEFAULT_DISCOVERY_CONFIG)).toBe(false);
    expect(isBlocklisted('Ethereum Foundation', undefined, DEFAULT_DISCOVERY_CONFIG)).toBe(false);
  });

  it('checks description for blocklisted terms', () => {
    expect(isBlocklisted('Good Source', 'This is a pyramid scheme', DEFAULT_DISCOVERY_CONFIG)).toBe(
      true,
    );
  });
});

describe('estimateRelevance', () => {
  it('returns high score for names with crypto keywords', () => {
    const score = estimateRelevance('Bitcoin Trading Club');
    expect(score).toBeGreaterThan(0.2);
  });

  it('returns 0 for unrelated names', () => {
    const score = estimateRelevance('Cooking Recipes');
    expect(score).toBe(0);
  });

  it('boosts score when keywords appear in name vs description', () => {
    const nameOnly = estimateRelevance('Crypto News Daily', 'All about finance');
    const nameAndDesc = estimateRelevance('Finance News', 'All about crypto and bitcoin');
    expect(nameOnly).toBeGreaterThan(nameAndDesc);
  });
});

describe('computeSourceHealthScore', () => {
  it('returns active lifecycle for healthy source', () => {
    const health: Partial<SourceHealth> = {
      postFrequency: 5,
      spamScore: 0,
      engagementScore: 0.8,
      relevanceScore: 0.9,
      lastPostAt: Date.now() - 1000,
    };
    const result = computeSourceHealthScore(health);
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.lifecycle).toBe('active');
  });

  it('returns culled lifecycle for poor health source', () => {
    const health: Partial<SourceHealth> = {
      postFrequency: 0,
      spamScore: 0.9,
      engagementScore: 0.1,
      relevanceScore: 0.1,
      lastPostAt: Date.now() - 86400000 * 20,
    };
    const result = computeSourceHealthScore(health);
    expect(result.lifecycle).toBe('culled');
    expect(result.score).toBeLessThan(0.3);
  });

  it('returns dormant for sources with no recent posts', () => {
    const health: Partial<SourceHealth> = {
      postFrequency: 1,
      spamScore: 0,
      engagementScore: 0.5,
      relevanceScore: 0.5,
      lastPostAt: Date.now() - 86400000 * 60,
    };
    const result = computeSourceHealthScore(health);
    expect(result.lifecycle).toBe('dormant');
  });
});

describe('detectStaleSources', () => {
  it('returns sources that have not posted within threshold', () => {
    const now = Date.now();
    const sources: SourceHealth[] = [
      {
        sourceId: 'active',
        platform: 'reddit',
        lastPostAt: now - 1000,
        postFrequency: 5,
        engagementScore: 0.8,
        relevanceScore: 0.9,
        spamScore: 0,
        compositeScore: 0.8,
        lastCheckedAt: now,
        spamFlagCount: 0,
        engagement30d: 100,
        postCount30d: 10,
      },
      {
        sourceId: 'stale',
        platform: 'rss',
        lastPostAt: now - 86400000 * 30,
        postFrequency: 0,
        engagementScore: 0.1,
        relevanceScore: 0.1,
        spamScore: 0,
        compositeScore: 0.1,
        lastCheckedAt: now,
        spamFlagCount: 0,
        engagement30d: 0,
        postCount30d: 0,
      },
    ];
    const stale = detectStaleSources(sources, 14);
    expect(stale).toHaveLength(1);
    expect(stale[0].sourceId).toBe('stale');
  });

  it('returns empty array when all sources are active', () => {
    const now = Date.now();
    const sources: SourceHealth[] = [
      {
        sourceId: 'active1',
        platform: 'reddit',
        lastPostAt: now - 1000,
        postFrequency: 3,
        engagementScore: 0.5,
        relevanceScore: 0.5,
        spamScore: 0,
        compositeScore: 0.5,
        lastCheckedAt: now,
        spamFlagCount: 0,
        engagement30d: 50,
        postCount30d: 5,
      },
    ];
    expect(detectStaleSources(sources)).toHaveLength(0);
  });
});

describe('computeTrendingScore', () => {
  it('returns 1.0 for 10x baseline ratio', () => {
    const score = computeTrendingScore(100, 10);
    expect(score).toBeCloseTo(0.667, 1);
  });

  it('returns 0 for zero velocity', () => {
    expect(computeTrendingScore(0, 10)).toBe(0);
  });

  it('handles zero baseline by using velocity directly', () => {
    const score = computeTrendingScore(5, 0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('buildTrendingSource', () => {
  it('builds trending source record with computed score', () => {
    const result = buildTrendingSource(
      'reddit:crypto',
      'r/CryptoCurrency',
      'reddit',
      50,
      10,
      5,
      Date.now() - 86400000,
      Date.now(),
    );

    expect(result.sourceId).toBe('reddit:crypto');
    expect(result.platform).toBe('reddit');
    expect(result.trendingScore).toBeGreaterThan(0);
  });
});

describe('getNewThisWeek', () => {
  it('filters sources discovered within the last N days', () => {
    const now = Date.now();
    const sources: DiscoveredSource[] = [
      {
        id: 'new',
        platform: 'reddit',
        name: 'r/new',
        url: 'https://reddit.com/r/new',
        score: 0.5,
        subscriberCount: 100,
        weeklyActivity: 1,
        discoveredAt: now - 1000,
        autoApproved: false,
        status: 'pending',
        relevanceScore: 0.5,
      },
      {
        id: 'old',
        platform: 'reddit',
        name: 'r/old',
        url: 'https://reddit.com/r/old',
        score: 0.5,
        subscriberCount: 100,
        weeklyActivity: 1,
        discoveredAt: now - 86400000 * 14,
        autoApproved: false,
        status: 'pending',
        relevanceScore: 0.5,
      },
    ];
    const recent = getNewThisWeek(sources, now, 7);
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe('new');
  });
});

describe('aggregateStats', () => {
  it('aggregates stats from sources and runs', () => {
    const sources: DiscoveredSource[] = [
      {
        id: 'r1',
        platform: 'reddit',
        name: 'r/crypto',
        url: 'https://reddit.com/r/crypto',
        score: 0.8,
        subscriberCount: 1000,
        weeklyActivity: 10,
        discoveredAt: Date.now(),
        autoApproved: true,
        status: 'approved',
        relevanceScore: 0.9,
      },
      {
        id: 'r2',
        platform: 'reddit',
        name: 'r/pending',
        url: 'https://reddit.com/r/pending',
        score: 0.5,
        subscriberCount: 100,
        weeklyActivity: 1,
        discoveredAt: Date.now(),
        autoApproved: false,
        status: 'pending',
        relevanceScore: 0.5,
      },
    ];
    const healthMap = new Map<string, SourceHealth>();
    const runs = [{ platform: 'reddit', discovered: 2, autoApproved: 1, pending: 1 }];
    const stats = aggregateStats(sources, healthMap, runs);

    expect(stats.totalRuns).toBe(1);
    expect(stats.totalDiscovered).toBe(2);
    expect(stats.totalApproved).toBe(1);
    expect(stats.pendingCount).toBe(1);
    expect(stats.perPlatform.reddit.discovered).toBe(2);
  });
});
