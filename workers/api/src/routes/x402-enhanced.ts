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

import { SystemProgram, Transaction } from '@solana/web3.js';
import { jsonResponse, paymentRequired } from '../response-helpers';
import {
  hasSuspiciousPayload,
  isValidAmount,
  isValidSolanaAddress,
  sanitizeString,
} from '../sanitize';
import type { Env } from '../types';
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
  _env: Env,
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

// ─── Verify-time crypto/RPC helpers ───────────────────────────────────────

const X402_ACTION_SET: ReadonlySet<string> = new Set<X402Action>([
  'tip',
  'unlock',
  'subscribe',
  'upgrade',
]);

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Base58-encode bytes (for turning a raw Ed25519 signature into a tx signature string). */
function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digits: number[] = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i] ?? 0;
    for (let j = 0; j < digits.length; j++) {
      carry += (digits[j] ?? 0) << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = '';
  // Leading zero bytes encode as '1's (standard base58). A 64-byte Ed25519
  // signature is never all-zero, but keep the encoding faithful anyway.
  let k = 0;
  while (k < bytes.length && bytes[k] === 0 && !(digits.length === 1 && digits[0] === 0)) {
    out += '1';
    k++;
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i] ?? 0];
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Parse a decimal SOL amount into lamports (bigint) without float drift. */
function solToLamports(amount: string): bigint {
  const [whole = '0', frac = ''] = amount.trim().split('.');
  const frac9 = (frac + '000000000').slice(0, 9);
  return BigInt(whole || '0') * 1_000_000_000n + BigInt(frac9 || '0');
}

interface DecodedSystemTransfer {
  destination: string; // base58
  lamports: bigint;
}

/**
 * Decode SystemProgram.transfer instructions (variant index 2, 12-byte data)
 * from a legacy Solana transaction.
 *
 * @dev Only legacy `Transaction` payloads are decoded here — the blink flow
 *      produces legacy transfers. Versioned (v0) messages with loaded
 *      addresses are rejected by the strict decode and fail closed.
 */
function decodeSystemTransfers(tx: Transaction): DecodedSystemTransfer[] {
  const transfers: DecodedSystemTransfer[] = [];
  for (const ix of tx.instructions) {
    if (!ix.programId.equals(SystemProgram.programId)) continue;
    if (ix.keys.length < 2) continue;
    // Copy into a plain Uint8Array (no Node Buffer dependency in Workers).
    const data = Uint8Array.from(ix.data);
    if (data.length !== 12) continue;
    // 4-byte little-endian variant index; 2 = SystemProgram.transfer.
    const variant =
      (data[0] ?? 0) | ((data[1] ?? 0) << 8) | ((data[2] ?? 0) << 16) | ((data[3] ?? 0) << 24);
    if (variant !== 2) continue;
    // 8-byte little-endian lamports at offset 4.
    let lamports = 0n;
    for (let b = 11; b >= 4; b--) lamports = (lamports << 8n) | BigInt(data[b] ?? 0);
    transfers.push({ destination: ix.keys[1]?.pubkey.toBase58() ?? '', lamports });
  }
  return transfers;
}

async function confirmSignatureOnChain(
  signature: string,
  rpcUrl: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignatureStatuses',
        params: [[signature], { searchTransactionHistory: true }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, reason: 'Solana RPC unavailable' };
    const data = (await res.json()) as {
      result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> };
    };
    const status = data?.result?.value?.[0];
    if (!status) {
      return {
        ok: false,
        reason:
          'Transaction not found on-chain — the payment must be submitted and confirmed before verification',
      };
    }
    if (status.err) return { ok: false, reason: 'Transaction failed on-chain' };
    if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
      return { ok: true };
    }
    return { ok: false, reason: 'Transaction not yet confirmed' };
  } catch {
    return { ok: false, reason: 'Solana RPC error' };
  }
}

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
  // ── Bind the grant to a real action/target/amount triple ────────────────
  // Previously only `proof` was required: unlock/subscribe/upgrade could be
  // verified with no target at all, and the amount was whatever the client
  // claimed with nothing cross-checked against the transaction.
  if (!X402_ACTION_SET.has(action)) {
    return jsonResponse({ error: 'Valid action required (tip|unlock|subscribe|upgrade)' }, 400);
  }
  if (!target || !isValidSolanaAddress(target)) {
    return jsonResponse({ error: 'Valid target Solana address required' }, 400);
  }
  if (!isValidAmount(amount)) {
    return jsonResponse({ error: 'Valid amount required' }, 400);
  }

  try {
    const proofBytes = Uint8Array.from(atob(proof), (c) => c.charCodeAt(0));

    // ── Idempotency: one proof, one grant (replay fence) ─────────────────
    // The same signed transaction previously granted unlock/subscribe/upgrade
    // repeatedly. Bind the fence to the proof hash AND the requested
    // action/target so a proof can never be re-run for a different grant.
    const proofHash = await sha256Hex(proofBytes);
    const replayKey = `x402:proof:${proofHash}:${action}:${target}`;
    const seen = await env.CACHE?.get(replayKey);
    if (seen) {
      return jsonResponse(
        { error: 'Payment proof already used — replay rejected', code: 'REPLAY_DETECTED' },
        409,
      );
    }

    // Verify the Solana transaction signature
    const tx = Transaction.from(proofBytes);
    const ok = tx.verifySignatures();
    if (!ok) {
      return jsonResponse({ error: 'Invalid transaction signature' }, 400);
    }

    // Extract the sender from the transaction
    const feePayer = tx.feePayer?.toBase58();
    if (!feePayer || !isValidSolanaAddress(feePayer)) {
      return jsonResponse({ error: 'Could not determine sender from transaction' }, 400);
    }

    // ── On-chain confirmation ────────────────────────────────────────────
    // A signed-but-never-submitted transaction used to pass verification.
    const rpcUrl = env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      return jsonResponse(
        {
          error:
            'Payment verification not configured — set SOLANA_RPC_URL to enable on-chain confirmation',
          code: 'NOT_CONFIGURED',
        },
        503,
      );
    }
    const firstSig = tx.signatures?.[0]?.signature;
    if (!firstSig) {
      return jsonResponse({ error: 'Transaction has no signature to confirm' }, 400);
    }
    const txSignature = base58Encode(firstSig);
    const confirmation = await confirmSignatureOnChain(txSignature, rpcUrl);
    if (!confirmation.ok) {
      return jsonResponse(
        { error: confirmation.reason, code: 'PAYMENT_NOT_CONFIRMED', txSignature },
        402,
      );
    }

    // ── Payload binding: amount + recipient must exist IN the tx ─────────
    const claimedLamports = solToLamports(amount);
    const matchingTransfer = decodeSystemTransfers(tx).find(
      (t) => t.destination === target && t.lamports >= claimedLamports,
    );
    if (!matchingTransfer) {
      return jsonResponse(
        {
          error:
            'Transaction does not contain a SystemProgram.transfer to the target for at least the claimed amount',
          code: 'PAYMENT_MISMATCH',
          txSignature,
        },
        400,
      );
    }

    // All checks passed — consume the proof BEFORE granting anything.
    try {
      await env.CACHE?.put(
        replayKey,
        JSON.stringify({ action, target, feePayer, txSignature, paymentId, at: Date.now() }),
        { expirationTtl: 60 * 60 * 24 }, // 24h replay window
      );
    } catch {
      // KV unavailable: fail closed rather than risk double-grants.
      return jsonResponse(
        {
          error: 'Replay protection storage unavailable — verification refused',
          code: 'STORE_UNAVAILABLE',
        },
        503,
      );
    }

    // Generate result based on action type
    const result: X402VerifyResult = {
      ok: true,
      action,
      target,
      amount,
      signature: txSignature,
    };

    // Route through tipping ledger
    if (action === 'tip') {
      const amountNum = Number.parseFloat(amount);
      if (!Number.isNaN(amountNum) && amountNum > 0) {
        const solPrice = await fetchSolPriceX402(env);
        const amountUsd = Math.round(amountNum * solPrice * 100) / 100;
        const activity = await recordUnifiedTip(env, {
          platform: 'solana',
          entityId: `x402:tip:${target}:${txSignature.slice(0, 16)}`,
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
            txSignature,
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
            txSignature,
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
            txSignature,
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

async function fetchSolPriceX402(_env: Env): Promise<number> {
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
