/**
 * @degenfeed/monetization — TierManager tests
 *
 * Verifies feature gating, tier upgrade/downgrade rules,
 * trial management, billing logic, and edge cases.
 */
import { describe, expect, it } from 'vitest';
import { TierManager } from '../TierManager';
import type { FeatureFlag, SubscriptionTier } from '../types';

describe('TierManager.canAccess', () => {
  it('allows free tier to access free features', () => {
    expect(TierManager.canAccess('free', 'tipping')).toBe(true);
    expect(TierManager.canAccess('free', 'verified_checkmark')).toBe(true);
  });

  it('blocks free tier from paid features', () => {
    expect(TierManager.canAccess('free', 'creator_coins')).toBe(false);
    expect(TierManager.canAccess('free', 'sso_saml')).toBe(false);
  });

  it('allows creator tier to access creator features', () => {
    expect(TierManager.canAccess('creator', 'creator_coins')).toBe(true);
    expect(TierManager.canAccess('creator', 'subscriptions')).toBe(true);
  });

  it('allows pro tier to access pro features', () => {
    expect(TierManager.canAccess('pro', 'custom_algorithms')).toBe(true);
    expect(TierManager.canAccess('pro', 'api_access')).toBe(true);
  });

  it('returns false for unknown features', () => {
    expect(TierManager.canAccess('pro', 'unknown_feature' as FeatureFlag)).toBe(false);
  });
});

describe('TierManager.compareTiers', () => {
  it('returns negative when first tier is lower', () => {
    expect(TierManager.compareTiers('free', 'pro')).toBeLessThan(0);
  });

  it('returns positive when first tier is higher', () => {
    expect(TierManager.compareTiers('enterprise', 'creator')).toBeGreaterThan(0);
  });

  it('returns zero for same tier', () => {
    expect(TierManager.compareTiers('pro', 'pro')).toBe(0);
  });
});

describe('TierManager.canUpgrade', () => {
  it('allows upgrade to higher tier', () => {
    expect(TierManager.canUpgrade('free', 'creator')).toBe(true);
  });

  it('rejects downgrade', () => {
    expect(TierManager.canUpgrade('pro', 'free')).toBe(false);
  });

  it('rejects same tier', () => {
    expect(TierManager.canUpgrade('creator', 'creator')).toBe(false);
  });
});

describe('TierManager.getLimits', () => {
  it('returns limits for each tier', () => {
    const tiers: SubscriptionTier[] = ['free', 'creator', 'pro', 'enterprise'];
    for (const tier of tiers) {
      const limits = TierManager.getLimits(tier);
      expect(limits).toBeDefined();
      expect(typeof limits.connectedProtocols).toBe('number');
    }
  });
});

describe('TierManager.isSubscriptionActive', () => {
  it('returns false for null or undefined', () => {
    expect(TierManager.isSubscriptionActive(null)).toBe(false);
    expect(TierManager.isSubscriptionActive(undefined)).toBe(false);
  });
});

describe('TierManager.getEffectiveTier', () => {
  it('returns free for null record', () => {
    expect(TierManager.getEffectiveTier(null)).toBe('free');
  });

  it('returns the record tier for active subscription', () => {
    const record = {
      identityId: 'test',
      tier: 'pro' as SubscriptionTier,
      status: 'active' as const,
      startedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      isYearly: false,
      nextBillingAmount: 0,
    };
    expect(TierManager.getEffectiveTier(record)).toBe('pro');
  });
});

describe('TierManager.getTierName', () => {
  it('returns display name for each tier', () => {
    expect(typeof TierManager.getTierName('free')).toBe('string');
    expect(typeof TierManager.getTierName('enterprise')).toBe('string');
  });
});

describe('TierManager.getPriceCents', () => {
  it('returns positive number for known tiers', () => {
    expect(TierManager.getPriceCents('pro')).toBeGreaterThan(0);
    expect(TierManager.getPriceCents('free')).toBe(0);
  });

  it('returns yearly price', () => {
    const monthly = TierManager.getPriceCents('pro', false);
    const yearly = TierManager.getPriceCents('pro', true);
    // Yearly should be less than 12x monthly
    expect(yearly).toBeLessThan(monthly * 12);
  });
});

describe('TierManager.requiredTierFor', () => {
  it('returns a valid tier for all known features', () => {
    const features: FeatureFlag[] = ['tipping', 'creator_coins', 'api_access', 'custom_algorithms'];
    for (const feature of features) {
      const tier = TierManager.requiredTierFor(feature);
      expect(tier).toBeDefined();
    }
  });
});

describe('TierManager.checkLimit', () => {
  it('returns true when under limit', () => {
    expect(TierManager.checkLimit('free', 'connectedProtocols', 3)).toBe(true);
  });

  it('returns false when over limit', () => {
    expect(TierManager.checkLimit('free', 'connectedProtocols', 10)).toBe(false);
  });
});

describe('TierManager.getTrialDays', () => {
  it('returns non-negative number for each tier', () => {
    const tiers: SubscriptionTier[] = ['free', 'creator', 'pro', 'enterprise'];
    for (const tier of tiers) {
      expect(TierManager.getTrialDays(tier)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('TierManager.buildSubscription', () => {
  it('builds a valid subscription record', () => {
    const record = TierManager.buildSubscription('user-1', 'pro', false);
    expect(record.identityId).toBe('user-1');
    expect(record.isYearly).toBe(false);
    expect(record.tier).toBe('pro');
    expect(record.status).toBe('active');
    expect(record.startedAt).toBeGreaterThan(0);
    expect(record.expiresAt).toBeGreaterThan(record.startedAt);
  });
});

describe('TierManager.getNextBillingAmount', () => {
  it('returns positive number', () => {
    expect(TierManager.getNextBillingAmount('pro', false)).toBeGreaterThan(0);
  });
});
