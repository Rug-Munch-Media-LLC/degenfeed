/**
 * @degenfeed/api-worker — Premium tier helpers
 *
 * Shared utilities for premium-gating features.
 * Updated for 4-tier model: basic, pro, platinum, enterprise
 *
 * Exports:
 *   checkPremiumStatus()    — returns tier + expiry or null
 *   requirePremiumTier()    — returns blocking Response or null
 *   addPremiumHeader()      — attaches X-Premium-Required to a response
 *   hasTierAccess()         — compare user tier to required tier
 *   getTierName()           — human-readable tier name
 *   TIER_RANK, TIER_LIMITS, FEATURE_TIER_REQUIREMENTS, TOKEN_GENERATION_FEE_USD
 *   PremiumTier type
 */

import { jsonResponse } from './response-helpers';
import type { Env } from './types';

export type PremiumTier = 'basic' | 'pro' | 'creator' | 'platinum' | 'enterprise';

export interface PremiumStatus {
  tier: PremiumTier;
  expiresAt: number;
}

/** Higher rank = more access. Used to compare tiers. */
export const TIER_RANK: Record<string, number> = {
  basic: 0,
  pro: 1,
  creator: 2,
  platinum: 3,
  enterprise: 4,
};

export const TIER_NAMES: Record<PremiumTier, string> = {
  basic: 'Basic',
  pro: 'Pro',
  creator: 'Creator',
  platinum: 'Platinum',
  enterprise: 'Enterprise',
};

/**
 * Feature-to-minimum-tier mapping.
 * Each feature key requires the listed tier or higher.
 */
export const FEATURE_TIER_REQUIREMENTS: Record<string, PremiumTier> = {
  // Free features
  browse_all_feeds: 'basic',
  connect_1_protocol: 'basic',
  post_3_protocols: 'basic',
  scheduled_posts_10: 'basic',
  analytics_basic: 'basic',

  // Pro ($5) features
  connect_all_protocols: 'pro',
  post_10_protocols: 'pro',
  scheduled_posts_100: 'pro',
  verified_badge: 'pro',
  cross_network_messaging: 'pro',

  // Creator ($10) features
  post_all_protocols: 'creator',
  creator_coins: 'creator',
  create_coin: 'creator',
  live_streaming: 'creator',
  scheduled_posts_unlimited: 'creator',
  ai_optimized_times: 'creator',
  analytics_advanced: 'creator',
  newsletter_creation: 'creator',
  newsletter_monetization: 'creator',
  creator_dashboard: 'creator',
  revenue_tracking: 'creator',

  // Enterprise ($20) features
  unlimited_creator_coins: 'enterprise',
  external_platforms: 'enterprise',
  self_host: 'enterprise',
  white_label: 'enterprise',
  custom_domain: 'enterprise',
  api_access: 'enterprise',
  team_management: 'enterprise',
  priority_support: 'enterprise',
  early_feature_access: 'enterprise',
  multi_creator_collab: 'enterprise',
  telegram_discord_integration: 'enterprise',
  unlimited_communities: 'enterprise',
  early_protocol_access: 'enterprise',
  custom_integrations: 'enterprise',
  dedicated_infra: 'enterprise',
  sla_guarantee: 'enterprise',
  sso_saml: 'enterprise',
  custom_contract: 'enterprise',
};

/** Tier limits for countable resources. 999 = unlimited. */
export const TIER_LIMITS: Record<
  string,
  { protocols: number; creatorCoins: number; communities: number; scheduledPosts: number }
> = {
  basic: { protocols: 3, creatorCoins: 0, communities: 0, scheduledPosts: 10 },
  pro: { protocols: 10, creatorCoins: 0, communities: 3, scheduledPosts: 100 },
  creator: { protocols: 999, creatorCoins: 50, communities: 999, scheduledPosts: 9999 },
  platinum: { protocols: 999, creatorCoins: 999, communities: 999, scheduledPosts: 999 },
  enterprise: { protocols: 999, creatorCoins: 999, communities: 999, scheduledPosts: 99999 },
};

/** One-time fee per additional creator coin on Pro tier (USD). Covers gas + platform costs. */
export const TOKEN_GENERATION_FEE_USD = 20;

/** Check if a user's tier meets the required tier. */
export function hasTierAccess(userTier: string, requiredTier: PremiumTier): boolean {
  const userRank = TIER_RANK[userTier] ?? -1;
  const requiredRank = TIER_RANK[requiredTier] ?? 0;
  return userRank >= requiredRank;
}

/** Get human-readable tier name. */
export function getTierName(tier: string): string {
  return TIER_NAMES[tier as PremiumTier] || 'Basic';
}

/**
 * Map legacy tier names (from old billing system) to the current tier model.
 * Old: basic → free, pro ($10) → creator, platinum ($25) → enterprise
 */
function mapTier(tier: string): PremiumTier {
  const tierMap: Record<string, PremiumTier> = {
    basic: 'basic',
    pro: 'creator', // Old $10 pro → new $10 creator
    creator: 'creator',
    platinum: 'enterprise', // Old $25 platinum → new $20 enterprise
    enterprise: 'enterprise',
  };
  return tierMap[tier] ?? 'basic';
}

/**
 * Look up the premium subscription status for a wallet address.
 * Checks both legacy (solana:/ethereum: prefix) and current (premium: prefix)
 * SUBSCRIPTIONS KV schemas. Supports all 5 tiers (basic, pro, creator, platinum, enterprise).
 *
 * Returns null when the user has no active subscription.
 */
export async function checkPremiumStatus(
  walletAddress: string,
  env: Env,
): Promise<PremiumStatus | null> {
  if (!env.SUBSCRIPTIONS) return null;

  const address = walletAddress.toLowerCase();
  const now = Date.now();

  try {
    // ── Legacy schema: identity-prefixed keys (from handleBillingVerify) ──
    for (const prefix of ['solana:', 'ethereum:']) {
      const raw = await env.SUBSCRIPTIONS.get(`${prefix}${address}`);
      if (raw) {
        const record = JSON.parse(raw) as { tier: string; expiresAt: number };
        if (record.expiresAt > now) {
          return { tier: mapTier(record.tier), expiresAt: record.expiresAt };
        }
      }
    }

    // ── Current schema: premium: prefix (from handleBillingSubscribe) ──
    const premRaw = await env.SUBSCRIPTIONS.get(`premium:${address}`);
    if (premRaw) {
      const record = JSON.parse(premRaw) as {
        tier: string;
        expiresAt: number;
        status?: string;
      };
      if (record.status !== 'cancelled' && record.expiresAt > now) {
        return { tier: mapTier(record.tier), expiresAt: record.expiresAt };
      }
    }
  } catch {
    // KV or parse error — treat as not premium
  }

  return null;
}

/**
 * Premium gate helper.
 *
 * Returns a 402 Response with `X-Premium-Required` header when the user
 * does NOT meet the required tier. Returns `null` when the check passes
 * and the request should proceed.
 *
 * Usage in a handler:
 *   const gate = await requirePremiumTier(walletAddress, env, 'pro');
 *   if (gate) return gate;
 */
export async function requirePremiumTier(
  walletAddress: string,
  env: Env,
  minTier: PremiumTier = 'pro',
): Promise<Response | null> {
  const status = await checkPremiumStatus(walletAddress, env);

  // ── No subscription at all ────────────────────────────────────────
  if (!status) {
    const label = getTierName(minTier);
    return jsonResponse(
      {
        error: `${label} subscription required. Upgrade at /premium to unlock this feature.`,
        upgrade: true,
        requiredTier: minTier,
      },
      402,
      { 'X-Premium-Required': label },
    );
  }

  // ── Tier too low ──────────────────────────────────────────────────
  if (!hasTierAccess(status.tier, minTier)) {
    const label = getTierName(minTier);
    return jsonResponse(
      {
        error: `This feature requires ${label} tier or higher (current: ${getTierName(status.tier)}). Upgrade at /premium.`,
        upgrade: true,
        requiredTier: minTier,
        currentTier: status.tier,
      },
      402,
      { 'X-Premium-Required': label },
    );
  }

  // ── Allowed ───────────────────────────────────────────────────────
  return null;
}

/**
 * Attach the `X-Premium-Required` header to an existing Response.
 * Use when blocking a request inline (outside requirePremiumTier).
 */
export function addPremiumHeader(response: Response, tier: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Premium-Required', tier);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
