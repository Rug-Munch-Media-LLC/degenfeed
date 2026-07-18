/**
 * @degenfeed/feed-core — User preference learning tests
 */

import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import { emptyBehaviorProfile, INTERACTION_WEIGHTS, learnFromInteraction } from './preferences';

function makePost(niches: string[], text = 'A test post about crypto'): UnifiedPost {
  return {
    id: 'nostr:test123',
    protocol: 'nostr',
    author: {
      id: 'nostr:author1',
      primary: { protocol: 'nostr', id: 'author1' },
      handles: {} as Record<string, string | null>,
      displayName: 'Author',
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [],
    createdAt: Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: null,
    niches,
  };
}

describe('emptyBehaviorProfile', () => {
  it('should return a profile with default values', () => {
    const profile = emptyBehaviorProfile();
    expect(profile.topics).toEqual({});
    expect(profile.protocols).toEqual({});
    expect(profile.creators).toEqual([]);
    expect(profile.engagementRate).toBe(0);
    expect(profile._totalViews).toBe(0);
  });
});

describe('INTERACTION_WEIGHTS', () => {
  it('should have view as the lowest weight', () => {
    expect(INTERACTION_WEIGHTS.view).toBe(0.1);
  });

  it('should have tip as a high weight', () => {
    expect(INTERACTION_WEIGHTS.tip).toBe(0.6);
  });

  it('should have dismiss as negative weight', () => {
    expect(INTERACTION_WEIGHTS.dismiss).toBe(-0.3);
  });
});

describe('learnFromInteraction', () => {
  it('should return a new profile reference (immutable)', () => {
    const profile = emptyBehaviorProfile();
    const post = makePost(['crypto']);
    const updated = learnFromInteraction(profile, post, 'view');
    expect(updated).not.toBe(profile);
    expect(profile._totalViews).toBe(0);
  });

  it('should increment _totalViews on view action', () => {
    const profile = emptyBehaviorProfile();
    const post = makePost(['crypto']);
    const updated = learnFromInteraction(profile, post, 'view');
    expect(updated._totalViews).toBe(1);
  });

  it('should update topic weights for post niches', () => {
    const profile = emptyBehaviorProfile();
    const post = makePost(['crypto', 'bitcoin']);
    const updated = learnFromInteraction(profile, post, 'like');
    expect(updated.topics.crypto).toBeDefined();
    expect(updated.topics.bitcoin).toBeDefined();
  });

  it('should track engaged creators', () => {
    const profile = emptyBehaviorProfile();
    const post = makePost(['crypto']);
    const updated = learnFromInteraction(profile, post, 'like');
    expect(updated.creators).toContain('nostr:author1');
  });

  it('should handle dismiss action with negative weight', () => {
    const profile = emptyBehaviorProfile();
    const post = makePost(['memecoin']);
    const updated = learnFromInteraction(profile, post, 'dismiss');
    expect(updated.topics.memecoin).toBeDefined();
    // Dismiss weight is -0.3, so topic should be negative
    expect(updated.topics.memecoin).toBeLessThan(0);
  });
});
