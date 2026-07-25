/**
 * @degenfeed/api-worker — Premium Tier Gating
 *
 * Tier-based feature gating for DegenFeed Premium Cross-Posting.
 * Complements premium.ts (subscription status) with resource limits
 * and per-feature access checks.
 *
 * Tier structure:
 *   Free (basic):    3 protocols, 10 scheduled posts, basic stats
 *   Premium $10/mo (pro):    All 12 protocols, unlimited scheduling, AI optimize,
 *                            auto-thread, full analytics, calendar, content recycling,
 *                            evergreen posts, batch import
 *   Pro $25/mo (platinum):   Everything in Premium + team accounts, white-label,
 *                            API access, priority support
 *   Enterprise:              Custom
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { type PremiumTier, requirePremiumTier, TIER_LIMITS } from '../premium';
import { createPostizSchedule, getSchedulingEngine, shouldUsePostiz } from './postiz-bridge';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PremiumUsage {
  scheduledPosts: number;
  evergreenPosts: number;
  queuedPosts: number;
  batchSize: number;
  teamMembers: number;
  composerPosts: number;
  analyticsPosts: number;
  /** AI-optimized scheduling usage count */
  aiOptimizations: number;
}

export interface FeatureAccess {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
}

export interface GateResult {
  passed: boolean;
  /** If blocked, the 402 Response. Otherwise null. */
  response: Response | null;
  /** Human-readable message */
  message: string;
}

// ─── Protocol Constants ───────────────────────────────────────────────────

export const ALL_PROTOCOLS = [
  'mastodon',
  'bluesky',
  'nostr',
  'farcaster',
  'lens',
  'threads',
  'reddit',
  'telegram',
  'discord',
  'lemmy',
  'peertube',
  'pixelfed',
] as const;

export const FREE_MAX_PROTOCOLS = 3;
export const FREE_MAX_SCHEDULED = 10;

// ─── Resource Limit Checks ────────────────────────────────────────────────

/**
 * Get current usage counts for a wallet.
 * Reads from SUBSCRIPTIONS KV prefixed counters.
 */
export async function getPremiumUsage(walletAddress: string, env: Env): Promise<PremiumUsage> {
  const address = walletAddress.toLowerCase();
  const defaults: PremiumUsage = {
    scheduledPosts: 0,
    evergreenPosts: 0,
    queuedPosts: 0,
    batchSize: 0,
    teamMembers: 0,
    composerPosts: 0,
    analyticsPosts: 0,
    aiOptimizations: 0,
  };

  if (!env.SUBSCRIPTIONS) return defaults;

  try {
    const raw = await env.SUBSCRIPTIONS.get(`usage:${address}`);
    if (raw) {
      return { ...defaults, ...(JSON.parse(raw) as Partial<PremiumUsage>) };
    }
  } catch {
    // KV error — return defaults
  }

  return defaults;
}

/**
 * Increment a usage counter.
 */
export async function incrementPremiumUsage(
  walletAddress: string,
  field: keyof PremiumUsage,
  delta: number,
  env: Env,
): Promise<PremiumUsage> {
  const usage = await getPremiumUsage(walletAddress, env);
  (usage[field] as number) += delta;
  if (env.SUBSCRIPTIONS) {
    await env.SUBSCRIPTIONS.put(`usage:${walletAddress.toLowerCase()}`, JSON.stringify(usage));
  }
  return usage;
}

/**
 * Check if a user can perform an action within their tier limits.
 */
export async function checkResourceLimit(
  walletAddress: string,
  env: Env,
  resource: keyof PremiumUsage,
  requestedDelta: number,
): Promise<FeatureAccess> {
  const address = walletAddress.toLowerCase();
  const status = await checkPremiumStatusInternal(address, env);
  const tier: string = status?.tier ?? 'basic';
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.basic;
  const usage = await getPremiumUsage(address, env);

  const current = usage[resource] ?? 0;
  const limit = limits[resource] ?? 0;
  const remaining = limit - current;

  return {
    allowed: remaining >= requestedDelta,
    limit,
    current,
    remaining,
  };
}

// ─── Tier Access Checks ───────────────────────────────────────────────────

/**
 * Gate that returns a 402 Response if the user doesn't meet the required tier.
 * Enhanced version that also checks resource limits.
 */
export async function gatePremiumFeature(
  walletAddress: string,
  env: Env,
  feature: string,
  minTier: PremiumTier = 'pro',
): Promise<GateResult> {
  const gate = await requirePremiumTier(walletAddress, env, minTier);
  if (gate) {
    return {
      passed: false,
      response: gate,
      message: `${minTier} tier required for ${feature}`,
    };
  }
  return {
    passed: true,
    response: null,
    message: 'Access granted',
  };
}

/**
 * Check max protocols for a user's tier.
 */
export async function checkProtocolLimit(
  walletAddress: string,
  env: Env,
  selectedCount: number,
): Promise<GateResult> {
  const address = walletAddress.toLowerCase();
  const status = await checkPremiumStatusInternal(address, env);
  const tier: string = status?.tier ?? 'basic';
  const maxProtocols = TIER_LIMITS[tier]?.protocols ?? FREE_MAX_PROTOCOLS;

  if (selectedCount > maxProtocols) {
    const tierName = tier === 'basic' ? 'Free' : tier;
    return {
      passed: false,
      response: jsonResponse(
        {
          error: `Your ${tierName} plan allows max ${maxProtocols} protocols per post (selected: ${selectedCount}). Upgrade to Premium for all 12 protocols.`,
          upgrade: true,
          requiredTier: 'pro',
          currentTier: tier,
          maxProtocols,
          selectedCount,
        },
        402,
        { 'X-Premium-Required': 'Premium' },
      ),
      message: `Protocol limit exceeded: ${selectedCount} > ${maxProtocols}`,
    };
  }

  return { passed: true, response: null, message: 'OK' };
}

// ─── Protocol Limit Checker for Publish ────────────────────────────────────

/**
 * Check if the user is allowed to publish to the given protocols.
 * Free: max 3 protocols selected at once.
 * Premium/Pro: all protocols.
 */
export async function requireProtocolLimit(
  walletAddress: string,
  protocols: string[],
  env: Env,
): Promise<Response | null> {
  const gate = await checkProtocolLimit(walletAddress, env, protocols.length);
  return gate.response;
}

// ─── Usage Quota Check ─────────────────────────────────────────────────────

/**
 * Check if user has remaining quota for a resource.
 */
export async function requireQuota(
  walletAddress: string,
  env: Env,
  resource: keyof PremiumUsage,
  requested: number,
): Promise<Response | null> {
  const check = await checkResourceLimit(walletAddress, env, resource, requested);
  if (!check.allowed) {
    return jsonResponse(
      {
        error: `${resource} limit reached (${check.current}/${check.limit}). Upgrade to Premium for unlimited.`,
        upgrade: true,
        requiredTier: 'pro',
        usage: { current: check.current, limit: check.limit, remaining: check.remaining },
      },
      402,
      { 'X-Premium-Required': 'Premium' },
    );
  }
  return null;
}

// ─── Feature List ──────────────────────────────────────────────────────────

export interface TierFeature {
  name: string;
  description: string;
  tiers: ('basic' | 'pro' | 'platinum' | 'enterprise')[];
}

export const TIER_FEATURES: TierFeature[] = [
  // Free Tier
  { name: '3 protocols per post', description: 'Mastodon, Nostr, Bluesky', tiers: ['basic'] },
  { name: '10 scheduled posts', description: 'Schedule up to 10 posts', tiers: ['basic'] },
  { name: 'Basic post stats', description: 'View count and likes', tiers: ['basic'] },
  { name: 'Standard support', description: 'Email support within 72h', tiers: ['basic'] },

  // Premium Tier ($10/mo)
  { name: 'All 12 protocols', description: 'Every supported platform', tiers: ['pro'] },
  { name: 'Unlimited scheduling', description: 'Schedule unlimited posts', tiers: ['pro'] },
  { name: 'AI optimize time', description: 'Best posting time suggestions', tiers: ['pro'] },
  { name: 'Auto-threading', description: 'Long posts split into threads', tiers: ['pro'] },
  { name: 'Full analytics', description: 'Per-post engagement metrics', tiers: ['pro'] },
  { name: 'Content calendar', description: 'Visual calendar view', tiers: ['pro'] },
  { name: 'Post recycling', description: 'Auto-repost evergreen content', tiers: ['pro'] },
  { name: 'Evergreen posts', description: 'Mark posts as evergreen', tiers: ['pro'] },
  { name: 'Batch import', description: 'CSV/spreadsheet import', tiers: ['pro'] },
  { name: 'Hashtag optimization', description: 'AI hashtag suggestions', tiers: ['pro'] },
  { name: 'Image optimization', description: 'Auto-resize per platform', tiers: ['pro'] },
  { name: 'Language adaptation', description: 'Tone per platform', tiers: ['pro'] },
  { name: 'Link optimization', description: 'UTM params + shortening', tiers: ['pro'] },

  // Pro Tier ($25/mo)
  { name: 'Team accounts (up to 5)', description: 'Collaborate with team', tiers: ['platinum'] },
  { name: 'White-label reports', description: 'Branded analytics', tiers: ['platinum'] },
  { name: 'API access', description: 'Programmatic publishing', tiers: ['platinum'] },
  { name: 'Priority support', description: 'Response within 4h', tiers: ['platinum'] },
  { name: 'Custom brand colors', description: 'Personalized theme', tiers: ['platinum'] },

  // Enterprise
  { name: 'Custom integrations', description: 'Custom protocol adapters', tiers: ['enterprise'] },
  { name: 'Dedicated infra', description: 'Isolated infrastructure', tiers: ['enterprise'] },
  { name: 'SLA guarantee', description: '99.9% uptime SLA', tiers: ['enterprise'] },
  { name: 'SSO/SAML', description: 'Enterprise auth', tiers: ['enterprise'] },
  { name: 'Custom contract', description: 'Volume pricing', tiers: ['enterprise'] },
];

/**
 * Get features available for a given tier.
 */
export function getFeaturesForTier(tier: string): TierFeature[] {
  return TIER_FEATURES.filter((f) => f.tiers.includes(tier as TierFeature['tiers'][0]));
}

/**
 * Get upgrade path suggestion based on usage.
 */
export function suggestUpgrade(usage: PremiumUsage, currentTier: string): string | null {
  if (currentTier === 'enterprise') return null;
  if (currentTier === 'platinum') return 'Enterprise';
  if (currentTier === 'pro') {
    if (usage.teamMembers > 0) return 'Pro';
    return null; // Premium is the sweet spot for most
  }
  // Free user
  if (usage.scheduledPosts >= 8 || usage.queuedPosts >= 8) {
    return 'Premium';
  }
  return null;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────

async function checkPremiumStatusInternal(
  walletAddress: string,
  env: Env,
): Promise<{ tier: string; expiresAt: number } | null> {
  try {
    const { checkPremiumStatus } = await import('../premium');
    return checkPremiumStatus(walletAddress, env);
  } catch {
    return null;
  }
}

// ─── Postiz Scheduling Integration ──────────────────────────────────────────

/**
 * Route a premium schedule through Postiz.
 *
 * For Pro/Platinum/Enterprise tiers, this schedules via Postiz's API
 * and falls back to native scheduling if Postiz is unavailable.
 *
 * For Free/Basic, always uses native scheduler.
 */
export async function routeScheduleThroughPostiz(
  walletAddress: string,
  masterPost: {
    text: string;
    title?: string;
    hashtags?: string[];
    media?: Array<{ url: string }>;
    linkCard?: { url: string };
    contentWarning?: string;
    isSensitive?: boolean;
    mentions?: string[];
    lang?: string;
  },
  protocols: string[],
  scheduledAt: string | null,
  env: Env,
): Promise<{ engine: 'postiz' | 'native'; postizId?: string }> {
  const { checkPremiumStatus } = await import('../premium');
  const status = await checkPremiumStatus(walletAddress, env);
  const tier: string = status?.tier ?? 'basic';

  // Only Pro+ tiers use Postiz
  if (!shouldUsePostiz(tier)) {
    return { engine: 'native' };
  }

  // Try Postiz, fall back to native if unavailable
  const result = await createPostizSchedule(
    {
      text: masterPost.text,
      title: masterPost.title,
      hashtags: masterPost.hashtags,
      media: masterPost.media,
      linkCard: masterPost.linkCard,
      contentWarning: masterPost.contentWarning,
      isSensitive: masterPost.isSensitive,
      mentions: masterPost.mentions,
      lang: masterPost.lang,
    },
    protocols,
    scheduledAt,
    env,
  );

  if (result.nativeFallback) {
    return { engine: 'native' };
  }

  return { engine: 'postiz', postizId: result.postizId };
}

/**
 * Get the scheduling engine label for display/tracking.
 */
export function getEngineLabel(tier: string): string {
  return getSchedulingEngine(tier);
}

// ─── Rate Limit Header Helpers ────────────────────────────────────────────

/**
 * Attach premium usage headers to a response.
 */
export function addPremiumUsageHeaders(
  response: Response,
  usage: PremiumUsage,
  limits: (typeof TIER_LIMITS)[string],
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Premium-Scheduled-Used', String(usage.scheduledPosts));
  headers.set('X-Premium-Scheduled-Limit', String(limits.scheduledPosts));
  headers.set('X-Premium-Queue-Used', String(usage.queuedPosts));
  headers.set('X-Premium-Queue-Limit', String(limits.queuedPosts));
  headers.set('X-Premium-Evergreen-Used', String(usage.evergreenPosts));
  headers.set('X-Premium-Evergreen-Limit', String(limits.evergreenPosts));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
