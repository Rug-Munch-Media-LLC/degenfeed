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

import type { Env } from './index';
import { jsonResponse } from './index';

export type PremiumTier = 'basic' | 'pro' | 'platinum' | 'enterprise';

export interface PremiumStatus {
  tier: PremiumTier;
  expiresAt: number;
}

/** Higher rank = more access. Used to compare tiers. */
export const TIER_RANK: Record<string, number> = {
  basic: 0,
  pro: 1,
  platinum: 2,
  enterprise: 3,
};

export const TIER_NAMES: Record<PremiumTier, string> = {
  basic: 'Basic',
  pro: 'Pro',
  platinum: 'Platinum',
  enterprise: 'Enterprise',
};

/**
 * Feature-to-minimum-tier mapping.
 * Each feature key requires the listed tier or higher.
 */
export const FEATURE_TIER_REQUIREMENTS: Record<string, PremiumTier> = {
  post_all_protocols: 'pro',
  creator_coins: 'pro',
  live_streaming: 'pro',
  analytics_basic: 'pro',
  scheduled_posts: 'pro',
  create_communities: 'pro',
  token_gated_content: 'pro',
  custom_profile: 'pro',
  unlimited_creator_coins: 'platinum',
  multi_creator_collab: 'platinum',
  analytics_advanced: 'platinum',
  cross_network_posting: 'platinum',
  buffer_scheduling: 'platinum',
  telegram_discord_integration: 'platinum',
  unlimited_communities: 'platinum',
  custom_domain: 'platinum',
  priority_support: 'platinum',
  api_access: 'platinum',
  early_protocol_access: 'platinum',
  self_host: 'enterprise',
  white_label: 'enterprise',
  custom_integrations: 'enterprise',
  dedicated_infra: 'enterprise',
  sla_guarantee: 'enterprise',
  team_management: 'enterprise',
  sso_saml: 'enterprise',
  custom_contract: 'enterprise',
};

/** Tier limits for countable resources. 999 = unlimited. */
export const TIER_LIMITS: Record<
  string,
  { protocols: number; creatorCoins: number; communities: number; scheduledPosts: number }
> = {
  basic: { protocols: 3, creatorCoins: 0, communities: 0, scheduledPosts: 0 },
  pro: { protocols: 999, creatorCoins: 1, communities: 3, scheduledPosts: 50 },
  platinum: { protocols: 999, creatorCoins: 999, communities: 999, scheduledPosts: 999 },
  enterprise: { protocols: 999, creatorCoins: 999, communities: 999, scheduledPosts: 999 },
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
 * Look up the premium subscription status for a wallet address.
 * Checks both legacy (solana:/ethereum: prefix) and current (premium: prefix)
 * SUBSCRIPTIONS KV schemas. Supports all 4 tiers.
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
          return { tier: record.tier as PremiumTier, expiresAt: record.expiresAt };
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
        return { tier: record.tier as PremiumTier, expiresAt: record.expiresAt };
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
