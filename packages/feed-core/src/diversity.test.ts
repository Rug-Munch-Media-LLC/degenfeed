/**
 * Tests for Diversity Algorithm
 */

import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIVERSITY_CONFIG,
  diversifyFeed,
  interleaveProtocols,
  isSerendipitous,
} from './diversity';

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
    text: 'Some interesting content about crypto.',
    html: '',
    embeds: [],
    createdAt: Date.now() - 3600000,
    metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    },
    raw: {},
    niches: ['bitcoin'],
    ...overrides,
  } as UnifiedPost;
}

describe('diversifyFeed', () => {
  it('interleaves categories', () => {
    const items = [
      { post: makePost('1', { niches: ['defi'] }), score: 10, category: 'defi' },
      { post: makePost('2', { niches: ['defi'] }), score: 9, category: 'defi' },
      { post: makePost('3', { niches: ['defi'] }), score: 8, category: 'defi' },
      { post: makePost('4', { niches: ['ai'] }), score: 7, category: 'ai' },
      { post: makePost('5', { niches: ['ai'] }), score: 6, category: 'ai' },
    ];

    const result = diversifyFeed(items, { ...DEFAULT_DIVERSITY_CONFIG, maxConsecutiveCategory: 2 });
    const categories = result.items.map((i) => i.category);
    // Should not have more than 2 consecutive same categories
    for (let i = 0; i < categories.length - 2; i++) {
      expect(categories[i] === categories[i + 1] ? categories[i] !== categories[i + 2] : true).toBe(
        true,
      );
    }
  });

  it('rotates creators', () => {
    const items = [
      { post: makePost('1', { author: { ...makePost('1').author, id: 'creator:a' } }), score: 10 },
      { post: makePost('2', { author: { ...makePost('2').author, id: 'creator:a' } }), score: 9 },
      { post: makePost('3', { author: { ...makePost('3').author, id: 'creator:a' } }), score: 8 },
      { post: makePost('4', { author: { ...makePost('4').author, id: 'creator:b' } }), score: 7 },
    ];

    const result = diversifyFeed(items, { ...DEFAULT_DIVERSITY_CONFIG, maxConsecutiveCreator: 2 });
    const creatorIds = result.items.map((i) => i.post.author.id);
    // No more than 2 consecutive same creator
    for (let i = 0; i < creatorIds.length - 2; i++) {
      expect(creatorIds[i] === creatorIds[i + 1] ? creatorIds[i] !== creatorIds[i + 2] : true).toBe(
        true,
      );
    }
  });

  it('respects total category limits', () => {
    const items = [];
    for (let i = 0; i < 15; i++) {
      items.push({
        post: makePost(`defi-${i}`, { niches: ['defi'] }),
        score: 10 - i * 0.5,
        category: 'defi',
      });
    }

    const result = diversifyFeed(items, { ...DEFAULT_DIVERSITY_CONFIG, maxTotalCategory: 8 });
    const defiCount = result.items.filter((i) => i.category === 'defi').length;
    expect(defiCount).toBeLessThanOrEqual(8);
  });

  it('handles protocol rotation', () => {
    const items = [
      { post: makePost('1', { protocol: 'nostr' }), score: 10 },
      { post: makePost('2', { protocol: 'nostr' }), score: 9 },
      { post: makePost('3', { protocol: 'nostr' }), score: 8 },
      { post: makePost('4', { protocol: 'farcaster' }), score: 7 },
      { post: makePost('5', { protocol: 'bluesky' }), score: 6 },
    ];

    const result = diversifyFeed(items, {
      ...DEFAULT_DIVERSITY_CONFIG,
      maxConsecutiveProtocol: 2,
      interleaveProtocols: true,
    });
    const protocols = result.items.map((i) => i.post.protocol);
    for (let i = 0; i < protocols.length - 2; i++) {
      expect(protocols[i] === protocols[i + 1] ? protocols[i] !== protocols[i + 2] : true).toBe(
        true,
      );
    }
  });
});

describe('interleaveProtocols', () => {
  it('round-robins protocols', () => {
    const items = [
      { post: makePost('1', { protocol: 'nostr' }), score: 10 },
      { post: makePost('2', { protocol: 'nostr' }), score: 9 },
      { post: makePost('3', { protocol: 'farcaster' }), score: 8 },
      { post: makePost('4', { protocol: 'bluesky' }), score: 7 },
    ];

    const interleaved = interleaveProtocols(items, 1);
    const protocols = interleaved.map((i) => i.post.protocol);
    // After interleaving with max 1, no two same protocols adjacent
    for (let i = 0; i < protocols.length - 1; i++) {
      expect(protocols[i]).not.toBe(protocols[i + 1]);
    }
  });
});

describe('isSerendipitous', () => {
  it('identifies novel content', () => {
    const post = makePost('novel', {
      niches: ['quantum-computing'],
      text: 'Interesting new post about quantum computing.',
      metrics: { likes: 5, reposts: 1, replies: 0, quotes: 0 },
    });
    const seenNiches = new Set(['bitcoin', 'defi']);
    const seenCreators = new Set(['author:known']);
    const seenProtocols = new Set(['nostr']);

    // Post from new niche and new creator
    const result = isSerendipitous(post, seenNiches, seenCreators, seenProtocols);
    expect(result).toBe(true);
  });

  it('rejects content the user has already seen', () => {
    const post = makePost('seen', {
      author: { ...makePost('seen').author, id: 'author:known' },
    });
    const seenNiches = new Set(['bitcoin']);
    const seenCreators = new Set(['author:known']);
    const seenProtocols = new Set(['nostr']);

    const result = isSerendipitous(post, seenNiches, seenCreators, seenProtocols);
    expect(result).toBe(false);
  });
});
