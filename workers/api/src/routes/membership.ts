/**
 * @degenfeed/api-worker — Membership Tier API Routes
 *
 * GET    /api/membership/tier             — Current user's tier + status
 * GET    /api/membership/features         — All features + which are unlocked
 * POST   /api/membership/upgrade          — Upgrade tier (process on-chain payment)
 * GET    /api/membership/history          — Payment history
 * POST   /api/membership/cancel           — Cancel subscription
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  cancelMembership,
  FEATURE_GROUPS,
  type FeatureDef,
  getLockedFeatures,
  getMembership,
  getNextTier,
  getUserTier,
  hasTierAccess,
  TIER_INFO,
  TIER_LIMITS,
  type Tier,
  upgradeTier,
} from '../lib/membership-tiers';
import { requireSession } from '../session';

// ─── Hono Router ────────────────────────────────────────────────────────────

const membership = new Hono<{ Bindings: Env }>();

// ─── GET /api/membership/tier ────────────────────────────────────────────────
// Returns the current user's tier, subscription status, and next billing info.

membership.get('/tier', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const tier = await getUserTier(wallet, c.env);
  const record = await getMembership(wallet, c.env);

  return noCacheJsonResponse({
    tier,
    tierInfo: TIER_INFO[tier],
    isPremium: tier !== 'free',
    status: record?.status ?? 'active',
    expiresAt: record?.expiresAt ? new Date(record.expiresAt).toISOString() : null,
    activatedAt: record?.activatedAt ? new Date(record.activatedAt).toISOString() : null,
    autoRenew: record?.autoRenew ?? false,
    billingMethod: record?.billingMethod ?? 'none',
    trialEndsAt: record?.trialEndsAt ? new Date(record.trialEndsAt).toISOString() : null,
    limits: TIER_LIMITS[tier],
    canUpgrade: tier !== 'enterprise',
    nextTier: getNextTier(tier),
  });
});

// ─── GET /api/membership/features ────────────────────────────────────────────
// Returns all features organized by group, with unlocked status.

membership.get('/features', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const tier = await getUserTier(session.address, c.env);

  const features = FEATURE_GROUPS.map((group) => ({
    category: group.category,
    features: group.features.map((f: FeatureDef) => ({
      key: f.key,
      label: f.label,
      description: f.description,
      minTier: f.minTier,
      unlocked: hasTierAccess(tier, f.minTier),
    })),
  }));

  const unlockedCount = features.reduce(
    (sum, g) => sum + g.features.filter((f: { unlocked: boolean }) => f.unlocked).length,
    0,
  );
  const totalCount = features.reduce((sum, g) => sum + g.features.length, 0);
  const lockedFeatures = getLockedFeatures(tier);

  return noCacheJsonResponse({
    tier,
    tierInfo: TIER_INFO[tier],
    features,
    unlockedCount,
    totalCount,
    lockedCount: lockedFeatures.length,
    lockedFeatures: lockedFeatures.map((f: FeatureDef) => ({
      key: f.key,
      label: f.label,
      minTier: f.minTier,
      upgradeTo: getNextTier(tier),
    })),
    upgradeUrl: '/membership',
  });
});

// ─── POST /api/membership/upgrade ────────────────────────────────────────────
// Process a tier upgrade. Expects on-chain payment verification or redirect.

membership.post('/upgrade', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  interface UpgradeBody {
    tier: string;
    txHash?: string;
    period?: 'monthly' | 'annual';
  }

  let body: UpgradeBody;
  try {
    body = (await c.req.json()) as UpgradeBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const targetTier = body.tier as Tier;
  const validTiers: Tier[] = ['pro', 'creator', 'enterprise'];

  if (!targetTier || !validTiers.includes(targetTier)) {
    return jsonResponse(
      {
        error: `Invalid tier. Must be one of: ${validTiers.join(', ')}`,
        validTiers,
      },
      400,
    );
  }

  const wallet = session.address;
  const currentTier = await getUserTier(wallet, c.env);

  // Check if already on this tier or higher
  if (hasTierAccess(currentTier, targetTier)) {
    return jsonResponse(
      {
        error: `Already on ${TIER_INFO[targetTier].name} tier or higher`,
        currentTier,
      },
      409,
    );
  }

  // If txHash is provided, verify and process the upgrade
  if (body.txHash) {
    const result = await upgradeTier(wallet, targetTier, c.env, {
      txHash: body.txHash,
      amount: TIER_INFO[targetTier].price,
      currency: 'USD',
      period: body.period ?? 'monthly',
    });

    if (!result.success) {
      return jsonResponse({ error: result.error ?? 'Upgrade failed' }, 400);
    }

    return noCacheJsonResponse({
      success: true,
      message: `Upgraded to ${TIER_INFO[targetTier].name} tier!`,
      tier: targetTier,
      tierInfo: TIER_INFO[targetTier],
    });
  }

  // No txHash — return payment requirements
  const price = TIER_INFO[targetTier].price;
  return jsonResponse({
    requiresPayment: true,
    tier: targetTier,
    tierInfo: TIER_INFO[targetTier],
    amount: price,
    currency: 'USD',
    period: body.period ?? 'monthly',
    message: `Send ${price} USDC to upgrade to ${TIER_INFO[targetTier].name}.`,
    // Payment address — in production, this would be a unique deposit address
    paymentAddress: null,
    // Or redirect to Stripe checkout
    checkoutUrl: `/api/billing/checkout?tier=${targetTier}`,
  });
});

// ─── GET /api/membership/history ─────────────────────────────────────────────
// Returns payment history for the current user.

membership.get('/history', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const record = await getMembership(session.address, c.env);

  return noCacheJsonResponse({
    payments: record?.paymentHistory ?? [],
    totalSpent: (record?.paymentHistory ?? [])
      .filter((p) => p.status === 'confirmed')
      .reduce((sum, p) => sum + p.amount, 0),
    currency: record?.paymentHistory[0]?.currency ?? 'USD',
  });
});

// ─── POST /api/membership/cancel ─────────────────────────────────────────────
// Cancel subscription. Tier remains active until expiry.

membership.post('/cancel', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const result = await cancelMembership(session.address, c.env);

  if (!result.success) {
    return jsonResponse({ error: 'No active subscription found' }, 404);
  }

  return jsonResponse({
    success: true,
    message: 'Subscription cancelled. Your tier remains active until expiry.',
    expiresAt: new Date(result.expiresAt).toISOString(),
  });
});

// ─── POST /api/membership/verify-payment ─────────────────────────────────────
// Verify an on-chain payment for tier upgrade.

membership.post('/verify-payment', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  interface VerifyBody {
    tier: string;
    txHash: string;
    chain?: string;
  }

  let body: VerifyBody;
  try {
    body = (await c.req.json()) as VerifyBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.txHash) {
    return jsonResponse({ error: 'txHash is required' }, 400);
  }

  const targetTier = body.tier as Tier;
  if (!['pro', 'creator', 'enterprise'].includes(targetTier)) {
    return jsonResponse({ error: 'Invalid tier' }, 400);
  }

  const result = await upgradeTier(session.address, targetTier, c.env, {
    txHash: body.txHash,
    amount: TIER_INFO[targetTier].price,
    currency: 'USDC',
    period: 'monthly',
  });

  if (!result.success) {
    return jsonResponse({ error: result.error ?? 'Verification failed' }, 400);
  }

  return noCacheJsonResponse({
    success: true,
    message: `Payment verified. Upgraded to ${TIER_INFO[targetTier].name}!`,
    tier: targetTier,
  });
});

export default membership;
