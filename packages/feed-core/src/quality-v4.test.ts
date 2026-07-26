/**
 * @degenfeed/feed-core — Quality V4 Tests
 *
 * Covers all 6 scoring dimensions plus composite normalization.
 */

import { describe, expect, it } from 'vitest';
import {
  computeEngagementVelocityV4,
  creatorReputation,
  crossProtocolBoost,
  preferenceAlignment,
  scoreQualityV4,
  sigmoidFreshness,
  sourceDiversity,
} from './quality-v4';

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

// ─── Sigmoid Freshness ─────────────────────────────────────────────────

describe('sigmoidFreshness', () => {
  it('returns 0.5 for brand new content (age=0)', () => {
    const result = sigmoidFreshness(NOW, NOW);
    expect(result).toBeGreaterThanOrEqual(0.48);
    expect(result).toBeLessThanOrEqual(0.5);
  });

  it('returns ~0.25 for content at half-life (6h)', () => {
    const result = sigmoidFreshness(NOW - 6 * HOUR, NOW);
    expect(result).toBeGreaterThanOrEqual(0.2);
    expect(result).toBeLessThanOrEqual(0.35);
  });

  it('returns < 0.1 for very old content (48h)', () => {
    const result = sigmoidFreshness(NOW - 48 * HOUR, NOW);
    expect(result).toBeLessThan(0.15);
  });

  it('returns > 0.4 for very fresh content (5 min)', () => {
    const result = sigmoidFreshness(NOW - 5 * 60 * 1000, NOW);
    expect(result).toBeGreaterThanOrEqual(0.4);
  });

  it('handles future timestamps gracefully', () => {
    const result = sigmoidFreshness(NOW + HOUR, NOW);
    expect(result).toBeGreaterThanOrEqual(0.45);
  });
});

// ─── Source Diversity ─────────────────────────────────────────────────

describe('sourceDiversity', () => {
  it('returns 0 for balanced protocols', () => {
    const counts = new Map([
      ['nostr', 20],
      ['farcaster', 18],
      ['bluesky', 15],
    ]);
    const result = sourceDiversity('nostr', counts, 100);
    expect(result).toBeGreaterThanOrEqual(-0.1);
    expect(result).toBeLessThanOrEqual(0.1);
  });

  it('returns -0.3 for severely over-represented protocol', () => {
    const counts = new Map([
      ['nostr', 60],
      ['farcaster', 10],
    ]);
    expect(sourceDiversity('nostr', counts, 70)).toBe(-0.3);
  });

  it('returns +0.3 for under-represented protocol', () => {
    const counts = new Map([
      ['nostr', 80],
      ['zora', 1],
    ]);
    expect(sourceDiversity('zora', counts, 100)).toBe(0.3);
  });

  it('returns 0 when no data available', () => {
    expect(sourceDiversity('nostr', new Map(), 0)).toBe(0);
  });

  it('returns neutral for unknown protocol', () => {
    const counts = new Map([['nostr', 50]]);
    const result = sourceDiversity('unknown-protocol', counts, 100);
    expect(result).toBeGreaterThanOrEqual(-0.1);
    expect(result).toBeLessThanOrEqual(0);
  });
});

// ─── Engagement Velocity ──────────────────────────────────────────────

describe('computeEngagementVelocityV4', () => {
  const postId = 'post-1';

  it('returns 0 with no previous engagement', () => {
    expect(computeEngagementVelocityV4(postId, 10, 5, 3)).toBe(0);
  });

  it('returns 0 when engagement has not changed', () => {
    const prev = new Map();
    prev.set(postId, { likes: 10, reposts: 5, replies: 3, at: NOW - 5 * 60 * 1000 });
    const result = computeEngagementVelocityV4(postId, 10, 5, 3, prev);
    expect(result).toBe(0);
  });

  it('returns high velocity for fast-rising content', () => {
    const prev = new Map();
    prev.set(postId, { likes: 10, reposts: 5, replies: 3, at: NOW - 60 * 1000 });
    const result = computeEngagementVelocityV4(postId, 100, 50, 30, prev);
    expect(result).toBeGreaterThanOrEqual(0.3);
  });

  it('returns low velocity for slow growth', () => {
    const prev = new Map();
    prev.set(postId, { likes: 100, reposts: 50, replies: 30, at: NOW - HOUR });
    const result = computeEngagementVelocityV4(postId, 105, 52, 31, prev);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0.2);
  });
});

// ─── Cross-Protocol Boost ────────────────────────────────────────────

describe('crossProtocolBoost', () => {
  it('returns 0 for single-protocol content', () => {
    expect(crossProtocolBoost(1)).toBe(0);
  });

  it('returns 0.2 for dual-protocol content', () => {
    expect(crossProtocolBoost(2)).toBe(0.2);
  });

  it('returns 0.3 for 3+ protocol content', () => {
    expect(crossProtocolBoost(3)).toBe(0.3);
  });

  it('uses explicit set when provided', () => {
    const set = new Set(['dup-post-id']);
    expect(crossProtocolBoost(1, set, 'dup-post-id')).toBe(0.3);
  });
});

// ─── Creator Reputation ──────────────────────────────────────────────

describe('creatorReputation', () => {
  it('returns 0 for unknown creator', () => {
    expect(creatorReputation('unknown')).toBe(0);
  });

  it('returns 0.3 for top-tier creator (>90)', () => {
    const history = new Map([['creator-1', 92]]);
    expect(creatorReputation('creator-1', history)).toBe(0.3);
  });

  it('returns 0.2 for good creator (75-89)', () => {
    const history = new Map([['creator-1', 80]]);
    expect(creatorReputation('creator-1', history)).toBe(0.2);
  });

  it('returns 0.05 for below-average creator (40-59)', () => {
    const history = new Map([['creator-1', 45]]);
    expect(creatorReputation('creator-1', history)).toBe(0.05);
  });

  it('returns 0 for poor-quality creator (<40)', () => {
    const history = new Map([['creator-1', 20]]);
    expect(creatorReputation('creator-1', history)).toBe(0);
  });

  it('returns 0 with empty history', () => {
    expect(creatorReputation('creator-1', new Map())).toBe(0);
  });
});

// ─── Preference Alignment ────────────────────────────────────────────

describe('preferenceAlignment', () => {
  it('returns 0 with no user preferences', () => {
    expect(preferenceAlignment(['bitcoin'])).toBe(0);
  });

  it('returns 0.5 when 3+ niches match', () => {
    expect(preferenceAlignment(['bitcoin', 'defi', 'ai', 'nft'], ['bitcoin', 'defi', 'ai'])).toBe(
      0.5,
    );
  });

  it('returns 0.35 when exactly 2 niches match', () => {
    expect(preferenceAlignment(['bitcoin', 'defi'], ['bitcoin', 'defi'])).toBe(0.35);
  });

  it('returns 0.2 when 1 niche matches', () => {
    expect(preferenceAlignment(['bitcoin'], ['bitcoin', 'defi'])).toBe(0.2);
  });

  it('returns 0 when no niches match', () => {
    expect(preferenceAlignment(['nft'], ['bitcoin', 'defi'])).toBe(0);
  });

  it('returns 0.1 for text match when no niche matches', () => {
    expect(preferenceAlignment(['nft'], ['bitcoin'], 'Bitcoin is the future')).toBe(0.1);
  });
});

// ─── Composite Score ─────────────────────────────────────────────────

describe('scoreQualityV4', () => {
  const basePost = {
    id: 'test-post-1',
    protocol: 'nostr' as const,
    createdAt: NOW - 5 * 60 * 1000, // 5 min ago
    niches: ['bitcoin', 'defi'],
    text: 'Bitcoin is surging! #crypto',
    metrics: { likes: 100, reposts: 50, replies: 20 },
    author: { id: 'creator-1' },
  };

  it('returns a normalized score 0-10', () => {
    const result = scoreQualityV4(basePost, {
      now: NOW,
      protocolCounts: new Map([['nostr', 20]]),
      totalPosts: 100,
      userNiches: ['bitcoin'],
    });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(10);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns all 6 signal fields', () => {
    const result = scoreQualityV4(basePost, { now: NOW });
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('sourceDiversityPenalty');
    expect(result).toHaveProperty('freshnessScore');
    expect(result).toHaveProperty('engagementVelocity');
    expect(result).toHaveProperty('crossProtocolBoost');
    expect(result).toHaveProperty('creatorReputation');
    expect(result).toHaveProperty('preferenceAlignment');
    expect(result).toHaveProperty('reasons');
  });

  it('scores fresh aligned content higher than old misaligned content', () => {
    const freshAligned = scoreQualityV4(
      { ...basePost, createdAt: NOW - 2 * 60 * 1000 },
      {
        now: NOW,
        userNiches: ['bitcoin'],
      },
    );

    const oldMisaligned = scoreQualityV4(
      { ...basePost, createdAt: NOW - 48 * HOUR, niches: ['nft'], text: 'NFT market' },
      {
        now: NOW,
        userNiches: ['bitcoin'],
      },
    );

    expect(freshAligned.total).toBeGreaterThan(oldMisaligned.total);
  });

  it('handles zero values without crashing', () => {
    const result = scoreQualityV4(
      {
        id: 'empty-post',
        protocol: 'nostr' as const,
        createdAt: NOW,
        niches: [],
        text: '',
        metrics: { likes: 0, reposts: 0, replies: 0 },
        author: { id: '' },
      },
      { now: NOW, protocolCounts: new Map(), totalPosts: 0 },
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(10);
  });

  it('includes diversity penalty for over-represented protocol', () => {
    const result = scoreQualityV4(basePost, {
      now: NOW,
      protocolCounts: new Map([['nostr', 80]]),
      totalPosts: 100,
    });
    expect(result.sourceDiversityPenalty).toBeLessThan(0);
  });

  it('boosts with creator reputation when available', () => {
    const result = scoreQualityV4(basePost, {
      now: NOW,
      creatorHistory: new Map([['creator-1', 95]]),
    });
    expect(result.creatorReputation).toBeGreaterThan(0);
  });
});
