/**
 * @degenfeed/feed-core — Niche detection and community quality tests
 */

import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_DESCRIPTIONS,
  LEMMY_COMMUNITY_NICHES,
  RESERVED_COMMUNITY_NAMES,
  scoreCommunityQuality,
  subscriberTier,
} from './niches';

describe('LEMMY_COMMUNITY_NICHES', () => {
  it('should map crypto community to relevant niches', () => {
    const niches = LEMMY_COMMUNITY_NICHES.crypto;
    expect(niches).toContain('crypto');
    expect(niches).toContain('bitcoin');
    expect(niches).toContain('ethereum');
  });

  it('should map ai community to modern AI keywords', () => {
    const niches = LEMMY_COMMUNITY_NICHES.ai;
    expect(niches).toContain('ai');
    expect(niches).toContain('llm');
    expect(niches).toContain('deep-learning');
  });

  it('should have all reserved community names covered', () => {
    for (const name of RESERVED_COMMUNITY_NAMES) {
      expect(LEMMY_COMMUNITY_NICHES[name]).toBeDefined();
    }
  });
});

describe('COMMUNITY_DESCRIPTIONS', () => {
  it('should have descriptions for all reserved communities', () => {
    for (const name of RESERVED_COMMUNITY_NAMES) {
      const desc = COMMUNITY_DESCRIPTIONS[name];
      expect(desc).toBeDefined();
      expect(desc!.title).toBeTruthy();
      expect(desc!.description).toBeTruthy();
      expect(desc!.emoji).toBeTruthy();
    }
  });

  it('should have unique emoji for each community', () => {
    const emojis = RESERVED_COMMUNITY_NAMES.map((n) => COMMUNITY_DESCRIPTIONS[n]?.emoji ?? '');
    const unique = new Set(emojis);
    expect(unique.size).toBe(emojis.length);
  });
});

describe('scoreCommunityQuality', () => {
  it('should return "vibrant" for highly active communities', () => {
    const result = scoreCommunityQuality({
      subscribers: 100000,
      postsPerDay: 80,
      commentsPerPost: 30,
      ageDays: 500,
    });
    expect(result.tier).toBe('vibrant');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('should return "high" for moderately active communities', () => {
    const result = scoreCommunityQuality({
      subscribers: 5000,
      postsPerDay: 20,
      commentsPerPost: 10,
      ageDays: 200,
    });
    expect(result.tier).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(75);
  });

  it('should return "medium" for low activity communities', () => {
    const result = scoreCommunityQuality({
      subscribers: 100,
      postsPerDay: 2,
      commentsPerPost: 1,
      ageDays: 30,
    });
    expect(result.tier).toBe('medium');
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.score).toBeLessThan(50);
  });

  it('should return "low" for inactive communities', () => {
    const result = scoreCommunityQuality({
      subscribers: 0,
      postsPerDay: 0,
      commentsPerPost: 0,
      ageDays: 0,
    });
    expect(result.tier).toBe('low');
    expect(result.score).toBeLessThan(25);
  });

  it('should return detailed breakdown with per-factor scores', () => {
    const result = scoreCommunityQuality({
      subscribers: 10000,
      postsPerDay: 50,
      commentsPerPost: 25,
      ageDays: 365,
    });
    expect(result.details).toBeDefined();
    expect(result.details.subscribersScore).toBeGreaterThan(0);
    expect(result.details.postsPerDayScore).toBeGreaterThan(0);
    expect(result.details.commentsPerPostScore).toBeGreaterThan(0);
    expect(result.details.ageScore).toBeGreaterThan(0);
  });

  it('should cap subscribers to 1M reference', () => {
    const result = scoreCommunityQuality({
      subscribers: 10_000_000,
      postsPerDay: 100,
      commentsPerPost: 50,
      ageDays: 1000,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('subscriberTier', () => {
  it('should return "vibrant" for 10k+ subscribers', () => {
    expect(subscriberTier(10000)).toBe('vibrant');
    expect(subscriberTier(50000)).toBe('vibrant');
  });

  it('should return "high" for 100-9999 subscribers', () => {
    expect(subscriberTier(100)).toBe('high');
    expect(subscriberTier(5000)).toBe('high');
    expect(subscriberTier(9999)).toBe('high');
  });

  it('should return "medium" for 1-99 subscribers', () => {
    expect(subscriberTier(1)).toBe('medium');
    expect(subscriberTier(50)).toBe('medium');
    expect(subscriberTier(99)).toBe('medium');
  });

  it('should return "low" for 0 subscribers', () => {
    expect(subscriberTier(0)).toBe('low');
  });
});
