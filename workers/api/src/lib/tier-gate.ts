/**
 * @degenfeed/api-worker — Tier gate middleware
 *
 * Feature-gating middleware for Hono routes.
 * Use `requireTier('pro')` to gate entire routes.
 * Use `requireFeature('analytics_advanced')` for specific features.
 *
 * Also provides usage tracking helpers for tier limits
 * (coin deploy count, community creation count, etc.)
 */

import type { Context, Next } from 'hono';
import type { Env } from '../index';
import { jsonResponse } from '../index';
import {
  checkPremiumStatus,
  FEATURE_TIER_REQUIREMENTS,
  hasTierAccess,
  type PremiumTier,
  TIER_LIMITS,
} from '../premium';
import { requireSession } from '../session';

// ─── KV key patterns for usage tracking ────────────────────────────────────

const USAGE_PREFIX = 'usage:';

function coinDeployKey(address: string): string {
  return `${USAGE_PREFIX}coin:deploy:${address.toLowerCase()}`;
}

function communityCountKey(address: string): string {
  return `${USAGE_PREFIX}communities:${address.toLowerCase()}`;
}

// ─── Usage tracking ────────────────────────────────────────────────────────

export interface TierUsage {
  protocolsUsed: number;
  creatorCoinsDeployed: number;
  communitiesCreated: number;
  scheduledPostsUsed: number;
  postsThisMonth: number;
}

/**
 * Get current usage counts for a wallet across all tier-limited resources.
 * Returns zeros when KV is unavailable or no usage recorded.
 */
export async function getCurrentUsage(env: Env, walletAddress: string): Promise<TierUsage> {
  const address = walletAddress.toLowerCase();
  let coinCount = 0;
  let communityCount = 0;

  try {
    const coinRaw = await env.CACHE?.get(coinDeployKey(address));
    coinCount = coinRaw ? Number.parseInt(coinRaw, 10) || 0 : 0;

    const commRaw = await env.CACHE?.get(communityCountKey(address));
    communityCount = commRaw ? Number.parseInt(commRaw, 10) || 0 : 0;
  } catch {
    // Non-critical — return zeros
  }

  return {
    protocolsUsed: 0, // Tracked upstream in publish.ts
    creatorCoinsDeployed: coinCount,
    communitiesCreated: communityCount,
    scheduledPostsUsed: 0, // Tracked upstream
    postsThisMonth: 0,
  };
}

/**
 * Increment the creator coin deploy count for a wallet.
 * Returns the new count. Used by deploy handlers to enforce tier limits.
 */
export async function incrementCoinDeployCount(env: Env, walletAddress: string): Promise<number> {
  const address = walletAddress.toLowerCase();
  const key = coinDeployKey(address);
  try {
    const raw = await env.CACHE?.get(key);
    const count = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
    await env.CACHE?.put(key, String(count), { expirationTtl: 86400 * 365 });
    return count;
  } catch {
    return 1;
  }
}

/**
 * Recommend a tier upgrade based on current usage patterns.
 */
export function getRecommendedTier(usage: TierUsage): PremiumTier {
  if (usage.creatorCoinsDeployed > 0) {
    return 'creator';
  }
  if (usage.communitiesCreated >= 3 || usage.scheduledPostsUsed >= 50) {
    return 'pro';
  }
  if (usage.communitiesCreated > 0 || usage.scheduledPostsUsed > 10) {
    return 'pro';
  }
  return 'basic';
}

// ─── New Membership Feature Constants ──────────────────────────────────────

/**
 * Canonical feature-to-tier mapping for the $5/$10/$20 premium strategy.
 * These keys are used by requireFeature() middleware.
 * Maps feature keys from membership-tiers.ts to the PremiumTier type.
 */
export const MEMBERSHIP_FEATURE_MAP: Record<string, PremiumTier> = {
  BROWSE_ALL_FEEDS: 'basic',
  CONNECT_1_PROTOCOL: 'basic',
  POST_3_PROTOCOLS: 'basic',
  SCHEDULED_POSTS_10: 'basic',
  BASIC_ANALYTICS: 'basic',

  CONNECT_ALL_PROTOCOLS: 'pro',
  POST_10_PROTOCOLS: 'pro',
  SCHEDULED_POSTS_100: 'pro',
  PROFILE_VERIFICATION_BADGE: 'pro',
  CROSS_NETWORK_MESSAGING: 'pro',

  CROSS_POST_ALL: 'creator',
  SCHEDULED_POSTS_UNLIMITED: 'creator',
  CREATE_COIN: 'creator',
  AI_OPTIMIZED_TIMES: 'creator',
  FULL_ANALYTICS: 'creator',
  NEWSLETTER_CREATION: 'creator',
  NEWSLETTER_MONETIZATION: 'creator',
  CREATOR_DASHBOARD: 'creator',
  REVENUE_TRACKING: 'creator',

  EXTERNAL_PLATFORMS: 'enterprise',
  SELF_HOSTED_CUSTOM_DOMAIN: 'enterprise',
  WHITE_LABEL_REPORTS: 'enterprise',
  API_ACCESS: 'enterprise',
  TEAM_ACCOUNTS: 'enterprise',
  PRIORITY_SUPPORT: 'enterprise',
  EARLY_ACCESS: 'enterprise',
};

/**
 * Check if a feature is accessible for a given tier using the membership map.
 */
export function hasMembershipFeature(userTier: string, featureKey: string): boolean {
  const requiredTier = MEMBERSHIP_FEATURE_MAP[featureKey];
  if (!requiredTier) return false; // Unknown feature = not accessible
  return hasTierAccess(userTier as PremiumTier, requiredTier);
}

// ─── Hono middleware ────────────────────────────────────────────────────────

/**
 * Gate a route to a minimum tier.
 *
 * Usage:
 *   app.get('/api/foo', requireTier('pro'), handler)
 *
 * Returns 402 Payment Required when the user's tier is insufficient.
 */
export function requireTier(minTier: PremiumTier) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const session = await requireSession(c.req.raw, c.env);
    if (session instanceof Response) return session;

    const walletAddress = session.address;
    const status = await checkPremiumStatus(walletAddress, c.env);
    const userTier = status?.tier || 'basic';

    if (!hasTierAccess(userTier, minTier)) {
      return jsonResponse(
        {
          error: `${minTier} tier required`,
          currentTier: userTier,
          upgradeUrl: '/premium',
          feature: c.req.path,
        },
        402,
      );
    }

    await next();
  };
}

/**
 * Gate a route to a specific feature.
 * The feature key is looked up in FEATURE_TIER_REQUIREMENTS.
 *
 * Usage:
 *   app.get('/api/analytics', requireFeature('analytics_advanced'), handler)
 *
 * Returns 402 Payment Required when the user's tier cannot access this feature.
 */
export function requireFeature(feature: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const session = await requireSession(c.req.raw, c.env);
    if (session instanceof Response) return session;

    const walletAddress = session.address;
    if (!walletAddress) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const status = await checkPremiumStatus(walletAddress, c.env);
    const userTier = status?.tier || 'basic';
    const requiredTier = FEATURE_TIER_REQUIREMENTS[feature];

    if (!requiredTier) {
      // Feature not in map — allow (un-gated)
      await next();
      return;
    }

    if (!hasTierAccess(userTier, requiredTier)) {
      return jsonResponse(
        {
          error: `${feature} requires ${requiredTier} tier or higher`,
          currentTier: userTier,
          upgradeUrl: '/premium',
          feature,
        },
        402,
      );
    }

    await next();
  };
}

// ─── Tier limit checks ──────────────────────────────────────────────────────

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  error?: string;
  upgradeUrl?: string;
}

/**
 * Check if a user has capacity remaining for a tier-limited resource.
 *
 * Example:
 *   const check = await checkTierLimit(env, wallet, 'creatorCoins');
 *   if (!check.allowed) return c.json({ error: check.error }, 402);
 */
export async function checkTierLimit(
  env: Env,
  walletAddress: string,
  limitType: keyof (typeof TIER_LIMITS)['basic'],
): Promise<LimitCheckResult> {
  const status = await checkPremiumStatus(walletAddress, env);
  const userTier = status?.tier || 'basic';
  const limits =
    (TIER_LIMITS[userTier] as
      | { protocols: number; creatorCoins: number; communities: number; scheduledPosts: number }
      | undefined) ?? TIER_LIMITS.basic;
  const limit = limits[limitType] ?? 0;
  const usage = await getCurrentUsage(env, walletAddress);

  let current = 0;
  switch (limitType) {
    case 'protocols':
      current = usage.protocolsUsed;
      break;
    case 'creatorCoins':
      current = usage.creatorCoinsDeployed;
      break;
    case 'communities':
      current = usage.communitiesCreated;
      break;
    case 'scheduledPosts':
      current = usage.scheduledPostsUsed;
      break;
  }

  const allowed = current < limit;
  return {
    allowed,
    limit,
    current,
    error: allowed ? undefined : `Limit reached (${current}/${limit}). Upgrade for more.`,
    upgradeUrl: allowed ? undefined : '/premium',
  };
}
