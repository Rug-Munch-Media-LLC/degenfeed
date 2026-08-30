import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { isValidSolanaAddress, sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

export type SubscriptionTier = 'pro' | 'platinum';

interface SubscriptionRecord {
  tier: SubscriptionTier;
  identityId: string;
  expiresAt: number;
  startedAt: number;
  txSignature?: string;
}

/** Platform premium subscription record stored in KV under `premium:${address}` */
export interface PlatformPremiumRecord {
  tier: SubscriptionTier;
  identityId: string;
  expiresAt: number;
  startedAt: number;
  status: 'active' | 'cancelled';
  firstMonthPromo: boolean;
  nextBillingAmount: number; // in cents
  paymentMethod: string;
  txHash?: string;
}

const TIER_PRICES: Record<SubscriptionTier, number> = {
  pro: 10,
  platinum: 25,
};

const LAMPORTS_PER_SOL_BI = 1_000_000_000n;

/**
 * SOL price per tier used for on-chain payment verification.
 * (Cent pricing for the Stripe flow lives in @degenfeed/monetization.)
 */
const TIER_PRICES_LAMPORTS: Record<SubscriptionTier, bigint> = {
  pro: 10n * LAMPORTS_PER_SOL_BI,
  platinum: 25n * LAMPORTS_PER_SOL_BI,
};

function buildBlinkUrl(origin: string, tier: SubscriptionTier): string {
  return `${origin}/api/billing/checkout?tier=${tier}`;
}

export async function handleBillingCheckout(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tier = sanitizeString(url.searchParams.get('tier'), 16) as SubscriptionTier;
  if (!tier || !(tier in TIER_PRICES)) {
    return jsonResponse({ error: 'Invalid tier. Use pro or creator.' }, 400);
  }
  const origin = `${url.protocol}//${url.host}`;
  const amount = TIER_PRICES[tier];
  const blinkUrl = buildBlinkUrl(origin, tier);

  return jsonResponse({
    tier,
    amount,
    currency: 'SOL',
    blinkUrl,
    action: {
      title: `DegenFeed ${tier === 'pro' ? 'Pro' : 'Platinum'}`,
      icon: `${origin}/favicon.ico`,
      description: `Subscribe to DegenFeed ${tier} for ${amount} SOL/month`,
      label: `Pay ${amount} SOL`,
      links: {
        actions: [
          {
            label: `Pay ${amount} SOL`,
            href: `${origin}/api/billing/verify?tier=${tier}`,
          },
        ],
      },
    },
  });
}

interface VerifyBody {
  account?: string;
  signature?: string;
  transaction?: string;
}

async function verifySolanaTransaction(signature: string, rpcUrl: string): Promise<boolean> {
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
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      result?: {
        value?: Array<{ confirmationStatus?: string; err?: unknown } | null>;
      };
    };
    const status = data?.result?.value?.[0];
    return status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized';
  } catch {
    return false;
  }
}

interface SolanaTransactionResponse {
  result?: {
    transaction?: { message?: { accountKeys?: string[] } };
    meta?: {
      preBalances?: number[];
      postBalances?: number[];
      loadedAddresses?: { writable?: string[]; readonly?: string[] };
    } | null;
  } | null;
}

/**
 * Fetch a confirmed transaction and verify it actually pays the platform
 * treasury.
 *
 * Hardening (2026-08 audit): previously ANY confirmed Solana transaction —
 * e.g. a 0.00001 SOL self-transfer — granted a paid tier, and the same
 * signature could be replayed forever. Now the tx must:
 *   1. be signed by (fee payer =) the claiming `account`,
 *   2. credit the treasury at least the tier price in lamports,
 *   3. never have been used for a grant before (replay fence).
 */
async function verifyTierPayment(
  signature: string,
  account: string,
  requiredLamports: bigint,
  rpcUrl: string,
  treasury: string,
  kv: KVNamespace | undefined,
): Promise<{ ok: true } | { ok: false; status: number; error: string; code?: string }> {
  // ── Replay fence: one signature, one grant, ever ────────────────────────
  try {
    const used = await kv?.get(`billing:used:${signature}`);
    if (used) {
      return {
        ok: false,
        status: 409,
        error: 'Transaction signature already used for a subscription grant',
        code: 'REPLAY_DETECTED',
      };
    }
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'Replay protection storage unavailable — verification refused',
      code: 'STORE_UNAVAILABLE',
    };
  }

  let data: SolanaTransactionResponse;
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, status: 502, error: 'Solana RPC unavailable' };
    }
    data = (await res.json()) as SolanaTransactionResponse;
  } catch {
    return { ok: false, status: 502, error: 'Solana RPC error' };
  }

  const tx = data?.result;
  const staticKeys = tx?.transaction?.message?.accountKeys ?? [];
  const loaded = [
    ...(tx?.meta?.loadedAddresses?.writable ?? []),
    ...(tx?.meta?.loadedAddresses?.readonly ?? []),
  ];
  const allKeys = [...staticKeys, ...loaded];
  const pre = tx?.meta?.preBalances ?? [];
  const post = tx?.meta?.postBalances ?? [];

  if (allKeys.length === 0 || pre.length !== allKeys.length || post.length !== allKeys.length) {
    return {
      ok: false,
      status: 402,
      error: 'Transaction not found on-chain',
      code: 'TX_NOT_FOUND',
    };
  }

  // ── Bind signature → account: the claiming wallet must be the fee payer ──
  if (allKeys[0] !== account) {
    return {
      ok: false,
      status: 403,
      error: 'Claiming account is not the fee payer of the payment transaction',
      code: 'ACCOUNT_MISMATCH',
    };
  }

  // ── Bind tx → treasury: the treasury must be credited the tier price ────
  const treasuryIndex = allKeys.indexOf(treasury);
  if (treasuryIndex === -1) {
    return {
      ok: false,
      status: 402,
      error: 'Transaction does not credit the platform treasury',
      code: 'PAYMENT_MISMATCH',
    };
  }
  const credited = BigInt(Math.max(0, (post[treasuryIndex] ?? 0) - (pre[treasuryIndex] ?? 0)));
  if (credited < requiredLamports) {
    return {
      ok: false,
      status: 402,
      error: `Payment below tier price — treasury credited ${credited} lamports, required ${requiredLamports}`,
      code: 'PAYMENT_MISMATCH',
    };
  }

  // Consume the signature BEFORE granting (fail closed if storage errors).
  try {
    await kv?.put(`billing:used:${signature}`, JSON.stringify({ account, at: Date.now() }), {
      expirationTtl: 60 * 60 * 24 * 90, // 90 days
    });
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'Replay protection storage unavailable — verification refused',
      code: 'STORE_UNAVAILABLE',
    };
  }

  return { ok: true };
}

export async function handleBillingVerify(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tier = sanitizeString(url.searchParams.get('tier'), 16) as SubscriptionTier;
  if (!tier || !(tier in TIER_PRICES)) {
    return jsonResponse({ error: 'Invalid tier' }, 400);
  }

  let body: VerifyBody = {};
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const account = sanitizeString(body.account, 128);
  const signature = sanitizeString(body.signature, 128);
  if (!account || !isValidSolanaAddress(account)) {
    return jsonResponse({ error: 'Valid Solana account required' }, 400);
  }
  if (!signature) {
    return jsonResponse({ error: 'Transaction signature required' }, 400);
  }

  const rpcUrl = env.SOLANA_RPC_URL;
  const treasury = env.BILLING_TREASURY_ADDRESS;
  if (!rpcUrl || !treasury || !isValidSolanaAddress(treasury)) {
    return jsonResponse(
      {
        error:
          'Payment verification not configured — set SOLANA_RPC_URL and BILLING_TREASURY_ADDRESS to enable on-chain tier grants',
        code: 'NOT_CONFIGURED',
      },
      503,
    );
  }

  // Verify the transaction is confirmed on-chain before anything else.
  const confirmed = await verifySolanaTransaction(signature, rpcUrl);
  if (!confirmed) {
    return jsonResponse(
      {
        error: 'Transaction not confirmed on-chain. Wait for confirmation and try again.',
      },
      402,
    );
  }

  // Verify the payment actually pays the treasury the tier price, from the
  // claiming account, and has never been used before.
  const payment = await verifyTierPayment(
    signature,
    account,
    TIER_PRICES_LAMPORTS[tier],
    rpcUrl,
    treasury,
    env.SUBSCRIPTIONS,
  );
  if (!payment.ok) {
    return jsonResponse({ error: payment.error, code: payment.code }, payment.status);
  }

  const identityId = `solana:${account}`;
  const now = Date.now();
  const record: SubscriptionRecord = {
    tier,
    identityId,
    startedAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    txSignature: signature,
  };

  try {
    await env.SUBSCRIPTIONS?.put(identityId, JSON.stringify(record));
  } catch {
    /* ignore KV errors */
  }

  return jsonResponse({
    ok: true,
    tier,
    identityId,
    expiresAt: record.expiresAt,
  });
}

export async function handleBillingStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const identityId = sanitizeString(url.searchParams.get('identityId'), 128);
  if (!identityId) return jsonResponse({ error: 'identityId required' }, 400);

  let record: SubscriptionRecord | undefined;
  try {
    const raw = await env.SUBSCRIPTIONS?.get(identityId);
    if (raw) record = JSON.parse(raw) as SubscriptionRecord;
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  const active = Boolean(record && record.expiresAt > Date.now());
  const tier = active && record ? record.tier : 'free';
  return jsonResponse({
    identityId,
    tier,
    active,
    expiresAt: record?.expiresAt,
  });
}

export function isPremiumTier(tier?: string): boolean {
  return tier === 'pro' || tier === 'platinum' || tier === 'enterprise';
}

export function isPlatinumTier(tier?: string): boolean {
  return tier === 'platinum' || tier === 'enterprise';
}

// ─── KV key helpers ────────────────────────────────────────────────────

function premiumKey(address: string): string {
  return `premium:${address.toLowerCase()}`;
}

// ─── NEW: POST /api/billing/subscribe — Create platform subscription ───

/**
 * NOT IMPLEMENTED — honest fence.
 *
 * This handler previously granted pro/platinum for 30 days with NO payment at
 * all, recording a fabricated `sim_<timestamp>` "txHash". Real subscription
 * grants must flow through either:
 *   - POST /api/billing/verify (on-chain SOL payment, now treasury-verified), or
 *   - the Stripe integration in @degenfeed/monetization (webhook-verified).
 * Until one of those is wired to this route, it refuses instead of granting.
 */
export async function handleBillingSubscribe(_request: Request, _env: Env): Promise<Response> {
  return jsonResponse(
    {
      error:
        'Subscription creation is not implemented — this endpoint previously granted paid tiers without any payment. Use /api/billing/verify with a confirmed on-chain payment to the platform treasury.',
      code: 'NOT_IMPLEMENTED',
    },
    501,
  );
}

// ─── NEW: POST /api/billing/cancel — Cancel platform subscription ──────

export async function handleBillingCancel(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const address = session.address.toLowerCase();
  const key = premiumKey(address);

  let record: PlatformPremiumRecord | null = null;
  try {
    const raw = await env.SUBSCRIPTIONS?.get(key);
    if (raw) record = JSON.parse(raw) as PlatformPremiumRecord;
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  if (!record) {
    return jsonResponse({ error: 'No active subscription found' }, 404);
  }

  if (record.status === 'cancelled') {
    return jsonResponse({ error: 'Subscription already cancelled' }, 409);
  }

  record.status = 'cancelled';

  try {
    await env.SUBSCRIPTIONS?.put(key, JSON.stringify(record));
  } catch {
    return jsonResponse({ error: 'Storage unavailable' }, 500);
  }

  return noCacheJsonResponse({ success: true, status: 'cancelled' });
}

// ─── NEW: GET /api/billing/my-status — Get current user's premium status ─

export async function handleBillingMyStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const address = session.address.toLowerCase();
  const key = premiumKey(address);

  let record: PlatformPremiumRecord | null = null;
  try {
    const raw = await env.SUBSCRIPTIONS?.get(key);
    if (raw) record = JSON.parse(raw) as PlatformPremiumRecord;
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  if (record?.status !== 'active' || record.expiresAt <= Date.now()) {
    return jsonResponse({
      tier: 'free',
      isPremium: false,
      expiresAt: null,
      firstMonthPromo: false,
      nextBillingAmount: null,
      daysRemaining: null,
    });
  }

  const daysRemaining = Math.ceil((record.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

  return jsonResponse({
    tier: record.tier,
    isPremium: true,
    expiresAt: new Date(record.expiresAt).toISOString(),
    firstMonthPromo: record.firstMonthPromo,
    nextBillingAmount: record.nextBillingAmount,
    daysRemaining,
  });
}
