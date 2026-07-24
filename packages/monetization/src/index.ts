/**
 * @degenfeed/monetization — Barrel exports
 *
 * Central monetization package for DegenFeed:
 * - Tier management & subscription lifecycle
 * - Feature gating (server + client)
 * - Stripe payment integration
 * - Pricing and tier configuration
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type {
  FeatureFlag,
  RevenueEvent,
  SubscriptionRecord,
  SubscriptionTier,
  TierConfig,
  TierLimits,
} from './types';
export type { FeatureCheckResult } from './FeatureGate';

export {
  FEATURE_LABELS,
  FEATURE_TIER_MAP,
  PLATFORM_FEES,
  TIER_CONFIGS,
  TIER_LIMITS,
  TIER_NAMES,
  TIER_PRICES_CENTS,
  TIER_PRICES_CENTS_YEARLY,
  TIER_RANK,
} from './types';

// ─── TierManager ─────────────────────────────────────────────────────────

export { TierError, TierManager } from './TierManager';

// ─── FeatureGate ─────────────────────────────────────────────────────────

export type { PremiumGateProps } from './FeatureGate';
export {
  checkAccess,
  checkAllAccess,
  getAccessibleFeatures,
  getBlockedFeatures,
  PremiumGate,
  requireAll,
  requireAny,
} from './FeatureGate';

// ─── StripeIntegration ───────────────────────────────────────────────────

export type {
  CheckoutResult,
  CreateCheckoutParams,
  PortalResult,
  SubscriptionSyncResult,
  WebhookEvent,
} from './StripeIntegration';
export { StripeIntegration } from './StripeIntegration';
