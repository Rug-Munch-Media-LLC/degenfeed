/**
 * @degenfeed/monetization — Type/constant tests
 *
 * Verifies tier configuration consistency:
 * - All tiers have matching entries in every config map
 * - Prices follow business rules (free = 0, paid > 0)
 * - Annual pricing is cheaper than 12× monthly
 * - Feature flags map to valid tiers
 * - Monotonic tier ranking
 */
import { describe, expect, it } from 'vitest';
import {
  FEATURE_TIER_MAP,
  type FeatureFlag,
  type SubscriptionTier,
  TIER_CONFIGS,
  TIER_LIMITS,
  TIER_NAMES,
  TIER_PRICES_CENTS,
  TIER_PRICES_CENTS_YEARLY,
  TIER_RANK,
} from '../types';

const ALL_TIERS: SubscriptionTier[] = ['free', 'creator', 'pro', 'enterprise'];

describe('Tier configuration consistency', () => {
  it('all tiers have a rank entry', () => {
    for (const tier of ALL_TIERS) {
      expect(typeof TIER_RANK[tier]).toBe('number');
    }
  });

  it('all tiers have a name entry', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_NAMES[tier]).toBeDefined();
      expect(TIER_NAMES[tier].length).toBeGreaterThan(0);
    }
  });

  it('all tiers have a monthly price entry', () => {
    for (const tier of ALL_TIERS) {
      expect(typeof TIER_PRICES_CENTS[tier]).toBe('number');
    }
  });

  it('all tiers have a yearly price entry', () => {
    for (const tier of ALL_TIERS) {
      expect(typeof TIER_PRICES_CENTS_YEARLY[tier]).toBe('number');
    }
  });

  it('all tiers have a config entry', () => {
    for (const tier of ALL_TIERS) {
      const config = TIER_CONFIGS.find((c) => c.id === tier);
      expect(config).toBeDefined();
    }
  });

  it('all tiers have a limits entry', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_LIMITS[tier]).toBeDefined();
    }
  });

  it('free tier costs $0', () => {
    expect(TIER_PRICES_CENTS.free).toBe(0);
    expect(TIER_PRICES_CENTS_YEARLY.free).toBe(0);
  });

  it('paid tiers have positive prices', () => {
    for (const tier of ['creator', 'pro', 'enterprise'] as SubscriptionTier[]) {
      expect(TIER_PRICES_CENTS[tier]).toBeGreaterThan(0);
      expect(TIER_PRICES_CENTS_YEARLY[tier]).toBeGreaterThan(0);
    }
  });

  it('annual price is cheaper than 12× monthly', () => {
    for (const tier of ['creator', 'pro', 'enterprise'] as SubscriptionTier[]) {
      const monthlyTotal = TIER_PRICES_CENTS[tier] * 12;
      expect(TIER_PRICES_CENTS_YEARLY[tier]).toBeLessThan(monthlyTotal);
    }
  });

  it('enterprise costs more than pro costs more than creator', () => {
    expect(TIER_PRICES_CENTS.enterprise).toBeGreaterThan(TIER_PRICES_CENTS.pro);
    expect(TIER_PRICES_CENTS.pro).toBeGreaterThan(TIER_PRICES_CENTS.creator);
  });

  it('tier ranks are monotonic', () => {
    expect(TIER_RANK.free).toBeLessThan(TIER_RANK.creator);
    expect(TIER_RANK.creator).toBeLessThan(TIER_RANK.pro);
    expect(TIER_RANK.pro).toBeLessThan(TIER_RANK.enterprise);
  });

  it('every feature maps to a valid tier', () => {
    const features = Object.keys(FEATURE_TIER_MAP) as FeatureFlag[];
    expect(features.length).toBeGreaterThan(0);
    for (const feature of features) {
      const tier = FEATURE_TIER_MAP[feature];
      expect(ALL_TIERS).toContain(tier);
    }
  });
});
