/**
 * @degenfeed/feed-core — Quality Scoring v2 tests
 *
 * Covers computeQualityScore, computeEngagementDensity,
 * computeAuthorQuality, computeUniqueness, estimateViews,
 * hasMedia, and buildQualityAuthorProfile.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import { buildUnifiedPost, emptyIdentity } from './index';
import {
  buildQualityAuthorProfile,
  computeAuthorQuality,
  computeEngagementDensity,
  computeQualityScore,
  computeUniqueness,
  estimateViews,
  hasMedia,
  type QualityContext,
} from './quality';

function makePost(
  text: string,
  overrides: Partial<UnifiedPost> = {},
): UnifiedPost {
  return buildUnifiedPost({
    protocol: 'nostr',
    nativeId: `quality-test-${Math.random().toString(36).slice(2)}`,
    author: emptyIdentity(),
    text,
    createdAt: Date.now(),
    raw: {},
    ...overrides,
  });
}

describe('estimateViews', () => {
  it('should return explicit views when available', () => {
    const post = makePost('Hello', {
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 5000 },
    });
    expect(estimateViews(post)).toBe(5000);
  });

  it('should estimate views from follower count and protocol factor', () => {
    const author = emptyIdentity();
    author.followerCount = 1000;
    const post = makePost('Hello', { author });
    // nostr factor = 1.5, so 1000 * 1.5 = 1500
    expect(estimateViews(post)).toBe(1500);
  });

  it('should return at least 1 view', () => {
    const post = makePost('Hello');
    expect(estimateViews(post)).toBeGreaterThanOrEqual(1);
  });
});

describe('computeEngagementDensity', () => {
  it('should return 0 when there is no engagement', () => {
    const post = makePost('Hello');
    expect(computeEngagementDensity(post)).toBe(0);
  });

  it('should return higher scores for higher engagement', () => {
    const author = emptyIdentity();
    author.followerCount = 100;
    const post = makePost('Hello', {
      author,
      metrics: { likes: 50, reposts: 20, replies: 10, quotes: 0 },
    });
    const density = computeEngagementDensity(post);
    expect(density).toBeGreaterThan(0);
    expect(density).toBeLessThanOrEqual(10);
  });

  it('should return maximum score for viral content', () => {
    const author = emptyIdentity();
    author.followerCount = 10;
    const post = makePost('Hello', {
      author,
      metrics: { likes: 1000, reposts: 500, replies: 200, quotes: 0 },
    });
    const density = computeEngagementDensity(post);
    expect(density).toBe(10);
  });
});

describe('computeAuthorQuality', () => {
  it('should give newcomer a baseline score', () => {
    const score = computeAuthorQuality({
      accountAge: 0,
      followers: 0,
      following: 0,
      verified: false,
      tipsSent: 0,
      reputationLevel: 'newcomer',
    });
    expect(score).toBe(0);
  });

  it('should give points for old accounts', () => {
    const score = computeAuthorQuality({
      accountAge: 400, // > 365 days
      followers: 0,
      following: 1,
      verified: false,
      tipsSent: 0,
      reputationLevel: 'newcomer',
    });
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it('should give points for good follower ratio', () => {
    const score = computeAuthorQuality({
      accountAge: 0,
      followers: 100,
      following: 5,
      verified: false,
      tipsSent: 0,
      reputationLevel: 'newcomer',
    });
    expect(score).toBeGreaterThanOrEqual(3); // ratio > 10 = 3 points
  });

  it('should give points for verification', () => {
    const score = computeAuthorQuality({
      accountAge: 0,
      followers: 0,
      following: 1,
      verified: true,
      tipsSent: 0,
      reputationLevel: 'newcomer',
    });
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('should give points for high reputation level', () => {
    const score = computeAuthorQuality({
      accountAge: 0,
      followers: 0,
      following: 1,
      verified: false,
      tipsSent: 0,
      reputationLevel: 'elder',
    });
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it('should max out near 12 for established influencers', () => {
    const score = computeAuthorQuality({
      accountAge: 500,
      followers: 10000,
      following: 100,
      verified: true,
      tipsSent: 20,
      reputationLevel: 'elder',
    });
    expect(score).toBeGreaterThanOrEqual(10);
  });
});

describe('computeUniqueness', () => {
  it('should return 5 for very short content (benefit of doubt)', () => {
    const post = makePost('Hi');
    expect(computeUniqueness(post, [])).toBe(5);
  });

  it('should return high uniqueness for unique content', () => {
    const post = makePost('This is a completely unique post about quantum computing');
    expect(computeUniqueness(post, [])).toBe(10);
  });

  it('should deduct points for near-duplicate content', () => {
    const post = makePost(
      'Bitcoin is the future of decentralized finance and will change everything about money forever',
    );
    const similar = makePost(
      'Bitcoin is the future of decentralized finance and will change everything about money forever',
    );
    const uniqueness = computeUniqueness(post, [similar]);
    expect(uniqueness).toBeLessThan(10);
  });
});

describe('hasMedia', () => {
  it('should return false for text-only posts', () => {
    const post = makePost('Hello');
    expect(hasMedia(post)).toBe(false);
  });

  it('should return true for posts with images', () => {
    const post = makePost('Hello', {
      embeds: [{ kind: 'image', url: 'https://example.com/img.jpg' }],
    });
    expect(hasMedia(post)).toBe(true);
  });

  it('should return true for posts with videos', () => {
    const post = makePost('Hello', {
      embeds: [{ kind: 'video', url: 'https://example.com/vid.mp4' }],
    });
    expect(hasMedia(post)).toBe(true);
  });

  it('should return false for link-only embeds', () => {
    const post = makePost('Hello', {
      embeds: [{ kind: 'link', url: 'https://example.com' }],
    });
    expect(hasMedia(post)).toBe(false);
  });
});

describe('buildQualityAuthorProfile', () => {
  it('should map UnifiedIdentity to AuthorProfile', () => {
    const identity = emptyIdentity();
    identity.followerCount = 500;
    identity.followingCount = 100;
    const profile = buildQualityAuthorProfile(identity);
    expect(profile.followers).toBe(500);
    expect(profile.following).toBe(100);
    expect(profile.verified).toBe(false);
    expect(profile.reputationLevel).toBe('newcomer');
    expect(profile.accountAge).toBe(0);
  });

  it('should set verified true when identity has badges', () => {
    const identity = emptyIdentity();
    identity.verified = [{ protocol: 'nostr', badge: 'nip05' }];
    const profile = buildQualityAuthorProfile(identity);
    expect(profile.verified).toBe(true);
  });
});

describe('computeQualityScore', () => {
  it('should return a score between 0 and 100', () => {
    const post = makePost('A thoughtful analysis of Bitcoin halving cycles and market impact');
    const context: QualityContext = {
      author: {
        accountAge: 365,
        followers: 5000,
        following: 200,
        verified: true,
        tipsSent: 50,
        reputationLevel: 'builder',
      },
    };
    const score = computeQualityScore(post, context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return higher scores for quality content with good author', () => {
    const goodPost = makePost(
      'A detailed technical analysis of Ethereum L2 scaling solutions ' +
        'comparing Arbitrum, Optimism, zkSync, and StarkNet with real data',
    );
    const goodContext: QualityContext = {
      author: {
        accountAge: 730,
        followers: 10000,
        following: 100,
        verified: true,
        tipsSent: 200,
        reputationLevel: 'elder',
      },
    };
    const goodScore = computeQualityScore(goodPost, goodContext);

    const badPost = makePost('hello');
    const badContext: QualityContext = {
      author: {
        accountAge: 0,
        followers: 0,
        following: 0,
        verified: false,
        tipsSent: 0,
        reputationLevel: 'newcomer',
      },
    };
    const badScore = computeQualityScore(badPost, badContext);

    expect(goodScore).toBeGreaterThan(badScore);
  });

  it('should handle uniqueness override', () => {
    const post = makePost('Some content');
    const context: QualityContext = {
      author: {
        accountAge: 0,
        followers: 0,
        following: 0,
        verified: false,
        tipsSent: 0,
        reputationLevel: 'newcomer',
      },
      uniqueness: 10,
    };
    const score = computeQualityScore(post, context);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
