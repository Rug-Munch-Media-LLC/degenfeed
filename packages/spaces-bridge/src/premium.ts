/**
 * @degenfeed/spaces-bridge — Premium Spaces Gating
 *
 * Three tiers of access control for Spaces:
 *   1. Token-gated: Must hold minimum balance of creator coin
 *   2. Subscriber-only: Must have active subscription
 *   3. Paid/x402: Must pay to enter (Lightning or EVM)
 *
 * Each gate type can be combined with any platform.
 * Gating is enforced at the API level and optionally at the stream level
 * (e.g., PeerTube can use its built-in privacy; LivePeer can use JWT playback).
 */

import type { SpaceGating } from './types';

// ─── Token Gating ───────────────────────────────────────────────────────

export interface TokenGateResult {
  allowed: boolean;
  reason?: string;
  /** Actual balance held by user */
  balance?: string;
  /** Minimum required */
  required?: string;
}

/**
 * Check if a user holds enough of a creator token.
 * Queries the token contract for the user's balance and compares
 * against the gating threshold.
 */
export async function checkTokenGate(
  userAddress: string,
  gating: SpaceGating,
): Promise<TokenGateResult> {
  if (gating.type !== 'token' || !gating.tokenAddress) {
    return { allowed: true };
  }

  try {
    // Use the existing token-gate package
    const { checkTokenGate: checkGate } = await import('@degenfeed/token-gate');
    const chainMap: Record<string, 'ethereum' | 'base' | 'polygon' | 'solana' | 'arbitrum' | 'optimism'> = {
      1: 'ethereum',
      8453: 'base',
      137: 'polygon',
      101: 'solana',
      42161: 'arbitrum',
      10: 'optimism',
    };
    const allowed = await checkGate(
      {
        chain: chainMap[gating.chainId ?? 1] ?? 'ethereum',
        type: 'erc20',
        contractAddress: gating.tokenAddress!,
        minBalance: Number(gating.minBalance ?? '1'),
      },
      userAddress,
    );

    return {
      allowed,
      reason: allowed ? undefined : `Need ${gating.minBalance ?? '1'} tokens`,
      balance: '0',
      required: gating.minBalance ?? '1',
    };
  } catch (e) {
    console.warn('[premium-gate] Token gate check failed:', e);
    return { allowed: false, reason: 'Gate check unavailable' };
  }
}

// ─── Subscription Gating ────────────────────────────────────────────────

export interface SubscriptionGateResult {
  allowed: boolean;
  reason?: string;
  tier?: string;
  expiresAt?: number;
}

/**
 * Check if a user has an active subscription.
 * Integrates with the DegenFeed subscription system.
 */
export async function checkSubscriptionGate(
  userId: string,
  gating: SpaceGating,
): Promise<SubscriptionGateResult> {
  if (gating.type !== 'subscription') {
    return { allowed: true };
  }

  try {
    // Query subscription status from the subscription service
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8787';
    const res = await fetch(`${baseUrl}/api/subscriptions/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId,
        requiredTier: gating.subscriptionTier ?? 'basic',
      }),
    });

    if (!res.ok) {
      return { allowed: false, reason: 'Subscription check failed' };
    }

    const data = (await res.json()) as {
      active: boolean;
      tier?: string;
      expiresAt?: number;
    };

    return {
      allowed: data.active,
      reason: data.active ? undefined : 'Active subscription required',
      tier: data.tier,
      expiresAt: data.expiresAt,
    };
  } catch (e) {
    console.warn('[premium-gate] Subscription check failed:', e);
    return { allowed: false, reason: 'Subscription service unavailable' };
  }
}

// ─── Payment / x402 Gating ──────────────────────────────────────────────

export interface PaymentGateResult {
  allowed: boolean;
  reason?: string;
  /** Payment address/endpoint for x402 */
  paymentUrl?: string;
  /** Amount required */
  amount?: string;
}

/**
 * Check if a user has paid for access to a paid space.
 * Uses the x402 payment-gated API pattern.
 */
export async function checkPaymentGate(
  userId: string,
  gating: SpaceGating,
): Promise<PaymentGateResult> {
  if (gating.type !== 'payment') {
    return { allowed: true };
  }

  // Check for existing payment receipt
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8787';
    const res = await fetch(`${baseUrl}/api/spaces/payments/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId,
        amount: gating.paymentAmount,
        token: gating.paymentToken,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { paid: boolean };
      if (data.paid) return { allowed: true };
    }
  } catch {
    // Fall through to payment required
  }

  return {
    allowed: false,
    reason: 'Payment required',
    paymentUrl: `/api/spaces/payments/create?amount=${gating.paymentAmount ?? '0'}&token=${gating.paymentToken ?? 'eth'}`,
    amount: gating.paymentAmount,
  };
}

// ─── Unified Gate Check ────────────────────────────────────────────────

export interface UnifiedGateResult {
  allowed: boolean;
  reason?: string;
  gates: {
    token?: TokenGateResult;
    subscription?: SubscriptionGateResult;
    payment?: PaymentGateResult;
  };
}

/**
 * Check all gates for a space.
 * If gating is 'none', always allowed.
 * All configured gates must pass.
 */
export async function checkAllGates(
  userId: string,
  userAddress: string | undefined,
  gating: SpaceGating,
): Promise<UnifiedGateResult> {
  if (!gating || gating.type === 'none') {
    return { allowed: true, gates: {} };
  }

  const results: UnifiedGateResult['gates'] = {};

  if (gating.type === 'token' && userAddress) {
    results.token = await checkTokenGate(userAddress, gating);
  }

  if (gating.type === 'subscription') {
    results.subscription = await checkSubscriptionGate(userId, gating);
  }

  if (gating.type === 'payment') {
    results.payment = await checkPaymentGate(userId, gating);
  }

  const allAllowed = Object.values(results).every((r) => r?.allowed ?? true);
  const firstFailure = Object.values(results).find((r) => !r?.allowed);

  return {
    allowed: allAllowed,
    reason: firstFailure?.reason,
    gates: results,
  };
}

// ─── Client-side gate badge helper ─────────────────────────────────────

/**
 * Returns a user-friendly label for the gate type.
 */
export function getGateLabel(gating?: SpaceGating): string {
  if (!gating || gating.type === 'none') return '';
  switch (gating.type) {
    case 'token':
      return `🔑 Token Required`;
    case 'subscription':
      return `⭐ Subscriber Only`;
    case 'payment':
      return `💰 Paid Space`;
    default:
      return '';
  }
}

/**
 * Returns the gate badge color based on type.
 */
export function getGateColor(gating?: SpaceGating): string {
  if (!gating || gating.type === 'none') return '';
  switch (gating.type) {
    case 'token':
      return 'amber';
    case 'subscription':
      return 'purple';
    case 'payment':
      return 'emerald';
    default:
      return 'gray';
  }
}
