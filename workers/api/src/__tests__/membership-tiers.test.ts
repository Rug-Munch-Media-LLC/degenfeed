/**
 * @degenfeed/api-worker — Membership Tiers Tests
 */

import { describe, expect, it } from 'vitest';
import {
  checkFeatureAccess,
  FEATURE_GROUPS,
  FEATURES,
  getFeaturesForTier,
  getLockedFeatures,
  getMinimumTier,
  getNextTier,
  getTierName,
  getTierPrice,
  hasTierAccess,
  mapLegacyTier,
  TIER_INFO,
  TIER_LIMITS,
  TIER_RANK,
  type Tier,
} from '../lib/membership-tiers';

describe('membership-tiers', () => {
  describe('TIER_INFO', () => {
    it('should have correct tier structure', () => {
      expect(TIER_INFO.free.price).toBe(0);
      expect(TIER_INFO.pro.price).toBe(5);
      expect(TIER_INFO.creator.price).toBe(10);
      expect(TIER_INFO.enterprise.price).toBe(20);
    });

    it('should have annual pricing at discount', () => {
      expect(TIER_INFO.pro.annualPrice).toBeLessThan(TIER_INFO.pro.price);
      expect(TIER_INFO.creator.annualPrice).toBeLessThan(TIER_INFO.creator.price);
      expect(TIER_INFO.enterprise.annualPrice).toBeLessThan(TIER_INFO.enterprise.price);
    });
  });

  describe('TIER_RANK', () => {
    it('should have correct rank ordering', () => {
      expect(TIER_RANK.free).toBe(0);
      expect(TIER_RANK.pro).toBe(1);
      expect(TIER_RANK.creator).toBe(2);
      expect(TIER_RANK.enterprise).toBe(3);
    });
  });

  describe('hasTierAccess', () => {
    it('free should only access free features', () => {
      expect(hasTierAccess('free', 'free')).toBe(true);
      expect(hasTierAccess('free', 'pro')).toBe(false);
      expect(hasTierAccess('free', 'creator')).toBe(false);
      expect(hasTierAccess('free', 'enterprise')).toBe(false);
    });

    it('pro should access free and pro features', () => {
      expect(hasTierAccess('pro', 'free')).toBe(true);
      expect(hasTierAccess('pro', 'pro')).toBe(true);
      expect(hasTierAccess('pro', 'creator')).toBe(false);
      expect(hasTierAccess('pro', 'enterprise')).toBe(false);
    });

    it('creator should access free, pro, and creator', () => {
      expect(hasTierAccess('creator', 'free')).toBe(true);
      expect(hasTierAccess('creator', 'pro')).toBe(true);
      expect(hasTierAccess('creator', 'creator')).toBe(true);
      expect(hasTierAccess('creator', 'enterprise')).toBe(false);
    });

    it('enterprise should access everything', () => {
      expect(hasTierAccess('enterprise', 'free')).toBe(true);
      expect(hasTierAccess('enterprise', 'pro')).toBe(true);
      expect(hasTierAccess('enterprise', 'creator')).toBe(true);
      expect(hasTierAccess('enterprise', 'enterprise')).toBe(true);
    });

    it('should handle unknown tiers gracefully', () => {
      expect(hasTierAccess('unknown' as Tier, 'free')).toBe(false);
    });
  });

  describe('checkFeatureAccess', () => {
    it('should gate CREATE_COIN behind creator tier', () => {
      expect(checkFeatureAccess('free', 'CREATE_COIN')).toBe(false);
      expect(checkFeatureAccess('pro', 'CREATE_COIN')).toBe(false);
      expect(checkFeatureAccess('creator', 'CREATE_COIN')).toBe(true);
      expect(checkFeatureAccess('enterprise', 'CREATE_COIN')).toBe(true);
    });

    it('should gate API_ACCESS behind enterprise tier', () => {
      expect(checkFeatureAccess('free', 'API_ACCESS')).toBe(false);
      expect(checkFeatureAccess('pro', 'API_ACCESS')).toBe(false);
      expect(checkFeatureAccess('creator', 'API_ACCESS')).toBe(false);
      expect(checkFeatureAccess('enterprise', 'API_ACCESS')).toBe(true);
    });

    it('should allow free features for all tiers', () => {
      expect(checkFeatureAccess('free', 'BROWSE_ALL_FEEDS')).toBe(true);
      expect(checkFeatureAccess('pro', 'BROWSE_ALL_FEEDS')).toBe(true);
      expect(checkFeatureAccess('creator', 'BROWSE_ALL_FEEDS')).toBe(true);
      expect(checkFeatureAccess('enterprise', 'BROWSE_ALL_FEEDS')).toBe(true);
    });

    it('should gate CROSS_NETWORK_MESSAGING behind pro', () => {
      expect(checkFeatureAccess('free', 'CROSS_NETWORK_MESSAGING')).toBe(false);
      expect(checkFeatureAccess('pro', 'CROSS_NETWORK_MESSAGING')).toBe(true);
    });

    it('should return false for unknown feature', () => {
      expect(checkFeatureAccess('enterprise', 'UNKNOWN_FEATURE' as any)).toBe(false);
    });
  });

  describe('getFeaturesForTier', () => {
    it('should return all features for enterprise', () => {
      const features = getFeaturesForTier('enterprise');
      expect(features.length).toBe(Object.keys(FEATURES).length);
    });

    it('should return subset for free', () => {
      const features = getFeaturesForTier('free');
      expect(features.length).toBeLessThan(Object.keys(FEATURES).length);
      expect(features).toContain('BROWSE_ALL_FEEDS');
      expect(features).not.toContain('CREATE_COIN');
    });
  });

  describe('getMinimumTier', () => {
    it('should return correct minimum tier for features', () => {
      expect(getMinimumTier('BROWSE_ALL_FEEDS')).toBe('free');
      expect(getMinimumTier('CROSS_NETWORK_MESSAGING')).toBe('pro');
      expect(getMinimumTier('CREATE_COIN')).toBe('creator');
      expect(getMinimumTier('API_ACCESS')).toBe('enterprise');
      expect(getMinimumTier('UNKNOWN' as any)).toBeNull();
    });
  });

  describe('getLockedFeatures', () => {
    it('should return all paid features for free tier', () => {
      const locked = getLockedFeatures('free');
      expect(locked.length).toBeGreaterThan(0);
      expect(locked.every((f) => f.minTier !== 'free')).toBe(true);
    });

    it('should return no features for enterprise', () => {
      const locked = getLockedFeatures('enterprise');
      expect(locked.length).toBe(0);
    });
  });

  describe('getNextTier', () => {
    it('should return pro as next from free', () => {
      const next = getNextTier('free');
      expect(next?.tier).toBe('pro');
    });

    it('should return creator as next from pro', () => {
      const next = getNextTier('pro');
      expect(next?.tier).toBe('creator');
    });

    it('should return enterprise as next from creator', () => {
      const next = getNextTier('creator');
      expect(next?.tier).toBe('enterprise');
    });

    it('should return null from enterprise (max tier)', () => {
      expect(getNextTier('enterprise')).toBeNull();
    });

    it('should return null for unknown tier', () => {
      expect(getNextTier('unknown' as Tier)).toBeNull();
    });
  });

  describe('getTierName', () => {
    it('should return display names', () => {
      expect(getTierName('free')).toBe('Free');
      expect(getTierName('pro')).toBe('Pro');
      expect(getTierName('creator')).toBe('Creator');
      expect(getTierName('enterprise')).toBe('Enterprise');
    });

    it('should default to Free for unknown', () => {
      expect(getTierName('unknown')).toBe('Free');
    });
  });

  describe('getTierPrice', () => {
    it('should return monthly prices by default', () => {
      expect(getTierPrice('free')).toBe(0);
      expect(getTierPrice('pro')).toBe(5);
      expect(getTierPrice('creator')).toBe(10);
      expect(getTierPrice('enterprise')).toBe(20);
    });

    it('should return annual prices when requested', () => {
      expect(getTierPrice('pro', true)).toBe(4);
      expect(getTierPrice('creator', true)).toBe(8);
      expect(getTierPrice('enterprise', true)).toBe(16);
    });
  });

  describe('mapLegacyTier', () => {
    it('should map old tiers to new ones', () => {
      expect(mapLegacyTier('basic')).toBe('free');
      expect(mapLegacyTier('pro')).toBe('creator'); // Legacy $10 pro → Creator
      expect(mapLegacyTier('creator')).toBe('creator');
      expect(mapLegacyTier('platinum')).toBe('enterprise'); // Legacy $25 platinum → Enterprise
      expect(mapLegacyTier('enterprise')).toBe('enterprise');
    });

    it('should default unknown tiers to free', () => {
      expect(mapLegacyTier('unknown')).toBe('free');
    });
  });

  describe('FEATURE_GROUPS', () => {
    it('should have all features organized in groups', () => {
      const allKeys = new Set(FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key)));
      const definedKeys = new Set(Object.keys(FEATURES) as any[]);
      expect(allKeys.size).toBe(definedKeys.size);
    });
  });

  describe('TIER_LIMITS', () => {
    it('free should have limited protocols', () => {
      expect(TIER_LIMITS.free.protocols).toBe(3);
      expect(TIER_LIMITS.free.scheduledPosts).toBe(10);
      expect(TIER_LIMITS.free.creatorCoins).toBe(0);
    });

    it('pro should have 10 protocols', () => {
      expect(TIER_LIMITS.pro.protocols).toBe(10);
      expect(TIER_LIMITS.pro.scheduledPosts).toBe(100);
    });

    it('creator should have unlimited protocols', () => {
      expect(TIER_LIMITS.creator.protocols).toBeGreaterThan(100);
      expect(TIER_LIMITS.creator.creatorCoins).toBe(50);
    });

    it('enterprise should have team members', () => {
      expect(TIER_LIMITS.enterprise.teamMembers).toBe(5);
    });
  });
});
