/**
 * @degenfeed/monetization — TierManager
 *
 * Manages user subscription tiers: status checks, upgrades, downgrades,
 * cancellations, trial management, and billing cycle logic.
 *
 * Works with both Stripe subscriptions and on-chain crypto payments.
 */

import {
  FEATURE_TIER_MAP,
  type FeatureFlag,
  type SubscriptionRecord,
  type SubscriptionTier,
  TIER_LIMITS,
  TIER_NAMES,
  TIER_PRICES_CENTS,
  TIER_PRICES_CENTS_YEARLY,
  TIER_RANK,
  type TierLimits,
} from './types';

// ─── Errors ─────────────────────────────────────────────────────────────

export class TierError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_FOUND'
      | 'INVALID_TIER'
      | 'DOWNGRADE_NOT_ALLOWED'
      | 'ALREADY_ACTIVE'
      | 'PAYMENT_REQUIRED'
      | 'LIMIT_EXCEEDED',
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'TierError';
  }
}

// ─── TierManager ─────────────────────────────────────────────────────────

export class TierManager {
  /**
   * Check whether a user's tier grants access to a given feature.
   */
  static canAccess(tier: SubscriptionTier, feature: FeatureFlag): boolean {
    const requiredTier = FEATURE_TIER_MAP[feature];
    if (!requiredTier) return false;
    return TIER_RANK[tier] >= TIER_RANK[requiredTier];
  }

  /**
   * Compare two tiers. Returns positive if `a` outranks `b`, negative if reverse, 0 if equal.
   */
  static compareTiers(a: SubscriptionTier, b: SubscriptionTier): number {
    return TIER_RANK[a] - TIER_RANK[b];
  }

  /**
   * Get the minimum tier required for a feature.
   */
  static requiredTierFor(feature: FeatureFlag): SubscriptionTier {
    return FEATURE_TIER_MAP[feature];
  }

  /**
   * Check if upgrading from `currentTier` to `targetTier` is allowed (upgrade only).
   */
  static canUpgrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
    return TIER_RANK[targetTier] > TIER_RANK[currentTier];
  }

  /**
   * Get human-readable name for a tier.
   */
  static getTierName(tier: SubscriptionTier): string {
    return TIER_NAMES[tier] ?? 'Free';
  }

  /**
   * Get monthly price in cents for a tier.
   */
  static getPriceCents(tier: SubscriptionTier, yearly: boolean = false): number {
    return yearly ? TIER_PRICES_CENTS_YEARLY[tier] : TIER_PRICES_CENTS[tier];
  }

  /**
   * Get the limits for a tier.
   */
  static getLimits(tier: SubscriptionTier): TierLimits {
    return TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  }

  /**
   * Check if a user has hit a specific limit.
   * Returns `{ allowed, limit, current }`.
   */
  static checkLimit(
    tier: SubscriptionTier,
    limitKey: keyof TierLimits,
    currentValue: number,
  ): { allowed: boolean; limit: number; current: number } {
    const limits = TierManager.getLimits(tier);
    const limit = limits[limitKey];
    return {
      allowed: currentValue < limit,
      limit,
      current: currentValue,
    };
  }

  /**
   * Determine if a subscription record is still active.
   */
  static isSubscriptionActive(record?: SubscriptionRecord | null): boolean {
    if (!record) return false;
    if (record.status === 'cancelled' || record.status === 'past_due') return false;
    return record.expiresAt > Date.now();
  }

  /**
   * Determine the effective tier from a subscription record.
   */
  static getEffectiveTier(record?: SubscriptionRecord | null): SubscriptionTier {
    if (!record) return 'free';
    if (!TierManager.isSubscriptionActive(record)) return 'free';
    return record.tier;
  }

  /**
   * Calculate prorated refund in cents when downgrading mid-cycle.
   */
  static calculateProratedRefund(
    currentTier: SubscriptionTier,
    daysLeftInCycle: number,
    totalCycleDays: number = 30,
  ): number {
    const paid = TIER_PRICES_CENTS[currentTier];
    if (paid <= 0) return 0;
    const dailyRate = paid / totalCycleDays;
    return Math.round(dailyRate * daysLeftInCycle);
  }

  /**
   * Calculate the next billing amount based on tier and yearly flag.
   */
  static getNextBillingAmount(tier: SubscriptionTier, isYearly: boolean): number {
    return isYearly ? TIER_PRICES_CENTS_YEARLY[tier] : TIER_PRICES_CENTS[tier];
  }

  /**
   * Get the default trial period in days for a tier.
   */
  static getTrialDays(tier: SubscriptionTier): number {
    if (tier === 'free') return 0;
    return 14; // 14-day free trial for all paid tiers
  }

  /**
   * Build a subscription record from scratch.
   */
  static buildSubscription(
    identityId: string,
    tier: SubscriptionTier,
    isYearly: boolean = false,
    trialDays: number = 14,
  ): SubscriptionRecord {
    const now = Date.now();
    const trialEndsAt = trialDays > 0 ? now + trialDays * 86400 * 1000 : undefined;
    const expiresAt = trialEndsAt ?? now + 30 * 86400 * 1000;

    return {
      identityId,
      tier,
      status: trialDays > 0 ? 'trialing' : 'active',
      startedAt: now,
      expiresAt,
      trialEndsAt,
      isYearly,
      nextBillingAmount: TierManager.getNextBillingAmount(tier, isYearly),
    };
  }
}
