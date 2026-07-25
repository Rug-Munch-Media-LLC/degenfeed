/**
 * Tests for Content Categorization V3
 */

import { describe, it, expect } from 'vitest';
import { classifyPost, computeTrendingCategories, CategorizationFeedbackStore } from './categorization-v3';
import type { UnifiedPost } from '@degenfeed/types';

function makePost(overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  return {
    id: 'test:1',
    protocol: 'nostr',
    author: {
      id: 'author:1',
      primary: { protocol: 'nostr', id: 'npub1' },
      handles: {},
      displayName: 'Test User',
      bio: 'DeFi enthusiast and developer',
      avatarUrl: '',
      followerCount: 100,
      followingCount: 50,
      links: [],
      keys: {},
    },
    text: overrides.text ?? 'Bitcoin is going to $100k this cycle! #btc',
    html: '',
    embeds: [],
    parentId: undefined,
    rootId: undefined,
    createdAt: Date.now() - 3600000,
    metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 10, reposts: 2, replies: 1, quotes: 0 } },
    raw: {},
    niches: ['bitcoin'],
    ...overrides,
  } as UnifiedPost;
}

describe('classifyPost', () => {
  it('returns primary category with confidence', () => {
    const post = makePost({
      text: 'Bitcoin is the best store of value. The halving is coming.',
      niches: ['bitcoin', 'macro'],
    });
    const result = classifyPost(post);
    expect(result.primary).toBe('bitcoin');
    expect(result.categories.length).toBeGreaterThanOrEqual(1);
    expect(result.categories[0].confidence).toBeGreaterThan(0);
  });

  it('returns up to 3 categories', () => {
    const post = makePost({
      text: 'Ethereum L2s are scaling DeFi with zk-rollups. Arbitrum and Optimism are leading.',
      niches: ['ethereum', 'layer2', 'defi'],
    });
    const result = classifyPost(post);
    expect(result.categories.length).toBeLessThanOrEqual(3);
    expect(result.primary).toBeDefined();
  });

  it('handles memecoin posts', () => {
    const post = makePost({
      text: 'Pepe to the moon! Memecoin supercycle is here.',
      niches: ['memecoin'],
    });
    const result = classifyPost(post);
    expect(result.primary).toBe('memecoin');
  });

  it('handles AI/tech posts', () => {
    const post = makePost({
      text: 'GPT-5 just dropped. The AI revolution is accelerating.',
      niches: ['ai', 'tech'],
      author: {
        id: 'author:2',
        primary: { protocol: 'nostr', id: 'npub2' },
        handles: {},
        displayName: 'AI Researcher',
        bio: 'Machine learning engineer at OpenAI',
        avatarUrl: '',
        followerCount: 1000,
        followingCount: 200,
        links: [],
        keys: {},
      },
    });
    const result = classifyPost(post);
    expect(result.primary).toBe('ai');
  });

  it('applies protocol-aware boosts', () => {
    // RSS posts get a news boost
    const post = makePost({
      protocol: 'rss',
      text: 'Federal Reserve announces interest rate decision',
      niches: ['macro'],
    });
    const result = classifyPost(post);
    expect(result.categories.some((c) => c.slug === 'news')).toBe(true);
  });

  it('includes signal information', () => {
    const post = makePost({
      text: 'Solana DeFi TVL reaches new all-time high',
      niches: ['solana', 'defi'],
    });
    const result = classifyPost(post);
    expect(result.categories[0].signals.length).toBeGreaterThan(0);
    expect(result.categories[0].signals.some((s) => s.startsWith('niche:'))).toBe(true);
  });

  it('falls back to general for uncategorized content', () => {
    const post = makePost({
      text: 'Hello world!',
      niches: [],
    });
    const result = classifyPost(post);
    expect(result.primaryCategory).toBeDefined();
    expect(result.categories.length).toBeGreaterThanOrEqual(1);
  });
});

describe('computeTrendingCategories', () => {
  it('returns sorted trending categories', () => {
    const classified = [
      { categories: [{ slug: 'bitcoin' as any, confidence: 0.9, signals: [] }] },
      { categories: [{ slug: 'bitcoin' as any, confidence: 0.8, signals: [] }] },
      { categories: [{ slug: 'defi' as any, confidence: 0.7, signals: [] }] },
      { categories: [{ slug: 'ai' as any, confidence: 0.6, signals: [] }] },
    ];
    const trends = computeTrendingCategories(classified as any);
    expect(trends.length).toBeGreaterThanOrEqual(3);
    expect(trends[0].slug).toBe('bitcoin');
    expect(trends[0].postCount).toBe(2);
  });
});

describe('CategorizationFeedbackStore', () => {
  it('stores and retrieves feedback', () => {
    const store = new CategorizationFeedbackStore();
    store.recordFeedback({
      postId: 'test:1',
      userId: 'user:1',
      categories: ['defi' as any],
      timestamp: Date.now(),
    });
    const correction = store.getCorrection('test:1');
    expect(correction).toBeDefined();
    expect(correction!.categories).toContain('defi');
  });
});
