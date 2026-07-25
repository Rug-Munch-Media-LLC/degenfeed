/**
 * Tests for Feed Personalization V2
 */

import { describe, it, expect } from 'vitest';
import {
  emptyPersonalizationV2Profile,
  learnFromImplicitSignal,
  learnFromExplicitSignal,
  learnTemporalPreference,
  recordSessionView,
  scorePersonalizationV2,
  serializePersonalizationV2,
  deserializePersonalizationV2,
} from './personalization-v2';
import type { UnifiedPost } from '@degenfeed/types';

function makePost(overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  return {
    id: 'test:1',
    protocol: 'nostr',
    author: {
      id: 'author:1',
      displayName: 'Test User',
      bio: '',
      avatarUrl: '',
      followerCount: 100,
      followingCount: 50,
      verified: [],
      links: [],
      keys: {},
      handles: {},
      primary: { protocol: 'nostr', id: 'npub1' },
    },
    text: 'Interesting content about crypto.',
    html: '',
    embeds: [],
    createdAt: Date.now() - 3600000,
    metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 10, reposts: 2, replies: 1, quotes: 0 } },
    raw: {},
    niches: ['bitcoin', 'defi'],
    ...overrides,
  } as UnifiedPost;
}

describe('PersonalizationV2', () => {
  it('creates empty profile', () => {
    const profile = emptyPersonalizationV2Profile();
    expect(profile.creatorAffinities.size).toBe(0);
    expect(profile.nicheAffinities.size).toBe(0);
    expect(profile.temporalPreferences.length).toBe(24);
    expect(profile.sessionHistory.length).toBe(0);
  });

  it('learns from implicit signals', () => {
    let profile = emptyPersonalizationV2Profile();
    const post = makePost();
    profile = learnFromImplicitSignal(profile, post, 15000, 0.8, true, Date.now());
    expect(profile.creatorAffinities.size).toBe(1);
    expect(profile.nicheAffinities.size).toBeGreaterThanOrEqual(1);
    expect(profile.implicitSignals.size).toBeGreaterThanOrEqual(1);
  });

  it('learns from explicit show-more', () => {
    let profile = emptyPersonalizationV2Profile();
    const post = makePost();
    profile = learnFromExplicitSignal(profile, post, 'show-more', Date.now());
    const nicheKey = post.niches[0]!.toLowerCase();
    const signal = profile.explicitSignals.get(nicheKey);
    expect(signal).toBeDefined();
    expect(signal!.showMoreCount).toBe(1);
  });

  it('learns from explicit show-less', () => {
    let profile = emptyPersonalizationV2Profile();
    const post = makePost();
    profile = learnFromExplicitSignal(profile, post, 'show-less', Date.now());
    const nicheKey = post.niches[0]!.toLowerCase();
    const signal = profile.explicitSignals.get(nicheKey);
    expect(signal).toBeDefined();
    expect(signal!.showLessCount).toBe(1);
    expect(signal!.netScore).toBeLessThan(0);
  });

  it('learns temporal preferences', () => {
    let profile = emptyPersonalizationV2Profile();
    const post = makePost();
    profile = learnTemporalPreference(profile, post, 10000, Date.now());
    const hour = new Date().getHours();
    const slot = profile.temporalPreferences.find((t) => t.hour === hour);
    expect(slot).toBeDefined();
    expect(slot!.preferredNiches.length).toBeGreaterThanOrEqual(1);
    expect(slot!.engagementLevel).toBeGreaterThan(0);
  });

  it('tracks session views', () => {
    let profile = emptyPersonalizationV2Profile();
    const post = makePost();
    profile = recordSessionView(profile, post, 10000, Date.now());
    expect(profile.sessionHistory.length).toBe(1);
    expect(profile.sessionHistory[0].postIds).toContain('test:1');
  });

  it('computes personalization multiplier', () => {
    let profile = emptyPersonalizationV2Profile();
    const post = makePost();

    // Build up some affinity
    profile = learnFromImplicitSignal(profile, post, 20000, 0.9, true, Date.now());
    profile = learnFromExplicitSignal(profile, post, 'show-more', Date.now());
    profile = recordSessionView(profile, post, 20000, Date.now());

    const result = scorePersonalizationV2(profile, post, Date.now());
    expect(result.multiplier).toBeGreaterThanOrEqual(0.3);
    expect(result.multiplier).toBeLessThanOrEqual(3.0);
    expect(result.reasons.length).toBeGreaterThanOrEqual(0);
  });

  it('serializes and deserializes', () => {
    let profile = emptyPersonalizationV2Profile();
    profile = learnFromImplicitSignal(profile, makePost({ niches: ['ai'] }), 10000, 0.5, true, Date.now());

    const serialized = serializePersonalizationV2(profile);
    const deserialized = deserializePersonalizationV2(serialized);

    expect(deserialized.creatorAffinities.size).toBe(profile.creatorAffinities.size);
    expect(deserialized.nicheAffinities.size).toBe(profile.nicheAffinities.size);
    expect(deserialized.temporalPreferences.length).toBe(24);
  });
});
