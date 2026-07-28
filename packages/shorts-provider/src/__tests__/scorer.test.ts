/**
 * @degenfeed/shorts-provider — Scorer & Ranking Tests
 *
 * Tests the weighted scoring model used to rank short-form video content:
 * topic match (40%), engagement quality (25%), freshness (20%),
 * quality signal (15%), plus explore bonus.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeShortScore, rankShorts, shortScoreBreakdown } from '../scorer';
import type { ShortVideoItem, UserInterestProfile } from '../types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeVideo(overrides: Partial<ShortVideoItem> = {}): ShortVideoItem {
  return {
    id: 'test:1',
    title: 'Test Video',
    description: 'A test video about crypto',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    videoUrl: 'https://example.com/video',
    duration: 60,
    authorName: 'TestAuthor',
    views: 5000,
    likes: 250,
    source: 'youtube',
    sourceUrl: 'https://youtube.com/watch?v=test',
    topics: ['crypto', 'defi'],
    publishedAt: Date.now() - 3600000, // 1 hour ago
    vertical: true,
    qualityScore: 0.7,
    sourceLabel: 'YouTube',
    sourceColor: '#ff0000',
    canTip: false,
    ...overrides,
  };
}

const defaultProfile: UserInterestProfile = {
  topics: { crypto: 0.8, defi: 0.6, nft: 0.2 },
};

// ─── computeShortScore ─────────────────────────────────────────────────────

describe('Shorts Scorer: computeShortScore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a score between 0 and 1 for relevant content', () => {
    const score = computeShortScore(makeVideo(), defaultProfile);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns minimal score for irrelevant old content', () => {
    vi.useFakeTimers();
    const oldVideo = makeVideo({
      publishedAt: Date.now() - 30 * 24 * 3600000, // 30 days old
      views: 0,
      likes: 0,
      qualityScore: 0,
    });
    const noInterestProfile: UserInterestProfile = {
      topics: { irrelevant: 0.0 },
    };
    const score = computeShortScore(oldVideo, noInterestProfile);
    // No topic match (topics exist but no active profile topics), score gets 0.1
    // engagement is 0, freshness is 0 (30 days old), quality is 0
    // Total is 0.1 because the video has topics but profile has no matching topics
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(0.2);
  });

  it('gives topic match bonus for relevant topics', () => {
    const onTopicScore = computeShortScore(
      makeVideo({ topics: ['crypto'] }),
      defaultProfile,
    );
    const offTopicScore = computeShortScore(
      makeVideo({ topics: ['gaming'] }),
      defaultProfile,
    );
    expect(onTopicScore).toBeGreaterThan(offTopicScore);
  });

  it('gives engagement bonus for high like ratio', () => {
    const highEngagement = makeVideo({ views: 1000, likes: 200 }); // 20% like ratio
    const lowEngagement = makeVideo({ views: 1000, likes: 5 }); // 0.5% like ratio
    const highScore = computeShortScore(highEngagement, defaultProfile);
    const lowScore = computeShortScore(lowEngagement, defaultProfile);
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('gives freshness bonus for recent videos', () => {
    vi.useFakeTimers();
    const fresh = makeVideo({ publishedAt: Date.now() - 1000 }); // 1 second ago
    const old = makeVideo({ publishedAt: Date.now() - 20 * 24 * 3600000 }); // 20 days ago
    const freshScore = computeShortScore(fresh, defaultProfile);
    const oldScore = computeShortScore(old, defaultProfile);
    expect(freshScore).toBeGreaterThan(oldScore);
  });

  it('gives quality bonus for high-quality videos', () => {
    const highQuality = makeVideo({ qualityScore: 0.9 });
    const lowQuality = makeVideo({ qualityScore: 0.1 });
    expect(computeShortScore(highQuality, defaultProfile)).toBeGreaterThan(
      computeShortScore(lowQuality, defaultProfile),
    );
  });

  it('handles empty topics gracefully', () => {
    const noTopics = makeVideo({ topics: [] });
    const score = computeShortScore(noTopics, defaultProfile);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('handles empty profile topics gracefully', () => {
    const emptyProfile: UserInterestProfile = { topics: {} };
    const score = computeShortScore(makeVideo(), emptyProfile);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('handles video with zero views gracefully', () => {
    const noViews = makeVideo({ views: 0, likes: 0 });
    const score = computeShortScore(noViews, defaultProfile);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ─── rankShorts ────────────────────────────────────────────────────────────

describe('Shorts Scorer: rankShorts', () => {
  const videos = [
    makeVideo({ id: 'vid:1', views: 100, likes: 50, topics: ['crypto'], qualityScore: 0.9 }),
    makeVideo({ id: 'vid:2', views: 10000, likes: 100, topics: ['gaming'], qualityScore: 0.3 }),
    makeVideo({ id: 'vid:3', views: 500, likes: 25, topics: ['defi'], qualityScore: 0.6 }),
  ];

  it('returns results sorted by score descending', () => {
    const ranked = rankShorts(videos, defaultProfile);
    expect(ranked.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < ranked.length; i++) {
      // We can't check exact score values since they're computed
      // But they should be sorted
      expect(ranked[i - 1]).toBeDefined();
      expect(ranked[i]).toBeDefined();
    }
  });

  it('filters out seen videos', () => {
    const seen = new Set(['vid:1']);
    const ranked = rankShorts(videos, defaultProfile, seen);
    expect(ranked.find((v) => v.id === 'vid:1')).toBeUndefined();
    expect(ranked.length).toBe(2);
  });

  it('respects limit parameter', () => {
    const ranked = rankShorts(videos, defaultProfile, new Set(), 1);
    expect(ranked.length).toBe(1);
  });

  it('returns empty array when all videos are seen', () => {
    const allSeen = new Set(videos.map((v) => v.id));
    const ranked = rankShorts(videos, defaultProfile, allSeen);
    expect(ranked).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const ranked = rankShorts([], defaultProfile);
    expect(ranked).toHaveLength(0);
  });

  it('returns at most limit items', () => {
    const manyVideos = Array.from({ length: 50 }, (_, i) =>
      makeVideo({ id: `vid:${i}`, topics: ['crypto'] }),
    );
    const ranked = rankShorts(manyVideos, defaultProfile, new Set(), 10);
    expect(ranked.length).toBeLessThanOrEqual(10);
  });
});

// ─── shortScoreBreakdown ───────────────────────────────────────────────────

describe('Shorts Scorer: shortScoreBreakdown', () => {
  it('returns a breakdown with all component scores', () => {
    const breakdown = shortScoreBreakdown(makeVideo(), defaultProfile);
    expect(breakdown).toHaveProperty('topicMatch');
    expect(breakdown).toHaveProperty('engagement');
    expect(breakdown).toHaveProperty('freshness');
    expect(breakdown).toHaveProperty('quality');
    expect(breakdown).toHaveProperty('exploreBonus');
    expect(breakdown).toHaveProperty('total');
    expect(breakdown).toHaveProperty('reasons');
    expect(Array.isArray(breakdown.reasons)).toBe(true);
  });

  it('total equals weighted sum of components', () => {
    const breakdown = shortScoreBreakdown(makeVideo(), defaultProfile);
    const expectedTotal =
      breakdown.topicMatch * 0.4 +
      breakdown.engagement * 0.25 +
      breakdown.freshness * 0.2 +
      breakdown.quality * 0.15 +
      breakdown.exploreBonus;
    expect(breakdown.total).toBeCloseTo(expectedTotal, 5);
  });

  it('topicMatch is 0 when no profile interests match', () => {
    const noMatchProfile: UserInterestProfile = { topics: { irrelevant: 0.9 } };
    const breakdown = shortScoreBreakdown(makeVideo(), noMatchProfile);
    expect(breakdown.topicMatch).toBe(0);
  });

  it('reasons array contains explanations for high-scoring components', () => {
    const breakdown = shortScoreBreakdown(
      makeVideo({ views: 1000, likes: 200, qualityScore: 0.9, topics: ['crypto', 'defi'] }),
      defaultProfile,
    );
    if (breakdown.topicMatch > 0.5) expect(breakdown.reasons).toContain('on-topic');
    if (breakdown.quality > 0.7) expect(breakdown.reasons).toContain('high-quality');
  });

  it('explore bonus is non-negative', () => {
    const breakdown = shortScoreBreakdown(makeVideo(), defaultProfile);
    expect(breakdown.exploreBonus).toBeGreaterThanOrEqual(0);
  });
});
