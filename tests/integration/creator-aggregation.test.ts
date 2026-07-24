/**
 * ═════════════════════════════════════════════════════════════════════════════
 * CREATOR AGGREGATION INTEGRATION TESTS — 10 tests
 *
 * Tests content source discovery and quality scoring across platforms:
 *   - YouTube channel discovery heuristics
 *   - Source quality scoring and auto-approval
 *   - Cross-platform creator profile aggregation
 *   - Source health scoring
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DISCOVERY_CONFIG,
  computeQualityScore,
  computeSourceHealthScore,
  computeTrendingScore,
  detectStaleSources,
  estimateRelevance,
  getNewThisWeek,
  isBlocklisted,
} from '../../packages/source-discovery/src';
import type { DiscoveredSource, SourceHealth } from '../../packages/source-discovery/src/types';

describe('Creator Discovery — YouTube', () => {
  it('should detect crypto relevance from channel name', () => {
    const score = estimateRelevance('Bitcoin Magazine', 'Bitcoin news and analysis');
    expect(score).toBeGreaterThan(0);
  });

  it('should detect crypto relevance from description keywords', () => {
    const score = estimateRelevance('Random Channel', 'We talk about crypto, defi, and web3');
    expect(score).toBeGreaterThan(0.1);
  });

  it('should assign low relevance for non-crypto content', () => {
    const score = estimateRelevance('Cat Videos', 'Funny cat compilation');
    expect(score).toBeLessThan(0.1);
  });
});

describe('Creator Discovery — Quality Scoring', () => {
  function makeCandidate(
    overrides: Partial<DiscoveredSource> = {},
  ): Omit<DiscoveredSource, 'score' | 'autoApproved' | 'status' | 'discoveredAt'> {
    return {
      id: 'test:123',
      platform: 'youtube',
      name: 'Test Channel',
      url: 'https://example.com',
      subscriberCount: 10000,
      weeklyActivity: 5,
      relevanceScore: 0.8,
      sourceCreatedAt: Date.now() - 365 * 86_400_000, // 1 year old
      ...overrides,
    };
  }

  it('should auto-approve high-quality sources', () => {
    const candidate = makeCandidate({ subscriberCount: 50000, weeklyActivity: 10, relevanceScore: 0.9 });
    const result = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.passed).toBe(true);
  });

  it('should reject low-subscriber sources', () => {
    const candidate = makeCandidate({ subscriberCount: 10, weeklyActivity: 1, relevanceScore: 0.9 });
    const result = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);
    expect(result.passed).toBe(false);
    expect(result.signals.subscribers).toBeLessThan(0.1);
  });

  it('should apply blocklist penalty for scam keywords', () => {
    const candidate = makeCandidate({ name: 'Free Bitcoin Scam' });
    expect(isBlocklisted(candidate.name, candidate.description, DEFAULT_DISCOVERY_CONFIG)).toBe(true);
    const result = computeQualityScore(candidate, DEFAULT_DISCOVERY_CONFIG);
    expect(result.signals.penalty).toBeLessThan(0);
  });

  it('should compute higher score for older established channels', () => {
    const old = makeCandidate({ sourceCreatedAt: Date.now() - 3 * 365 * 86_400_000 }); // 3 years
    const young = makeCandidate({ sourceCreatedAt: Date.now() - 60 * 86_400_000 }); // 2 months
    const oldResult = computeQualityScore(old, DEFAULT_DISCOVERY_CONFIG);
    const youngResult = computeQualityScore(young, DEFAULT_DISCOVERY_CONFIG);
    expect(oldResult.signals.age).toBeGreaterThan(youngResult.signals.age);
  });
});

describe('Creator Profiles — Source Health', () => {
  it('should classify active sources correctly', () => {
    const health: SourceHealth = {
      sourceId: 'test:123',
      platform: 'youtube',
      lastPostAt: Date.now() - 1 * 86_400_000, // 1 day ago
      postFrequency: 3,
      engagementScore: 0.6,
      relevanceScore: 0.8,
      spamScore: 0.1,
      compositeScore: 0.7,
      lastCheckedAt: Date.now(),
      spamFlagCount: 0,
      engagement30d: 100,
      postCount30d: 12,
    };
    const result = computeSourceHealthScore(health);
    expect(result.lifecycle).toBe('active');
    expect(result.score).toBeGreaterThan(0.3);
  });

  it('should classify dormant sources with no recent posts', () => {
    const health: SourceHealth = {
      sourceId: 'test:456',
      platform: 'youtube',
      lastPostAt: Date.now() - 45 * 86_400_000, // 45 days ago
      postFrequency: 0.2,
      engagementScore: 0.1,
      relevanceScore: 0.5,
      spamScore: 0.3,
      compositeScore: 0.2,
      lastCheckedAt: Date.now(),
      spamFlagCount: 2,
      engagement30d: 5,
      postCount30d: 1,
    };
    const result = computeSourceHealthScore(health);
    expect(result.lifecycle).toBe('dormant');
  });

  it('should compute trending score based on velocity ratio', () => {
    const trending = computeTrendingScore(100, 10); // 10x baseline
    expect(trending).toBeGreaterThan(0.5);
    expect(trending).toBeLessThanOrEqual(1);
  });

  it('should detect stale sources not posted in threshold', () => {
    const sources: SourceHealth[] = [
      {
        sourceId: 'fresh:1',
        platform: 'youtube',
        lastPostAt: Date.now() - 1 * 86_400_000,
        postFrequency: 5,
        engagementScore: 0.5,
        relevanceScore: 0.8,
        spamScore: 0,
        compositeScore: 0.7,
        lastCheckedAt: Date.now(),
        spamFlagCount: 0,
        engagement30d: 50,
        postCount30d: 5,
      },
      {
        sourceId: 'stale:1',
        platform: 'youtube',
        lastPostAt: Date.now() - 30 * 86_400_000,
        postFrequency: 0.1,
        engagementScore: 0.1,
        relevanceScore: 0.3,
        spamScore: 0.5,
        compositeScore: 0.15,
        lastCheckedAt: Date.now(),
        spamFlagCount: 3,
        engagement30d: 2,
        postCount30d: 0,
      },
    ];
    const stale = detectStaleSources(sources, 14);
    expect(stale).toHaveLength(1);
    expect(stale[0]?.sourceId).toBe('stale:1');
  });

  it('should filter sources discovered this week', () => {
    const now = Date.now();
    const sources: DiscoveredSource[] = [
      {
        id: 'new:1',
        platform: 'youtube',
        name: 'New Channel',
        url: 'https://example.com/1',
        score: 0.8,
        subscriberCount: 5000,
        weeklyActivity: 5,
        discoveredAt: now - 1 * 86_400_000, // 1 day ago
        autoApproved: true,
        status: 'approved',
        relevanceScore: 0.7,
      },
      {
        id: 'old:1',
        platform: 'youtube',
        name: 'Old Channel',
        url: 'https://example.com/2',
        score: 0.8,
        subscriberCount: 5000,
        weeklyActivity: 5,
        discoveredAt: now - 20 * 86_400_000, // 20 days ago
        autoApproved: true,
        status: 'approved',
        relevanceScore: 0.7,
      },
    ];
    const newThisWeek = getNewThisWeek(sources, now, 7);
    expect(newThisWeek).toHaveLength(1);
    expect(newThisWeek[0]?.id).toBe('new:1');
  });
});
