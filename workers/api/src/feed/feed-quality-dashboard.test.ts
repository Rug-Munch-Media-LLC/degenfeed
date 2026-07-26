/**
 * Tests for Feed Quality Dashboard
 */

import { describe, it, expect } from 'vitest';
import { buildQualityDashboard } from './feed-quality-dashboard';
import type { UnifiedPost } from '@degenfeed/types';

function makePost(id: string, overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  return {
    id,
    protocol: 'nostr',
    author: {
      id: `author:${id}`,
      displayName: `User ${id}`,
      bio: '',
      avatarUrl: '',
      followerCount: 100,
      followingCount: 50,
      verified: [],
      links: [],
      keys: {},
      handles: {},
      primary: { protocol: 'nostr', id: `npub${id}` },
    },
    text: 'Interesting content about crypto and technology.',
    html: '',
    embeds: [],
    createdAt: Date.now() - 3600000,
    metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 10, reposts: 2, replies: 1, quotes: 0 } },
    raw: {},
    niches: ['bitcoin'],
    ...overrides,
  } as UnifiedPost;
}

describe('buildQualityDashboard', () => {
  it('returns empty dashboard for empty posts', () => {
    const metrics = buildQualityDashboard([], Date.now());
    expect(metrics.totalPosts).toBe(0);
    expect(metrics.avgQualityScore).toBe(0);
    expect(metrics.diversityIndex).toBe(0);
  });

  it('computes quality metrics for posts', () => {
    const posts = [
      makePost('1', { niches: ['defi'], protocol: 'nostr', text: 'DeFi is revolutionizing finance with automated market makers and liquidity pools.' }),
      makePost('2', { niches: ['ai'], protocol: 'farcaster', text: 'AI agents are becoming autonomous and capable of complex reasoning tasks.' }),
      makePost('3', { niches: ['bitcoin'], protocol: 'bluesky', text: 'Bitcoin is digital gold. The halving cycle creates predictable scarcity.' }),
    ];

    const metrics = buildQualityDashboard(posts, Date.now());
    expect(metrics.totalPosts).toBe(3);
    expect(metrics.uniqueCreators).toBe(3);
    expect(metrics.uniqueProtocols).toBe(3);
    expect(metrics.avgQualityScore).toBeGreaterThan(0);
    expect(metrics.avgQualityScore).toBeLessThanOrEqual(100);
  });

  it('tracks quality distribution', () => {
    const posts = [
      makePost('1', { niches: ['defi'], text: 'A'.repeat(500) }),
      makePost('2', { niches: ['memecoin'], text: 'MOON!! PUMP!!! FREE!!! http://spam.com' }),
      makePost('3', { niches: ['ai'], text: 'The transformer architecture revolutionized natural language processing through self-attention mechanisms that enable parallel computation.' }),
    ];

    const metrics = buildQualityDashboard(posts, Date.now());
    const total = metrics.qualityDistribution.excellent +
      metrics.qualityDistribution.good +
      metrics.qualityDistribution.fair +
      metrics.qualityDistribution.poor +
      metrics.qualityDistribution.bad;
    expect(total).toBe(posts.length);
  });

  it('computes category distribution', () => {
    const posts = [
      makePost('1', { niches: ['defi'] }),
      makePost('2', { niches: ['defi'] }),
      makePost('3', { niches: ['ai'] }),
    ];

    const metrics = buildQualityDashboard(posts, Date.now());
    expect(Object.keys(metrics.categoryDistribution).length).toBeGreaterThanOrEqual(2);
  });

  it('computes protocol share', () => {
    const posts = [
      makePost('1', { protocol: 'nostr' }),
      makePost('2', { protocol: 'farcaster' }),
      makePost('3', { protocol: 'bluesky' }),
    ];

    const metrics = buildQualityDashboard(posts, Date.now());
    expect(Object.keys(metrics.protocolShare).length).toBe(3);
    expect(metrics.uniqueProtocols).toBe(3);
  });

  it('computes diversity index', () => {
    const singleProtocol = [
      makePost('1', { protocol: 'nostr' }),
      makePost('2', { protocol: 'nostr' }),
    ];
    const multiProtocol = [
      makePost('1', { protocol: 'nostr' }),
      makePost('2', { protocol: 'farcaster' }),
    ];

    const single = buildQualityDashboard(singleProtocol, Date.now());
    const multi = buildQualityDashboard(multiProtocol, Date.now());

    // Multi-protocol should have higher diversity
    expect(multi.diversityIndex).toBeGreaterThanOrEqual(single.diversityIndex);
  });

  it('tracks freshness distribution', () => {
    const now = Date.now();
    const posts = [
      makePost('1', { createdAt: now - 600000 }), // 10 min ago
      makePost('2', { createdAt: now - 1800000 }), // 30 min ago
      makePost('3', { createdAt: now - 72000000 }), // 20 hours ago
    ];

    const metrics = buildQualityDashboard(posts, now);
    expect(metrics.freshnessDistribution.breaking + metrics.freshnessDistribution.recent +
      metrics.freshnessDistribution.today + metrics.freshnessDistribution.older).toBe(posts.length);
  });

  it('identifies viral and zero-engagement posts', () => {
    const posts = [
      makePost('viral', { metrics: { likes: 500, reposts: 200, replies: 50, quotes: 30 } }),
      makePost('dead', { metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 } }),
      makePost('normal', { metrics: { likes: 20, reposts: 5, replies: 2, quotes: 0 } }),
    ];

    const metrics = buildQualityDashboard(posts, Date.now());
    expect(metrics.viralPosts).toBeGreaterThanOrEqual(1);
    expect(metrics.zeroEngagementPosts).toBeGreaterThanOrEqual(1);
  });
});
