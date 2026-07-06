import { type Env, jsonResponse } from '../index';
import { isValidSolanaAddress, sanitizeString } from '../sanitize';

export type SubscriptionTier = 'pro' | 'creator';

interface SubscriptionRecord {
  tier: SubscriptionTier;
  identityId: string;
  expiresAt: number;
  startedAt: number;
  txSignature?: string;
}

const TIER_PRICES: Record<SubscriptionTier, number> = {
  pro: 5,
  creator: 15,
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
      title: `DegenFeed ${tier === 'pro' ? 'Pro' : 'Creator'}`,
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
  const transaction = sanitizeString(body.transaction, 8192);
  if (!account || !isValidSolanaAddress(account)) {
    return jsonResponse({ error: 'Valid Solana account required' }, 400);
  }
  if (!signature && !transaction) {
    return jsonResponse({ error: 'signature or transaction required' }, 400);
  }

  const identityId = `solana:${account}`;
  const now = Date.now();
  const record: SubscriptionRecord = {
    tier,
    identityId,
    startedAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    txSignature: signature || transaction,
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
    /* ignore */
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
  return tier === 'pro' || tier === 'creator';
}

export function isCreatorTier(tier?: string): boolean {
  return tier === 'creator';
}
