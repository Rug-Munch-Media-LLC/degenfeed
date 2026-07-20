# Tiered Pricing Model Implementation Plan

> **For agentic workers:** Execute tasks in order. Each task depends on previous ones.

**Goal:** Build a complete 4-tier pricing model (Basic/Pro/Platinum/Enterprise) with feature gating middleware, API endpoints, and updated premium landing page.

**Architecture:** Uses existing Hono API + Next.js frontend patterns. KV-backed subscription storage. Middleware-based feature gating with 402 Payment Required responses.

**Tech Stack:** Hono (Cloudflare Workers), Next.js 14, TypeScript, KV Namespace, Tailwind CSS

## Global Constraints
- Follow existing code patterns (Hono route handlers, JSON responses, session auth)
- No new dependencies beyond what's already in package.json
- All monetary values in USD cents internally
- Tier names: basic, pro, platinum, enterprise
- Token generation fee: $20 per additional creator coin on Pro tier

---

### Task 1: Update Premium Tier Types & Helpers

**Files:**
- Modify: `workers/api/src/premium.ts`

**Interfaces:**
- Consumes: Existing `Env`, `jsonResponse` from `./index`
- Produces: Updated `PremiumTier` type, `TIER_RANK` map, exported helpers

- [ ] **Step 1: Rewrite premium.ts with new tier types**

```typescript
/**
 * @degenfeed/api-worker — Premium tier helpers
 *
 * Shared utilities for premium-gating features.
 * Updated for 4-tier model: basic, pro, platinum, enterprise
 */

import type { Env } from "./index";
import { jsonResponse } from "./index";

export type PremiumTier = "basic" | "pro" | "platinum" | "enterprise";

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
  basic: "Basic",
  pro: "Pro",
  platinum: "Platinum",
  enterprise: "Enterprise",
};

/**
 * Feature-to-tier mapping.
 * Each feature requires the listed tier or higher.
 */
export const FEATURE_TIER_REQUIREMENTS: Record<string, PremiumTier> = {
  post_all_protocols: "pro",
  creator_coins: "pro",
  live_streaming: "pro",
  analytics_basic: "pro",
  scheduled_posts: "pro",
  create_communities: "pro",
  token_gated_content: "pro",
  custom_profile: "pro",
  unlimited_creator_coins: "platinum",
  multi_creator_collab: "platinum",
  analytics_advanced: "platinum",
  cross_network_posting: "platinum",
  buffer_scheduling: "platinum",
  telegram_discord_integration: "platinum",
  unlimited_communities: "platinum",
  custom_domain: "platinum",
  priority_support: "platinum",
  api_access: "platinum",
  early_protocol_access: "platinum",
  self_host: "enterprise",
  white_label: "enterprise",
  custom_integrations: "enterprise",
  dedicated_infra: "enterprise",
  sla_guarantee: "enterprise",
  team_management: "enterprise",
  sso_saml: "enterprise",
  custom_contract: "enterprise",
};

/** Tier limits for non-binary features */
export const TIER_LIMITS: Record<string, {
  protocols: number;
  creatorCoins: number;
  communities: number;
  scheduledPosts: number;
}> = {
  basic: { protocols: 3, creatorCoins: 0, communities: 0, scheduledPosts: 0 },
  pro: { protocols: 999, creatorCoins: 1, communities: 3, scheduledPosts: 50 },
  platinum: { protocols: 999, creatorCoins: 999, communities: 999, scheduledPosts: 999 },
  enterprise: { protocols: 999, creatorCoins: 999, communities: 999, scheduledPosts: 999 },
};

export const TOKEN_GENERATION_FEE_USD = 20;

export function hasTierAccess(userTier: string, requiredTier: PremiumTier): boolean {
  const userRank = TIER_RANK[userTier] ?? -1;
  const requiredRank = TIER_RANK[requiredTier] ?? 0;
  return userRank >= requiredRank;
}

export function getTierName(tier: string): string {
  return TIER_NAMES[tier as PremiumTier] || "Basic";
}

/**
 * Look up the premium subscription status for a wallet address.
 * Checks both legacy (solana:/ethereum: prefix) and current (premium: prefix)
 * SUBSCRIPTIONS KV schemas. Supports all 4 tiers.
 */
export async function checkPremiumStatus(
  walletAddress: string,
  env: Env,
): Promise<PremiumStatus | null> {
  if (!env.SUBSCRIPTIONS) return null;

  const address = walletAddress.toLowerCase();
  const now = Date.now();

  try {
    // Legacy schema: identity-prefixed keys
    for (const prefix of ["solana:", "ethereum:"]) {
      const raw = await env.SUBSCRIPTIONS.get(`${prefix}${address}`);
      if (raw) {
        const record = JSON.parse(raw) as { tier: string; expiresAt: number };
        if (record.expiresAt > now) {
          return { tier: record.tier as PremiumTier, expiresAt: record.expiresAt };
        }
      }
    }

    // Current schema: premium: prefix
    const premRaw = await env.SUBSCRIPTIONS.get(`premium:${address}`);
    if (premRaw) {
      const record = JSON.parse(premRaw) as {
        tier: string;
        expiresAt: number;
        status?: string;
      };
      if (record.status !== "cancelled" && record.expiresAt > now) {
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
 * Returns a 402 Response when the user does NOT meet the required tier.
 * Returns null when the check passes.
 */
export async function requirePremiumTier(
  walletAddress: string,
  env: Env,
  minTier: PremiumTier = "pro",
): Promise<Response | null> {
  const status = await checkPremiumStatus(walletAddress, env);

  if (!status) {
    const label = getTierName(minTier);
    return jsonResponse(
      {
        error: `${label} subscription required. Upgrade at /premium to unlock this feature.`,
        upgrade: true,
        requiredTier: minTier,
      },
      402,
      { "X-Premium-Required": label },
    );
  }

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
      { "X-Premium-Required": label },
    );
  }

  return null;
}

export function addPremiumHeader(response: Response, tier: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Premium-Required", tier);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd workers/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to premium.ts

### Task 2: Create Feature Gate Middleware

**Files:**
- Create: `workers/api/src/lib/tier-gate.ts`

**Interfaces:**
- Consumes: `Env`, `SessionPayload` from session.ts, `PremiumTier`, `hasTierAccess`, `TIER_LIMITS`, `FEATURE_TIER_REQUIREMENTS`, `checkPremiumStatus` from premium.ts
- Produces: `requireTier()`, `requireFeature()`, `getCurrentUsage()`, `getRecommendedTier()` functions

- [ ] **Step 1: Create tier-gate.ts**

```typescript
/**
 * @degenfeed/api-worker — Tier gate middleware
 *
 * Feature-gating middleware for Hono routes.
 * Use `requireTier('pro')` to gate entire routes.
 * Use `requireFeature('analytics_advanced')` for specific features.
 */

import type { Context, Next } from "hono";
import type { Env } from "../index";
import { jsonResponse } from "../index";
import type { SessionPayload } from "../session";
import {
  checkPremiumStatus,
  FEATURE_TIER_REQUIREMENTS,
  hasTierAccess,
  TIER_LIMITS,
  type PremiumTier,
} from "../premium";

// ─── KV key patterns for usage tracking ────────────────────────────────────

const USAGE_PREFIX = "usage:";

function coinDeployKey(address: string): string {
  return `${USAGE_PREFIX}coin:deploy:${address.toLowerCase()}`;
}

function postCountKey(address: string): string {
  return `${USAGE_PREFIX}posts:${address.toLowerCase()}`;
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

export async function getCurrentUsage(
  env: Env,
  walletAddress: string,
): Promise<TierUsage> {
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

export async function incrementCoinDeployCount(
  env: Env,
  walletAddress: string,
): Promise<number> {
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

export function getRecommendedTier(usage: TierUsage): PremiumTier {
  if (usage.creatorCoinsDeployed > 1 || usage.communitiesCreated >= 3) {
    return "platinum";
  }
  if (usage.creatorCoinsDeployed > 0 || usage.communitiesCreated > 0) {
    return "pro";
  }
  return "basic";
}

// ─── Hono middleware ────────────────────────────────────────────────────────

/**
 * Gate a route to a minimum tier.
 * Usage: `app.get('/api/foo', requireTier('pro'), handler)`
 */
export function requireTier(minTier: PremiumTier) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const session: SessionPayload | undefined = c.get("session");
    const walletAddress = session?.address;
    if (!walletAddress) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const status = await checkPremiumStatus(walletAddress, c.env);
    const userTier = status?.tier || "basic";

    if (!hasTierAccess(userTier, minTier)) {
      return jsonResponse(
        {
          error: `${minTier} tier required`,
          currentTier: userTier,
          upgradeUrl: "/premium",
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
 * Usage: `app.get('/api/analytics', requireFeature('analytics_advanced'), handler)`
 */
export function requireFeature(feature: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const session: SessionPayload | undefined = c.get("session");
    const walletAddress = session?.address;
    if (!walletAddress) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const status = await checkPremiumStatus(walletAddress, c.env);
    const userTier = status?.tier || "basic";
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
          upgradeUrl: "/premium",
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

export async function checkTierLimit(
  env: Env,
  walletAddress: string,
  limitType: keyof typeof TIER_LIMITS.basic,
): Promise<LimitCheckResult> {
  const status = await checkPremiumStatus(walletAddress, env);
  const userTier = status?.tier || "basic";
  const limits = TIER_LIMITS[userTier] || TIER_LIMITS.basic;
  const limit = limits[limitType] ?? 0;
  const usage = await getCurrentUsage(env, walletAddress);

  let current = 0;
  switch (limitType) {
    case "protocols":
      current = usage.protocolsUsed;
      break;
    case "creatorCoins":
      current = usage.creatorCoinsDeployed;
      break;
    case "communities":
      current = usage.communitiesCreated;
      break;
    case "scheduledPosts":
      current = usage.scheduledPostsUsed;
      break;
  }

  const allowed = current < limit;
  return {
    allowed,
    limit,
    current,
    error: allowed ? undefined : `Limit reached (${current}/${limit}). Upgrade for more.`,
    upgradeUrl: allowed ? undefined : "/premium",
  };
}
```

- [ ] **Step 2: Compile check**

Run: `cd workers/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compilation

### Task 3: Create Tier API Routes

**Files:**
- Create: `workers/api/src/routes/tiers.ts`

**Interfaces:**
- Consumes: `Env`, `jsonResponse` from `../index`, `PremiumTier`, `TIER_LIMITS`, `TIER_NAMES`, `FEATURE_TIER_REQUIREMENTS`, `TOKEN_GENERATION_FEE_USD` from `../premium`, `requireSession` from `../session`, `getCurrentUsage`, `getRecommendedTier`, `incrementCoinDeployCount` from `../lib/tier-gate`
- Produces: `tiers` Hono router, exported handlers for app.ts

- [ ] **Step 1: Create tiers.ts**

```typescript
/**
 * @degenfeed/api-worker — Tier management routes
 *
 * GET    /api/tiers        — Get all tier definitions
 * GET    /api/tiers/me     — Current user's tier + usage + limits
 * POST   /api/tiers/upgrade — Initiate tier upgrade (Stripe/on-chain)
 */

import { Hono } from "hono";
import type { Env } from "../index";
import { jsonResponse, noCacheJsonResponse } from "../index";
import {
  TIER_LIMITS,
  TIER_NAMES,
  FEATURE_TIER_REQUIREMENTS,
  TOKEN_GENERATION_FEE_USD,
  checkPremiumStatus,
  hasTierAccess,
  type PremiumTier,
} from "../premium";
import { requireSession } from "../session";
import { getCurrentUsage, getRecommendedTier } from "../lib/tier-gate";

// ─── Tier definitions ───────────────────────────────────────────────────────

interface TierFeature {
  name: string;
  key: string;
  included: boolean;
}

interface TierDefinition {
  id: PremiumTier | "enterprise";
  name: string;
  price: string;
  popular: boolean;
  description: string;
  features: TierFeature[];
  limits: {
    protocols: number;
    creatorCoins: number;
    communities: number;
    scheduledPosts: number;
  };
}

const ALL_FEATURES: TierDefinition[] = [
  {
    id: "basic",
    name: "Basic",
    price: "$0",
    popular: false,
    description: "Browse everything, join communities, tip creators — free forever.",
    features: [
      { name: "Verified badge", key: "verified_badge", included: true },
      { name: "Post to 3 protocols", key: "post_3_protocols", included: true },
      { name: "Browse all content", key: "browse_all", included: true },
      { name: "Join communities", key: "join_communities", included: true },
      { name: "Tip creators (free)", key: "free_tipping", included: true },
      { name: "Basic profile", key: "basic_profile", included: true },
      { name: "Creator coins", key: "creator_coins", included: false },
      { name: "Live streaming", key: "live_streaming", included: false },
      { name: "Cross-post scheduling", key: "scheduling", included: false },
      { name: "Analytics", key: "analytics", included: false },
    ],
    limits: TIER_LIMITS.basic,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$10/mo",
    popular: true,
    description: "Full creator toolkit. Post everywhere, launch coins, livestream.",
    features: [
      { name: "Everything in Basic", key: "everything_basic", included: true },
      { name: "Post to ALL protocols (12+)", key: "post_all_protocols", included: true },
      { name: "Creator coins (1 free, $20 each additional)", key: "creator_coins", included: true },
      { name: "Live streaming (solo, spaces)", key: "live_streaming", included: true },
      { name: "Basic analytics", key: "analytics_basic", included: true },
      { name: "Scheduled posts", key: "scheduled_posts", included: true },
      { name: "Feddy Communities (create 3)", key: "create_communities", included: true },
      { name: "Token-gated content", key: "token_gated_content", included: true },
      { name: "Custom profile", key: "custom_profile", included: true },
    ],
    limits: TIER_LIMITS.pro,
  },
  {
    id: "platinum",
    name: "Platinum",
    price: "$25/mo",
    popular: false,
    description: "Power user. Unlimited coins, advanced analytics, cross-network scheduling.",
    features: [
      { name: "Everything in Pro", key: "everything_pro", included: true },
      { name: "UNLIMITED creator coins", key: "unlimited_creator_coins", included: true },
      { name: "Multi-creator collab streams", key: "multi_creator_collab", included: true },
      { name: "Advanced analytics dashboard", key: "analytics_advanced", included: true },
      { name: "Cross-network posting (X, YouTube, Reddit)", key: "cross_network_posting", included: true },
      { name: "Buffer-style scheduling (queue, calendar)", key: "buffer_scheduling", included: true },
      { name: "Telegram/Discord community integration", key: "telegram_discord_integration", included: true },
      { name: "UNLIMITED Feddy Communities", key: "unlimited_communities", included: true },
      { name: "Custom community domain", key: "custom_domain", included: true },
      { name: "Priority support", key: "priority_support", included: true },
      { name: "API access", key: "api_access", included: true },
      { name: "Early protocol access", key: "early_protocol_access", included: true },
    ],
    limits: TIER_LIMITS.platinum,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    popular: false,
    description: "Self-host, white-label, dedicated infrastructure for organizations.",
    features: [
      { name: "Everything in Platinum", key: "everything_platinum", included: true },
      { name: "Self-host option", key: "self_host", included: true },
      { name: "White-label", key: "white_label", included: true },
      { name: "Custom protocol integrations", key: "custom_integrations", included: true },
      { name: "Dedicated infrastructure", key: "dedicated_infra", included: true },
      { name: "SLA guarantee", key: "sla_guarantee", included: true },
      { name: "Team management", key: "team_management", included: true },
      { name: "SSO / SAML", key: "sso_saml", included: true },
      { name: "Custom contract & pricing", key: "custom_contract", included: true },
    ],
    limits: TIER_LIMITS.enterprise,
  },
];

// ─── Hono router ────────────────────────────────────────────────────────────

const tiers = new Hono<{ Bindings: Env }>();

// GET /api/tiers — Get all tiers
tiers.get("/", async (c) => {
  return c.json({
    tiers: ALL_FEATURES,
    tokenGenerationFee: {
      amount: TOKEN_GENERATION_FEE_USD,
      currency: "USD",
      description: "One-time fee per creator coin deployment. Covers gas + platform costs.",
    },
  });
});

// GET /api/tiers/me — Current user's tier + usage + limits
tiers.get("/me", async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;
  const status = await checkPremiumStatus(walletAddress, c.env);
  const tier: PremiumTier = status?.tier || "basic";
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.basic;
  const usage = await getCurrentUsage(c.env, walletAddress);

  return noCacheJsonResponse({
    tier,
    tierName: TIER_NAMES[tier] || "Basic",
    isPremium: tier !== "basic",
    expiresAt: status?.expiresAt ? new Date(status.expiresAt).toISOString() : null,
    limits,
    usage,
    canUpgrade: tier !== "enterprise",
    recommendedTier: getRecommendedTier(usage),
    features: Object.entries(FEATURE_TIER_REQUIREMENTS).map(([key, requiredTier]) => ({
      key,
      accessible: hasTierAccess(tier, requiredTier),
      requiredTier,
    })),
  });
});

// POST /api/tiers/upgrade — Upgrade tier (redirect to billing)
tiers.post("/upgrade", async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  let body: { tier?: string };
  try {
    body = await c.req.json() as { tier?: string };
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const targetTier = body.tier;
  const validTiers = ["pro", "platinum", "enterprise"];
  if (!targetTier || !validTiers.includes(targetTier)) {
    return jsonResponse({ error: "Invalid tier. Use pro, platinum, or enterprise." }, 400);
  }

  // Check if already on this tier or higher
  const current = await checkPremiumStatus(session.address, c.env);
  if (current && hasTierAccess(current.tier, targetTier as PremiumTier)) {
    return jsonResponse({
      error: `Already on ${TIER_NAMES[current.tier] || current.tier} tier or higher`,
      currentTier: current.tier,
    }, 409);
  }

  // Redirect to billing checkout
  const url = new URL(c.req.url);
  const origin = `${url.protocol}//${url.host}`;
  return jsonResponse({
    redirectUrl: `${origin}/api/billing/checkout?tier=${targetTier}`,
    tier: targetTier,
    message: `Redirecting to checkout for ${TIER_NAMES[targetTier as PremiumTier] || targetTier} plan.`,
  });
});

export default tiers;
```

### Task 4: Register Tiers Routes in app.ts

**Files:**
- Modify: `workers/api/src/app.ts`

- [ ] **Step 1: Add import and route registration**

Add after the billing routes section:

```typescript
// ─── API: Tiers ───────────────────────────────────────────────
import tiers from './routes/tiers';
app.route('/api/tiers', tiers);
```

### Task 5: Update usePremium Hook

**Files:**
- Modify: `apps/web/src/hooks/usePremium.ts`

- [ ] **Step 1: Update tier types and config**

Update the `PremiumTier` type to include the new tiers:

```typescript
export type PremiumTier = 'basic' | 'pro' | 'platinum' | 'enterprise';
```

Update the `TIERS` array to reflect the 4-tier model:

```typescript
export const TIERS: TierConfig[] = [
  {
    id: 'basic',
    name: 'Basic',
    displayName: 'Basic',
    price: '$0',
    priceCents: 0,
    description: 'Browse everything, join communities, tip creators — free forever.',
    features: [
      'Verified badge',
      'Post to 3 protocols',
      'Browse all content',
      'Join communities',
      'Tip creators (free)',
      'Basic profile',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    price: '$10/mo',
    priceCents: 1000,
    description: 'Full creator toolkit. Post everywhere, launch coins, livestream.',
    features: [
      'Everything in Basic',
      'Post to ALL 12+ protocols',
      'Creator coins (1 free, $20/ea)',
      'Live streaming (solo, spaces)',
      'Basic analytics',
      'Scheduled posts',
      'Feddy Communities (create 3)',
      'Token-gated content',
      'Custom profile',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    displayName: 'Platinum',
    price: '$25/mo',
    priceCents: 2500,
    description: 'Power user. Unlimited coins, advanced analytics, cross-network scheduling.',
    features: [
      'Everything in Pro',
      'UNLIMITED creator coins',
      'Multi-creator collab streams',
      'Advanced analytics dashboard',
      'Cross-network posting (X, YouTube, Reddit)',
      'Buffer-style scheduling (queue, calendar)',
      'Telegram/Discord community integration',
      'UNLIMITED Feddy Communities',
      'Custom community domain',
      'Priority support',
      'API access',
      'Early protocol access',
    ],
    cta: 'Go Platinum',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Enterprise',
    price: 'Custom',
    priceCents: 0,
    description: 'Self-host, white-label, dedicated infrastructure for organizations.',
    features: [
      'Everything in Platinum',
      'Self-host option',
      'White-label',
      'Custom protocol integrations',
      'Dedicated infrastructure',
      'SLA guarantee',
      'Team management',
      'SSO / SAML',
      'Custom contract & pricing',
    ],
    cta: 'Contact us',
    popular: false,
  },
];
```

Update the `usePremium` hook's fetch to handle the tiers/me endpoint as a fallback, and ensure the status API response maps correctly.

### Task 6: Update PricingTable Component

**Files:**
- Modify: `apps/web/src/components/pricing/PricingTable.tsx`

- [ ] **Step 1: Rewrite comparison table for 4 tiers**

Update `PricingTier` type to include `badge` already there. Update `getDefaultTiers()` with 4 tiers matching the spec. Update `COMPARISON_ROWS` to include all features.

### Task 7: Update Premium Page

**Files:**
- Modify: `apps/web/src/app/premium/page.tsx`

- [ ] **Step 1: Rewrite premium page with new tier grid, FAQ, enterprise contact**

Complete rewrite showing 4-tier cards, comparison table, FAQ with enterprise contact section, token fee explainer.
