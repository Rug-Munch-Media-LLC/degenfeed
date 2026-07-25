/**
 * Tests for Content Quality Scoring V3
 */

import { describe, it, expect } from 'vitest';
import {
  scoreQualityV3,
  detectEvergreen,
  computeLanguageQuality,
  computeEngagementVelocity,
  computeCreatorQuality,
} from './quality-v3';
import type { UnifiedPost } from '@degenfeed/types';

function makePost(overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  return {
    id: 'test:1',
    protocol: 'nostr',
    author: {
      id: 'author:1',
      displayName: 'Test',
      bio: '',
      avatarUrl: '',
      followerCount: 1000,
      followingCount: 200,
      verified: [],
      links: [],
      keys: {},
      handles: {},
      primary: { protocol: 'nostr', id: 'npub1' },
    },
    text: 'Bitcoin is a revolutionary technology that changes everything about money.',
    html: '',
    embeds: [],
    createdAt: Date.now() - 3600000,
    metrics: { likes: 50, reposts: 10, replies: 5, quotes: 2 },
    engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 50, reposts: 10, replies: 5, quotes: 0 } },
    raw: {},
    niches: ['bitcoin'],
    ...overrides,
  } as UnifiedPost;
}

describe('scoreQualityV3', () => {
  it('returns composite score and all signals', () => {
    const post = makePost();
    const result = scoreQualityV3(post);
    expect(result.composite).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeLessThanOrEqual(100);
    expect(result.engagementVelocity).toBeGreaterThanOrEqual(0);
    expect(result.creatorQuality).toBeGreaterThanOrEqual(0);
    expect(result.languageQuality).toBeGreaterThanOrEqual(0);
    expect(result.protocolMultiplier).toBeGreaterThanOrEqual(0);
    expect(result.reasons.length).toBeGreaterThanOrEqual(0);
  });

  it('scores verified creators higher', () => {
    const verified = makePost({
      author: {
        id: 'author:v',
        displayName: 'Verified',
        bio: '',
        avatarUrl: '',
        followerCount: 100000,
        followingCount: 100,
        verified: [{ protocol: 'nostr' as any, badge: 'checkmark' }],
        links: [],
        keys: {},
        handles: {},
        primary: { protocol: 'nostr', id: 'npubv' },
      },
    });
    const unverified = makePost({
      author: {
        id: 'author:u',
        displayName: 'Unverified',
        bio: '',
        avatarUrl: '',
        followerCount: 10,
        followingCount: 100,
        verified: [],
        links: [],
        keys: {},
        handles: {},
        primary: { protocol: 'nostr', id: 'npubu' },
      },
    });

    const vr = scoreQualityV3(verified);
    const ur = scoreQualityV3(unverified);
    expect(vr.creatorQuality).toBeGreaterThan(ur.creatorQuality);
  });

  it('penalizes poor language quality', () => {
    const spamPost = makePost({
      text: 'FREE BTC!!! CLICK HERE!!! win win win win win win win win win http://scam.com',
    });
    const qualityPost = makePost({
      text: 'The Bitcoin halving event reduces block rewards by 50%, creating supply-side pressure that historically leads to significant price appreciation over the following 12-18 months. This mechanism is fundamental to Bitcoin\'s monetary policy.',
    });

    const spam = scoreQualityV3(spamPost);
    const quality = scoreQualityV3(qualityPost);
    expect(spam.languageQuality).toBeLessThan(quality.languageQuality);
  });
});

describe('detectEvergreen', () => {
  it('detects tutorial content as evergreen', () => {
    const post = makePost({
      text: 'A complete guide to understanding zero-knowledge proofs and how they work under the hood.',
    });
    const score = detectEvergreen(post);
    expect(score).toBeGreaterThan(0.3);
  });

  it('detects time-sensitive content as not evergreen', () => {
    const post = makePost({
      text: 'BREAKING: Bitcoin just hit a new all-time high of $100k! This is huge!',
    });
    const score = detectEvergreen(post);
    expect(score).toBeLessThan(0.5);
  });
});

describe('computeLanguageQuality', () => {
  it('scores well-written content higher', () => {
    const good = 'The Federal Reserve\'s decision to maintain interest rates has significant implications for cryptocurrency markets.';
    const bad = 'FREE BTC!!! CLICK!!! $$$ http://scam.link';
    expect(computeLanguageQuality(makePost({ text: good }))).toBeGreaterThan(
      computeLanguageQuality(makePost({ text: bad })),
    );
  });
});

describe('computeCreatorQuality', () => {
  it('gives higher scores to established creators', () => {
    const established = makePost({
      author: {
        id: 'author:big',
        displayName: 'Big Creator',
        bio: '',
        avatarUrl: '',
        followerCount: 500000,
        followingCount: 100,
        verified: [{ protocol: 'nostr' as any, badge: 'checkmark' }],
        links: [],
        keys: {},
        handles: {},
        primary: { protocol: 'nostr', id: 'npubbig' },
      },
    });
    const newcomer = makePost({
      author: {
        id: 'author:new',
        displayName: 'New User',
        bio: '',
        avatarUrl: '',
        followerCount: 5,
        followingCount: 100,
        verified: [],
        links: [],
        keys: {},
        handles: {},
        primary: { protocol: 'nostr', id: 'npubnew' },
      },
    });

    const establishedResult = computeCreatorQuality(established);
    const newcomerResult = computeCreatorQuality(newcomer);
    expect(establishedResult.score).toBeGreaterThan(newcomerResult.score);
  });
});
