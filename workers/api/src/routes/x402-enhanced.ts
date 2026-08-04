/**
 * @degenfeed/api-worker — x402 Enhanced Payment Integration
 *
 * Full x402 (402 Payment Required) payment-gated API with:
 *   1. Pay-to-tip: pay a small SOL amount to send a tip
 *   2. Token-gated content: pay SOL to unlock premium content
 *   3. Subscription via x402: recurring payment for access
 *   4. Premium tier upgrades: one-time upgrade payment
 *   5. All payments routed through the tipping ledger
 *
 * x402 flow:
 *   Request → 402 Payment Required with X-Payment-Required header
 *          → blink URL for the user to sign
 *          → POST proof to /verify → access granted
 *
 * @see https://x402.org
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import type { Env } from '../types';
import { jsonResponse } from '../response-helpers';
import { paymentRequired } from '../response-helpers';
import {
  hasSuspiciousPayload,
  isValidAmount,
  isValidSolanaAddress,
  sanitizeString,
} from '../sanitize';
import { recordUnifiedTip } from './unified-tip-core';

// ─── Types ───────────────────────────────────────────────────────────────────

export type X402Action =
  | 'tip' // Pay to send a tip
  | 'unlock' // Token-gated content
  | 'subscribe' // Recurring subscription
  | 'upgrade'; // Premium tier upgrade

export interface X402PaywallRequest {
  /** The action type */
  action: X402Action;
  /** Target recipient (creator, content ID, tier) */
  target: string;
  /** Amount in SOL to charge */
  amount: string;
  /** Optional creator label for display */
  label?: string;
  /** Optional content label */
  contentLabel?: string;
  /** Optional entity type for ledger */
  entityType?: string;
  /** Optional entity ID for ledger */
  entityId?: string;
  /** For subscriptions: interval in days */
  intervalDays?: number;
  /** For subscriptions: subscription plan ID */
  planId?: string;
  /** Success redirect URL */
  redirectUrl?: string;
}

export interface X402PaywallResponse {
  /** HTTP status (402) */
  status: number;
  /** Human-readable message */
  message: string;
  /** The SOL amount to pay */
  amount: string;
  /** Blink URL for the user to sign */
  blinkUrl: string;
  /** Type of paywall */
  actionType: X402Action;
  /** Payment ID for tracking */
  paymentId: string;
  /** Whether payment has a time-bound access */
  expiresAt?: number;
  /** For subscriptions: renewal info */
  subscriptionInfo?: {
    planId: string;
    intervalDays: number;
    nextBillingAt: number;
  };
}

export interface X402VerifyResult {
  ok: boolean;
  action: X402Action;
  target: string;
  amount: string;
  signature: string;
  /** Access granted token (for token-gated/unlock) */
  accessToken?: string;
  /** Subscription info if subscribe action */
  subscription?: {
    active: boolean;
    expiresAt: number;
    planId: string;
  };
  /** Premium tier info if upgrade action */
  premiumTier?: string;
  /** Activity ID in tipping ledger */
  activityId?: string;
}

// ─── Blink URL Builder ────────────────────────────────────────────────────

function buildX402BlinkUrl(baseUrl: string, params: X402PaywallRequest): string {
  const url = new URL(`${baseUrl}/api/blink/v2/tip`);
  url.searchParams.set('recipient', params.target);
  url.searchParams.set('fixed', params.amount);
  url.searchParams.set('entityType', params.action);
  if (params.entityId) url.searchParams.set('entityId', params.entityId);
  if (params.contentLabel) url.searchParams.set('entityLabel', params.contentLabel);
  return url.toString();
}

// ─── Shared: Generate x402 Payment Required Response ─────────────────────

export function x402PaywallResponse(
  req: X402PaywallRequest,
  env: Env,
  baseUrl: string,
): X402PaywallResponse {
  const paymentId = `x402:${req.action}:${req.target}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const blinkUrl = buildX402BlinkUrl(baseUrl, req);

  const response: X402PaywallResponse = {
    status: 402,
    message: getX402Message(req.action, req.label ?? req.target, req.amount),
    amount: req.amount,
    blinkUrl,
    actionType: req.action,
    paymentId,
  };

  // Subscription: set expiry
  if (req.action === 'subscribe' && req.intervalDays) {
    response.subscriptionInfo = {
      planId: req.planId ?? 'premium',
      intervalDays: req.intervalDays,
      nextBillingAt: Date.now() + req.intervalDays * 86_400_000,
    };
  }

  // Token-gated: set expiry
  if (req.action === 'unlock') {
    response.expiresAt = Date.now() + 86_400_000; // 24h access
  }

  return response;
}

function getX402Message(action: X402Action, label: string, amount: string): string {
  switch (action) {
    case 'tip':
      return `Send ${amount} SOL tip to ${label}`;
    case 'unlock':
      return `Pay ${amount} SOL to unlock "${label}"`;
    case 'subscribe':
      return `Subscribe to ${label} for ${amount} SOL`;
    case 'upgrade':
      return `Upgrade to ${label} for ${amount} SOL`;
    default:
      return `Payment of ${amount} SOL required`;
  }
}

// ─── 1. POST /api/x402/tip — Pay-to-tip flow ──────────────────────────────

export async function handleX402Tip(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const creator = sanitizeString(url.searchParams.get('creator'), 128);
  const amount = sanitizeString(url.searchParams.get('amount') || '0.001', 64);
  const label = sanitizeString(url.searchParams.get('label'), 256);
  const entityType = sanitizeString(url.searchParams.get('entityType'), 32);
  const entityId = sanitizeString(url.searchParams.get('entityId'), 256);

  if (
    !creator ||
    !isValidSolanaAddress(creator) ||
    !isValidAmount(amount) ||
    hasSuspiciousPayload(`${creator}${amount}`)
  ) {
    return jsonResponse({ error: 'Valid creator Solana address and amount required' }, 400);
  }

  const paywall = x402PaywallResponse(
    {
      action: 'tip',
      target: creator,
      amount,
      label: label || `Creator ${creator.slice(0, 6)}…`,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
    },
    env,
    `${url.protocol}//${url.host}`,
  );

  return paymentRequired(paywall.message, {
    'X-Payment-Required': `solana:${paywall.blinkUrl}`,
    'X-Payment-Id': paywall.paymentId,
    'X-Action-Type': 'tip',
  });
}

// ─── 2. POST /api/x402/unlock — Token-gated content ───────────────────────

export async function handleX402Unlock(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const contentId = sanitizeString(url.searchParams.get('contentId'), 256);
  const creator = sanitizeString(url.searchParams.get('creator'), 128);
  const amount = sanitizeString(url.searchParams.get('amount') || '0.001', 64);
  const contentLabel = sanitizeString(url.searchParams.get('contentLabel'), 512);

  if (!contentId || !isValidSolanaAddress(creator) || !isValidAmount(amount)) {
    return jsonResponse({ error: 'contentId, creator, and amount required' }, 400);
  }

  const paywall = x402PaywallResponse(
    {
      action: 'unlock',
      target: creator,
      amount,
      label: contentLabel || `Content ${contentId.slice(0, 8)}…`,
      contentLabel: contentLabel || undefined,
      entityId: contentId,
      entityType: 'content',
    },
    env,
    `${url.protocol}//${url.host}`,
  );

  return paymentRequired(paywall.message, {
    'X-Payment-Required': `solana:${paywall.blinkUrl}`,
    'X-Payment-Id': paywall.paymentId,
    'X-Action-Type': 'unlock',
    'X-Content-Id': contentId,
    'X-Access-Expires': String(paywall.expiresAt ?? ''),
  });
}

// ─── 3. POST /api/x402/subscribe — Subscription via x402 ──────────────────

export async function handleX402Subscribe(request: Request, env: Env): Promise<Response> {
  let body: {
    planId?: string;
    creator?: string;
    amount?: string;
    intervalDays?: number;
    label?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const planId = sanitizeString(body.planId, 64) || 'premium';
  const creator = sanitizeString(body.creator, 128);
  const amount = sanitizeString(body.amount || '0.005', 64);
  const intervalDays = body.intervalDays || 30;
  const label = sanitizeString(body.label, 256) || 'Premium Subscription';

  if (!creator || !isValidSolanaAddress(creator) || !isValidAmount(amount)) {
    return jsonResponse({ error: 'creator and amount required' }, 400);
  }

  const baseUrl = `${env.GOTOSOCIAL_INSTANCE_URL || 'https://degenfeed.xyz'}`;
  const paywall = x402PaywallResponse(
    {
      action: 'subscribe',
      target: creator,
      amount,
      label,
      planId,
      intervalDays,
      entityId: `sub:${planId}:${creator}`,
      entityType: 'subscription',
    },
    env,
    baseUrl,
  );

  // Store subscription intent
  try {
    await env.CACHE?.put(
      `x402:sub:intent:${planId}:${creator}`,
      JSON.stringify({
        planId,
        creator,
        amount,
        intervalDays,
        label,
        createdAt: Date.now(),
      }),
      { expirationTtl: 60 * 60 * 24 }, // 24h
    );
  } catch {
    // Non-critical
  }

  return paymentRequired(paywall.message, {
    'X-Payment-Required': `solana:${paywall.blinkUrl}`,
    'X-Payment-Id': paywall.paymentId,
    'X-Action-Type': 'subscribe',
    'X-Subscription-Plan': planId,
    'X-Subscription-Interval': String(intervalDays),
  });
}

// ─── 4. POST /api/x402/upgrade — Premium tier upgrade ─────────────────────

export async function handleX402Upgrade(request: Request, env: Env): Promise<Response> {
  let body: {
    tier?: string;
    creator?: string;
    amount?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const tier = sanitizeString(body.tier, 32) || 'premium';
  const creator = sanitizeString(body.creator, 128);
  const amount = sanitizeString(body.amount || '0.01', 64);

  if (!creator || !isValidSolanaAddress(creator) || !isValidAmount(amount)) {
    return jsonResponse({ error: 'creator and amount required' }, 400);
  }

  const baseUrl = `${env.GOTOSOCIAL_INSTANCE_URL || 'https://degenfeed.xyz'}`;
  const tierLabels: Record<string, string> = {
    premium: 'Premium Tier',
    pro: 'Pro Tier',
    enterprise: 'Enterprise Tier',
    supporter: 'Supporter Tier',
  };

  const paywall = x402PaywallResponse(
    {
      action: 'upgrade',
      target: creator,
      amount,
      label: tierLabels[tier] ?? `${tier} Tier`,
      entityId: `upgrade:${tier}:${creator}`,
      entityType: 'upgrade',
    },
    env,
    baseUrl,
  );

  return paymentRequired(paywall.message, {
    'X-Payment-Required': `solana:${paywall.blinkUrl}`,
    'X-Payment-Id': paywall.paymentId,
    'X-Action-Type': 'upgrade',
    'X-Upgrade-Tier': tier,
  });
}

// ─── 5. POST /api/x402/verify — Verify payment and grant access ──────────

export async function handleX402EnhancedVerify(request: Request, env: Env): Promise<Response> {
  let body: {
    proof?: string;
    action?: string;
    target?: string;
    amount?: string;
    paymentId?: string;
    planId?: string;
    tier?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const proof = sanitizeString(body.proof, 4096);
  const action = sanitizeString(body.action, 32) as X402Action;
  const target = sanitizeString(body.target, 128);
  const amount = sanitizeString(body.amount, 64);
  const paymentId = sanitizeString(body.paymentId, 128);

  if (!proof) {
    return jsonResponse({ error: 'proof required' }, 400);
  }

  try {
    // Verify the Solana transaction signature
    const bytes = Uint8Array.from(atob(proof), (c) => c.charCodeAt(0));
    const tx = Transaction.from(bytes);
    const ok = tx.verifySignatures();

    if (!ok) {
      return jsonResponse({ error: 'Invalid transaction signature' }, 400);
    }

    // Extract the sender from the transaction
    const feePayer = tx.feePayer?.toBase58();
    if (!feePayer || !isValidSolanaAddress(feePayer)) {
      return jsonResponse({ error: 'Could not determine sender from transaction' }, 400);
    }

    // Generate result based on action type
    const result: X402VerifyResult = {
      ok: true,
      action,
      target: target ?? 'unknown',
      amount: amount ?? '0',
      signature: tx.signatures?.[0]?.signature?.toString('hex') ?? '',
    };

    // Route through tipping ledger
    if (action === 'tip' && target && amount) {
      const amountNum = Number.parseFloat(amount);
      if (!Number.isNaN(amountNum) && amountNum > 0) {
        const solPrice = await fetchSolPriceX402(env);
        const amountUsd = Math.round(amountNum * solPrice * 100) / 100;
        const activity = await recordUnifiedTip(env, {
          platform: 'solana',
          entityId: `x402:tip:${target}:${Date.now()}`,
          entityType: 'post',
          amountUsd: Math.max(amountUsd, 0.01),
          fromUserId: feePayer,
          toUserId: target,
          fromLabel: `${feePayer.slice(0, 6)}…${feePayer.slice(-4)}`,
          toLabel: `Creator ${target.slice(0, 6)}…`,
          method: 'x402_tip',
        });
        result.activityId = activity?.id;
      }
    }

    if (action === 'unlock') {
      // Generate an access token (valid 24h)
      const accessToken = `x402:access:${target}:${Date.now() + 86_400_000}:${crypto.randomUUID().slice(0, 8)}`;
      result.accessToken = accessToken;

      // Store access grant
      try {
        await env.CACHE?.put(
          `x402:access:${target}:${feePayer}`,
          JSON.stringify({
            accessToken,
            contentId: target,
            grantedTo: feePayer,
            expiresAt: Date.now() + 86_400_000,
          }),
          { expirationTtl: 60 * 60 * 25 }, // 25h
        );
      } catch {
        // Non-critical
      }
    }

    if (action === 'subscribe') {
      const planId = body.planId ?? 'premium';
      const expiresAt = Date.now() + 30 * 86_400_000; // 30 days
      result.subscription = {
        active: true,
        expiresAt,
        planId,
      };

      // Store subscription
      try {
        await env.CACHE?.put(
          `x402:sub:${target}:${feePayer}`,
          JSON.stringify({
            planId,
            subscriber: feePayer,
            creator: target,
            active: true,
            expiresAt,
            lastPayment: Date.now(),
          }),
          { expirationTtl: 60 * 60 * 24 * 35 }, // 35 days
        );
      } catch {
        // Non-critical
      }
    }

    if (action === 'upgrade') {
      const tier = body.tier ?? 'premium';
      result.premiumTier = tier;

      // Store premium upgrade
      try {
        await env.CACHE?.put(
          `x402:upgrade:${target}:${feePayer}`,
          JSON.stringify({
            tier,
            upgradedAt: Date.now(),
            creator: target,
            subscriber: feePayer,
          }),
          { expirationTtl: 60 * 60 * 24 * 365 }, // 1 year
        );
      } catch {
        // Non-critical
      }
    }

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid proof';
    return jsonResponse({ error: message }, 400);
  }
}

// ─── GET /api/x402/status — Check access status ─────────────────────────

export async function handleX402Status(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const address = sanitizeString(url.searchParams.get('address'), 128);
  const contentId = sanitizeString(url.searchParams.get('contentId'), 256);

  if (!address || !contentId) {
    return jsonResponse({ error: 'address and contentId required' }, 400);
  }

  // Check access grants
  const accessRaw = await env.CACHE?.get(`x402:access:${contentId}:${address}`);
  if (accessRaw) {
    const access = JSON.parse(accessRaw) as { accessToken: string; expiresAt: number };
    if (access.expiresAt > Date.now()) {
      return jsonResponse({
        granted: true,
        accessToken: access.accessToken,
        expiresAt: access.expiresAt,
      });
    }
  }

  // Check subscription
  const subKey = `x402:sub:${contentId}:${address}`;
  const subRaw = await env.CACHE?.get(subKey);
  if (subRaw) {
    const sub = JSON.parse(subRaw) as { active: boolean; expiresAt: number; planId: string };
    if (sub.active && sub.expiresAt > Date.now()) {
      return jsonResponse({
        granted: true,
        subscription: {
          active: true,
          expiresAt: sub.expiresAt,
          planId: sub.planId,
        },
      });
    }
  }

  // Check premium upgrade
  const upgradeRaw = await env.CACHE?.get(`x402:upgrade:${contentId}:${address}`);
  if (upgradeRaw) {
    return jsonResponse({
      granted: true,
      upgraded: true,
      premiumTier: (JSON.parse(upgradeRaw) as { tier: string }).tier,
    });
  }

  return jsonResponse({ granted: false });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

let _cachedSolPriceX402: { price: number; at: number } | null = null;

async function fetchSolPriceX402(env: Env): Promise<number> {
  if (_cachedSolPriceX402 && Date.now() - _cachedSolPriceX402.at < 60_000) {
    return _cachedSolPriceX402.price;
  }
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { solana?: { usd?: number } };
      if (data.solana?.usd) {
        _cachedSolPriceX402 = { price: data.solana.usd, at: Date.now() };
        return data.solana.usd;
      }
    }
  } catch {
    // Fall through
  }
  return 150;
}
