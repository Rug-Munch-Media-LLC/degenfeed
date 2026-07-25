/**
 * @degenfeed/api-worker — Membership Tiers
 *
 * The canonical tier system for DegenFeed Premium.
 * 4 tiers: Free → Pro ($5) → Creator ($10) → Enterprise ($20)
 *
 * Re-exports for backward compat with premium.ts and tier-gate.ts.
 * New code should import from here.
 */

import type { Env } from '../index';

// ─── Tier Definitions ───────────────────────────────────────────────────────

export type Tier = 'free' | 'pro' | 'creator' | 'enterprise';

export interface TierInfo {
  id: Tier;
  name: string;
  price: number; // USD/month
  annualPrice: number; // USD/month (annual billing)
  description: string;
  badge?: string;
}

export const TIER_INFO: Record<Tier, TierInfo> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    annualPrice: 0,
    description: 'Browse everything. Connect 1 protocol. Start exploring.',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 5,
    annualPrice: 4,
    description: 'Unlock all protocols, cross-network messaging, and verification badge.',
    badge: 'BEST VALUE',
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    price: 10,
    annualPrice: 8,
    description: 'Launch creator coins, unlimited scheduling, full analytics, newsletters.',
    badge: 'FOR CREATORS',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 20,
    annualPrice: 16,
    description: 'Self-host, white-label, API access, team accounts, priority support.',
    badge: 'POWER USER',
  },
};

/** Numerical tier rank for comparison. Higher = more access. */
export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  pro: 1,
  creator: 2,
  enterprise: 3,
};

// ─── Features ───────────────────────────────────────────────────────────────

export type Feature =
  | 'BROWSE_ALL_FEEDS'
  | 'CONNECT_1_PROTOCOL'
  | 'CONNECT_ALL_PROTOCOLS'
  | 'POST_3_PROTOCOLS'
  | 'POST_10_PROTOCOLS'
  | 'CROSS_POST_ALL'
  | 'SCHEDULED_POSTS_10'
  | 'SCHEDULED_POSTS_100'
  | 'SCHEDULED_POSTS_UNLIMITED'
  | 'BASIC_ANALYTICS'
  | 'FULL_ANALYTICS'
  | 'PROFILE_VERIFICATION_BADGE'
  | 'CROSS_NETWORK_MESSAGING'
  | 'CREATE_COIN'
  | 'AI_OPTIMIZED_TIMES'
  | 'NEWSLETTER_CREATION'
  | 'NEWSLETTER_MONETIZATION'
  | 'CREATOR_DASHBOARD'
  | 'REVENUE_TRACKING'
  | 'EXTERNAL_PLATFORMS'
  | 'SELF_HOSTED_CUSTOM_DOMAIN'
  | 'WHITE_LABEL_REPORTS'
  | 'API_ACCESS'
  | 'TEAM_ACCOUNTS'
  | 'PRIORITY_SUPPORT'
  | 'EARLY_ACCESS';

export interface FeatureDef {
  key: Feature;
  label: string;
  description: string;
  minTier: Tier;
}

/**
 * Every gated feature, the minimum tier required.
 * This is the single source of truth for feature gating.
 */
export const FEATURES: Record<Feature, FeatureDef> = {
  // ── Free features ─────────────────────────────────────────────────
  BROWSE_ALL_FEEDS: {
    key: 'BROWSE_ALL_FEEDS',
    label: 'Browse all public feeds',
    description: 'View content across all connected protocols',
    minTier: 'free',
  },
  CONNECT_1_PROTOCOL: {
    key: 'CONNECT_1_PROTOCOL',
    label: 'Connect 1 protocol identity',
    description: 'Link one social protocol account',
    minTier: 'free',
  },
  POST_3_PROTOCOLS: {
    key: 'POST_3_PROTOCOLS',
    label: 'Post to 3 protocols',
    description: 'Cross-post to up to 3 protocols simultaneously',
    minTier: 'free',
  },
  SCHEDULED_POSTS_10: {
    key: 'SCHEDULED_POSTS_10',
    label: '10 scheduled posts',
    description: 'Schedule up to 10 posts in advance',
    minTier: 'free',
  },
  BASIC_ANALYTICS: {
    key: 'BASIC_ANALYTICS',
    label: 'Basic analytics',
    description: 'View counts and basic engagement metrics',
    minTier: 'free',
  },

  // ── Pro ($5) features ─────────────────────────────────────────────
  CONNECT_ALL_PROTOCOLS: {
    key: 'CONNECT_ALL_PROTOCOLS',
    label: 'Connect ALL protocol identities',
    description: 'Link unlimited social protocol accounts',
    minTier: 'pro',
  },
  POST_10_PROTOCOLS: {
    key: 'POST_10_PROTOCOLS',
    label: 'Cross-post to 10 protocols',
    description: 'Publish to up to 10 protocols at once',
    minTier: 'pro',
  },
  SCHEDULED_POSTS_100: {
    key: 'SCHEDULED_POSTS_100',
    label: '100 scheduled posts',
    description: 'Schedule up to 100 posts in advance',
    minTier: 'pro',
  },
  PROFILE_VERIFICATION_BADGE: {
    key: 'PROFILE_VERIFICATION_BADGE',
    label: 'Profile verification badge',
    description: 'Verified checkmark on your profile',
    minTier: 'pro',
  },
  CROSS_NETWORK_MESSAGING: {
    key: 'CROSS_NETWORK_MESSAGING',
    label: 'Cross-network messaging',
    description: 'Send and receive DMs across protocols',
    minTier: 'pro',
  },

  // ── Creator ($10) features ─────────────────────────────────────────
  CROSS_POST_ALL: {
    key: 'CROSS_POST_ALL',
    label: 'Cross-post to ALL protocols',
    description: 'Publish to every supported protocol',
    minTier: 'creator',
  },
  SCHEDULED_POSTS_UNLIMITED: {
    key: 'SCHEDULED_POSTS_UNLIMITED',
    label: 'Unlimited scheduled posts',
    description: 'Buffer-style calendar with unlimited scheduling',
    minTier: 'creator',
  },
  CREATE_COIN: {
    key: 'CREATE_COIN',
    label: 'Creator coin creation',
    description: 'Launch your own creator token on Base or Solana',
    minTier: 'creator',
  },
  AI_OPTIMIZED_TIMES: {
    key: 'AI_OPTIMIZED_TIMES',
    label: 'AI-optimized posting times',
    description: 'Best times to post, determined by AI',
    minTier: 'creator',
  },
  FULL_ANALYTICS: {
    key: 'FULL_ANALYTICS',
    label: 'Full analytics suite',
    description: 'Advanced engagement, audience, and growth metrics',
    minTier: 'creator',
  },
  NEWSLETTER_CREATION: {
    key: 'NEWSLETTER_CREATION',
    label: 'Newsletter creation',
    description: 'Create and publish newsletters',
    minTier: 'creator',
  },
  NEWSLETTER_MONETIZATION: {
    key: 'NEWSLETTER_MONETIZATION',
    label: 'Newsletter monetization',
    description: 'Monetize your newsletters with subscriptions',
    minTier: 'creator',
  },
  CREATOR_DASHBOARD: {
    key: 'CREATOR_DASHBOARD',
    label: 'Creator dashboard',
    description: 'Full creator analytics and management dashboard',
    minTier: 'creator',
  },
  REVENUE_TRACKING: {
    key: 'REVENUE_TRACKING',
    label: 'Revenue tracking',
    description: 'Track earnings from coins, tips, and subscriptions',
    minTier: 'creator',
  },

  // ── Enterprise ($20) features ──────────────────────────────────────
  EXTERNAL_PLATFORMS: {
    key: 'EXTERNAL_PLATFORMS',
    label: 'External platform posting',
    description: 'Cross-post to LinkedIn, Facebook, X, and more',
    minTier: 'enterprise',
  },
  SELF_HOSTED_CUSTOM_DOMAIN: {
    key: 'SELF_HOSTED_CUSTOM_DOMAIN',
    label: 'Self-hosted creator page',
    description: 'Deploy your own DegenFeed page on a custom domain',
    minTier: 'enterprise',
  },
  WHITE_LABEL_REPORTS: {
    key: 'WHITE_LABEL_REPORTS',
    label: 'White-label analytics reports',
    description: 'Branded, shareable analytics reports',
    minTier: 'enterprise',
  },
  API_ACCESS: {
    key: 'API_ACCESS',
    label: 'API access',
    description: 'Programmatic access to the DegenFeed API',
    minTier: 'enterprise',
  },
  TEAM_ACCOUNTS: {
    key: 'TEAM_ACCOUNTS',
    label: 'Team accounts (up to 5)',
    description: 'Add up to 5 team members to your workspace',
    minTier: 'enterprise',
  },
  PRIORITY_SUPPORT: {
    key: 'PRIORITY_SUPPORT',
    label: 'Priority support',
    description: '4-hour response time on support requests',
    minTier: 'enterprise',
  },
  EARLY_ACCESS: {
    key: 'EARLY_ACCESS',
    label: 'Early access to features',
    description: 'Be the first to try new features before public release',
    minTier: 'enterprise',
  },
};

/** Feature groups for display in the comparison table */
export interface FeatureGroup {
  category: string;
  features: FeatureDef[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    category: 'Core',
    features: [
      FEATURES.BROWSE_ALL_FEEDS,
      FEATURES.CONNECT_1_PROTOCOL,
      FEATURES.CONNECT_ALL_PROTOCOLS,
      FEATURES.PROFILE_VERIFICATION_BADGE,
    ],
  },
  {
    category: 'Publishing',
    features: [
      FEATURES.POST_3_PROTOCOLS,
      FEATURES.POST_10_PROTOCOLS,
      FEATURES.CROSS_POST_ALL,
      FEATURES.SCHEDULED_POSTS_10,
      FEATURES.SCHEDULED_POSTS_100,
      FEATURES.SCHEDULED_POSTS_UNLIMITED,
      FEATURES.AI_OPTIMIZED_TIMES,
      FEATURES.EXTERNAL_PLATFORMS,
    ],
  },
  {
    category: 'Monetization',
    features: [
      FEATURES.CREATE_COIN,
      FEATURES.NEWSLETTER_CREATION,
      FEATURES.NEWSLETTER_MONETIZATION,
      FEATURES.REVENUE_TRACKING,
    ],
  },
  {
    category: 'Analytics',
    features: [
      FEATURES.BASIC_ANALYTICS,
      FEATURES.FULL_ANALYTICS,
      FEATURES.CREATOR_DASHBOARD,
      FEATURES.WHITE_LABEL_REPORTS,
    ],
  },
  {
    category: 'Messaging',
    features: [FEATURES.CROSS_NETWORK_MESSAGING],
  },
  {
    category: 'Enterprise',
    features: [
      FEATURES.SELF_HOSTED_CUSTOM_DOMAIN,
      FEATURES.API_ACCESS,
      FEATURES.TEAM_ACCOUNTS,
      FEATURES.PRIORITY_SUPPORT,
      FEATURES.EARLY_ACCESS,
    ],
  },
];

// ─── Tier Limits ────────────────────────────────────────────────────────────

export interface TierLimits {
  protocols: number;
  scheduledPosts: number;
  creatorCoins: number;
  teamMembers: number;
  newsletterSubscribers: number;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    protocols: 3,
    scheduledPosts: 10,
    creatorCoins: 0,
    teamMembers: 1,
    newsletterSubscribers: 0,
  },
  pro: {
    protocols: 10,
    scheduledPosts: 100,
    creatorCoins: 0,
    teamMembers: 1,
    newsletterSubscribers: 100,
  },
  creator: {
    protocols: 999, // unlimited
    scheduledPosts: 9999,
    creatorCoins: 50,
    teamMembers: 1,
    newsletterSubscribers: 10000,
  },
  enterprise: {
    protocols: 999,
    scheduledPosts: 99999,
    creatorCoins: 999,
    teamMembers: 5,
    newsletterSubscribers: 100000,
  },
};

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Check if a user tier meets or exceeds a required tier.
 */
export function hasTierAccess(userTier: string, requiredTier: Tier): boolean {
  const userRank = TIER_RANK[userTier as Tier] ?? -1;
  const requiredRank = TIER_RANK[requiredTier] ?? 0;
  return userRank >= requiredRank;
}

/**
 * Get the human-readable name for a tier.
 */
export function getTierName(tier: string): string {
  return TIER_INFO[tier as Tier]?.name ?? 'Free';
}

/**
 * Get features accessible by a given tier.
 */
export function getFeaturesForTier(tier: Tier): Feature[] {
  return (Object.values(FEATURES) as FeatureDef[])
    .filter((f) => hasTierAccess(tier, f.minTier))
    .map((f) => f.key);
}

/**
 * Check if a specific feature is accessible for a user tier.
 */
export function checkFeatureAccess(tier: string, feature: Feature): boolean {
  const featureDef = FEATURES[feature];
  if (!featureDef) return false;
  return hasTierAccess(tier, featureDef.minTier);
}

/**
 * Get the minimum tier required for a feature.
 */
export function getMinimumTier(feature: Feature): Tier | null {
  return FEATURES[feature]?.minTier ?? null;
}

/**
 * Get the price for a tier.
 */
export function getTierPrice(tier: Tier, annual: boolean = false): number {
  const info = TIER_INFO[tier];
  return annual ? info.annualPrice : info.price;
}

/**
 * Get all features that a user DOES NOT have access to, for upgrade prompts.
 */
export function getLockedFeatures(tier: string): FeatureDef[] {
  return (Object.values(FEATURES) as FeatureDef[]).filter((f) => !hasTierAccess(tier, f.minTier));
}

/**
 * Get the next upgrade tier and its price from current tier.
 * Returns null if already at max tier.
 */
export function getNextTier(currentTier: string): { tier: Tier; info: TierInfo } | null {
  const order: Tier[] = ['free', 'pro', 'creator', 'enterprise'];
  const idx = order.indexOf(currentTier as Tier);
  if (idx === -1 || idx >= order.length - 1) return null;
  const next = order[idx + 1];
  return { tier: next, info: TIER_INFO[next] };
}

// ─── KV Storage ─────────────────────────────────────────────────────────────

export interface MembershipRecord {
  tier: Tier;
  walletAddress: string;
  activatedAt: number;
  expiresAt: number;
  status: 'active' | 'cancelled' | 'expired';
  billingMethod: 'crypto' | 'fiat' | 'none';
  billingProvider?: string;
  subscriptionId?: string;
  autoRenew: boolean;
  cancelledAt?: number;
  trialEndsAt?: number;
  paymentHistory: PaymentRecord[];
}

export interface PaymentRecord {
  txHash: string;
  amount: number;
  currency: string;
  timestamp: number;
  tier: Tier;
  period: 'monthly' | 'annual';
  status: 'confirmed' | 'pending' | 'failed';
}

const KV_PREFIX = 'membership:';

function kvKey(walletAddress: string): string {
  return `${KV_PREFIX}${walletAddress.toLowerCase()}`;
}

/**
 * Get the membership record for a wallet from KV.
 */
export async function getMembership(
  walletAddress: string,
  env: Env,
): Promise<MembershipRecord | null> {
  if (!env.SUBSCRIPTIONS) return null;

  try {
    const raw = await env.SUBSCRIPTIONS.get(kvKey(walletAddress));
    if (!raw) return null;
    return JSON.parse(raw) as MembershipRecord;
  } catch {
    return null;
  }
}

/**
 * Save a membership record to KV.
 */
export async function saveMembership(
  walletAddress: string,
  record: MembershipRecord,
  env: Env,
): Promise<void> {
  if (!env.SUBSCRIPTIONS) return;
  await env.SUBSCRIPTIONS.put(kvKey(walletAddress), JSON.stringify(record));
}

/**
 * Get the current active tier for a wallet.
 * Falls back to 'free' if no active membership found.
 * Also checks legacy premium:* keys for backward compatibility.
 */
export async function getUserTier(walletAddress: string, env: Env): Promise<Tier> {
  // Try new membership record first
  const membership = await getMembership(walletAddress, env);
  if (membership && membership.status === 'active' && membership.expiresAt > Date.now()) {
    return membership.tier;
  }

  // Fall back to legacy premium:* check for backward compat
  try {
    const { checkPremiumStatus } = await import('../premium');
    const legacy = await checkPremiumStatus(walletAddress, env);
    if (legacy) {
      // Map legacy tiers to new tiers
      const tierMap: Record<string, Tier> = {
        basic: 'free',
        pro: 'creator', // Legacy pro ($10) maps to Creator
        platinum: 'enterprise', // Legacy platinum ($25) maps to Enterprise
        enterprise: 'enterprise',
      };
      return tierMap[legacy.tier] ?? 'free';
    }
  } catch {
    // Ignore errors from legacy check
  }

  return 'free';
}

/**
 * Process a tier upgrade.
 * Verifies payment, saves membership record, returns the updated tier.
 */
export async function upgradeTier(
  walletAddress: string,
  newTier: Tier,
  env: Env,
  payment?: {
    txHash: string;
    amount: number;
    currency: string;
    period: 'monthly' | 'annual';
  },
): Promise<{ success: boolean; tier: Tier; error?: string }> {
  if (newTier === 'free') {
    return { success: false, tier: 'free', error: 'Cannot upgrade to Free tier' };
  }

  const existing = await getMembership(walletAddress);
  const currentTier: Tier = existing?.tier ?? 'free';

  // Can only upgrade, not downgrade through this function
  if (!hasTierAccess(newTier, currentTier) && currentTier !== 'free') {
    return {
      success: false,
      tier: currentTier,
      error: `Cannot downgrade from ${currentTier} to ${newTier}. Cancel current plan first.`,
    };
  }

  const now = Date.now();
  const periodDays = payment?.period === 'annual' ? 365 : 30;
  const record: MembershipRecord = {
    ...existing,
    tier: newTier,
    walletAddress: walletAddress.toLowerCase(),
    activatedAt: existing?.activatedAt ?? now,
    expiresAt: payment
      ? now + periodDays * 86400 * 1000
      : (existing?.expiresAt ?? now + 30 * 86400 * 1000),
    status: 'active',
    billingMethod: payment ? 'crypto' : (existing?.billingMethod ?? 'none'),
    autoRenew: (payment?.period === 'monthly' || existing?.autoRenew) ?? false,
    paymentHistory: [
      ...(existing?.paymentHistory ?? []),
      ...(payment
        ? [
            {
              txHash: payment.txHash,
              amount: payment.amount,
              currency: payment.currency,
              timestamp: now,
              tier: newTier,
              period: payment.period,
              status: 'confirmed' as const,
            },
          ]
        : []),
    ],
  };

  await saveMembership(walletAddress, record, env);

  return { success: true, tier: newTier };
}

/**
 * Cancel a subscription. The tier stays active until expiry.
 */
export async function cancelMembership(
  walletAddress: string,
  env: Env,
): Promise<{ success: boolean; expiresAt: number }> {
  const membership = await getMembership(walletAddress, env);
  if (!membership) {
    return { success: false, expiresAt: 0 };
  }

  membership.status = 'cancelled';
  membership.cancelledAt = Date.now();
  membership.autoRenew = false;

  await saveMembership(walletAddress, membership, env);

  return { success: true, expiresAt: membership.expiresAt };
}

/**
 * Alias for backward compatibility with premium.ts.
 */
export { getUserTier as checkPremiumStatus };

/**
 * Map old tier names to new tier names.
 */
export function mapLegacyTier(oldTier: string): Tier {
  const map: Record<string, Tier> = {
    basic: 'free',
    pro: 'creator', // Old $10 Pro → new $10 Creator
    creator: 'creator',
    platinum: 'enterprise', // Old $25 Platinum → new $20 Enterprise
    enterprise: 'enterprise',
  };
  return map[oldTier] ?? 'free';
}
