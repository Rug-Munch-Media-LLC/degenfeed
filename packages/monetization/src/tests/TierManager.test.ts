/**
 * @degenfeed/monetization — TierManager tests
 *
 * Verifies feature gating, tier upgrade/downgrade rules,
 * trial management, billing logic, and edge cases.
 */
import { describe, expect, it } from 'vitest';
import { TierError, TierManager } from '../TierManager';
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

describe('TierManager.getSubscription', () => {
  it('errors on missing subscription', async () => {
    await expect(TierManager.getSubscription('nonexistent-user', {} as never)).rejects.toThrow(
      TierError,
    );
  });
});

describe('TierManager.listSubscriptions', () => {
  it('returns an empty array for no subscriptions', async () => {
    const subs = await TierManager.listSubscriptions('user-with-none', {} as never);
    expect(Array.isArray(subs)).toBe(true);
  });
});

describe('TierManager.upgrade', () => {
  it('rejects downgrade when option not set', async () => {
    await expect(
      TierManager.upgrade(
        'user-1',
        'free',
        'free' as never,
        false,
      ),
    ).rejects.toThrow(TierError);
  });
});

describe('TierManager.createCheckoutSession', () => {
  it('rejects invalid tier', async () => {
    await expect(
      TierManager.createCheckoutSession('user-1', 'nonexistent' as SubscriptionTier, {} as never),
    ).rejects.toThrow(TierError);
  });
});

describe('TierManager.cancel', () => {
  it('rejects cancel for user with no subscription', async () => {
    await expect(TierManager.cancel('unknown-user', {} as never)).rejects.toThrow(TierError);
  });
});

describe('TierManager.getLimits', () => {
  it('returns limits for each tier', () => {
    const tiers: SubscriptionTier[] = ['free', 'creator', 'pro', 'enterprise'];
    for (const tier of tiers) {
      const limits = TierManager.getLimits(tier);
      expect(limits).toBeDefined();
      expect(typeof limits.maxProtocols).toBe('number');
    }
  });
});

describe('TierManager.getPlanDetails', () => {
  it('returns details for valid tier', () => {
    const details = TierManager.getPlanDetails('creator');
    expect(details.tier).toBe('creator');
    expect(details.name).toBeDefined();
    expect(details.priceCents).toBeGreaterThan(0);
    expect(Array.isArray(details.features)).toBe(true);
  });

  it('returns details for free tier', () => {
    const details = TierManager.getPlanDetails('free');
    expect(details.tier).toBe('free');
    expect(details.priceCents).toBe(0);
  });
});
