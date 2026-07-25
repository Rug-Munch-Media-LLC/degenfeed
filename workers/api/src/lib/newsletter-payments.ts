/**
 * @degenfeed/api-worker — Newsletter Payment Processing
 *
 * Handles subscription payments, one-time purchases, creator coin discounts,
 * revenue splitting (90/10), and weekly payouts.
 *
 * Payment methods:
 *   1. One-time purchase — Pay for a single premium issue
 *   2. Monthly subscription — Auto-charge via wallet signature
 *   3. Creator coin discount — Hold $TICKER → discount on subscription
 *   4. Revenue split — Creator 90%, platform 10%
 *   5. Weekly payout — Send accumulated earnings to creator wallet
 *
 * KV keys:
 *   nlp:payment:{paymentId}           → PaymentRecord
 *   nlp:invoice:{invoiceId}           → PaymentInvoice
 *   nlp:subscription:{subscriberId}   → SubscriptionAgreement
 *   nlp:payout:{payoutId}             → PayoutRecord
 *   nlp:payout:queue:{creatorWallet}  → Pending PayoutRecord[]
 *   nlp:discount:{newsletterId}       → DiscountConfig
 */

import { type Env, log } from '../index';
import type { SubscriptionTier } from '../routes/newsletter-subscriptions';

// ─── Types ─────────────────────────────────────────────────────────────

export type PaymentMethod = 'evm' | 'solana' | 'lightning';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';

export interface PaymentInvoice {
  /** Unique invoice ID */
  id: string;
  /** Newsletter ID */
  newsletterId: string;
  /** Subscriber wallet address */
  subscriberWallet: string;
  /** Subscription tier */
  tier: SubscriptionTier;
  /** Amount in USD cents */
  amountCents: number;
  /** Platform fee in USD cents */
  feeCents: number;
  /** Creator share in USD cents */
  creatorCents: number;
  /** Payment method (auto-selected best available) */
  method: PaymentMethod;
  /** Chain for on-chain payments */
  chain: string;
  /** Recipient address (creator wallet) */
  toAddress: string;
  /** Payment token (USDC, ETH, SOL, etc) */
  token: string;
  /** Amount in token decimals */
  tokenAmount: string;
  /** Invoice expiration timestamp */
  expiresAt: number;
  /** Status */
  status: PaymentStatus;
  /** Transaction signature once paid */
  txSignature?: string;
  /** Whether this is a recurring subscription payment */
  recurring: boolean;
  /** Subscription period in months */
  months: number;
  /** Whether a creator coin discount was applied */
  coinDiscountApplied: boolean;
  /** Discount percentage if applied */
  discountPct?: number;
  /** Created at */
  createdAt: number;
}

export interface SubscriptionAgreement {
  /** Subscriber wallet address */
  subscriberWallet: string;
  /** Newsletter ID */
  newsletterId: string;
  /** Subscription tier */
  tier: SubscriptionTier;
  /** Monthly amount in cents */
  monthlyCents: number;
  /** Next billing timestamp */
  nextBillingAt: number;
  /** Auto-renewal flag */
  autoRenew: boolean;
  /** Signature authorizing recurring payments */
  authorizationSignature?: string;
  /** Number of successful payments */
  paymentCount: number;
  /** Last payment timestamp */
  lastPaymentAt?: number;
  /** Created at */
  createdAt: number;
  /** Updated at */
  updatedAt: number;
}

export interface PaymentRecord {
  /** Unique payment ID */
  id: string;
  /** Invoice ID */
  invoiceId: string;
  /** Newsletter ID */
  newsletterId: string;
  /** Subscriber wallet */
  subscriberWallet: string;
  /** Creator wallet */
  creatorWallet: string;
  /** Subscription tier */
  tier: SubscriptionTier;
  /** Amount in USD cents */
  amountCents: number;
  /** Platform fee in cents */
  feeCents: number;
  /** Creator earnings in cents */
  creatorCents: number;
  /** Payment method */
  method: PaymentMethod;
  /** Chain used */
  chain: string;
  /** Token used */
  token: string;
  /** Token amount */
  tokenAmount: string;
  /** Transaction signature */
  txSignature: string;
  /** Payment status */
  status: PaymentStatus;
  /** Coin discount applied */
  coinDiscountApplied: boolean;
  /** Discount percentage */
  discountPct?: number;
  /** Whether this is a recurring payment */
  recurring: boolean;
  /** Created at */
  createdAt: number;
  /** Confirmed at */
  confirmedAt?: number;
}

export interface PayoutRecord {
  /** Unique payout ID */
  id: string;
  /** Creator wallet address */
  creatorWallet: string;
  /** Week ID (ISO week) */
  weekId: string;
  /** Total amount in USD cents */
  amountCents: number;
  /** Platform fee deducted */
  platformFeeCents: number;
  /** Creator net amount */
  creatorNetCents: number;
  /** Transaction signature */
  txSignature?: string;
  /** Payout status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Created at */
  createdAt: number;
  /** Processed at */
  processedAt?: number;
}

export interface DiscountConfig {
  /** Newsletter ID */
  newsletterId: string;
  /** Creator coin token address */
  coinTokenAddress: string;
  /** Coin symbol for display */
  coinSymbol: string;
  /** Discount percentage (0-100) */
  discountPct: number;
  /** Minimum coin balance to qualify */
  minCoinBalance: string;
  /** Base chain for the coin */
  coinChain: string;
}

export interface PaymentQuote {
  /** Amount in USD cents */
  amountCents: number;
  /** Amount in USD (display) */
  amountUsd: string;
  /** Platform fee in cents */
  feeCents: number;
  /** Creator earnings in cents */
  creatorCents: number;
  /** Platform fee percentage */
  feePct: string;
  /** Creator share percentage */
  creatorSharePct: string;
  /** Selected payment method */
  method: PaymentMethod;
  /** Chain */
  chain: string;
  /** Payment token */
  token: string;
  /** Token amount */
  tokenAmount: string;
  /** Coin discount if applicable */
  coinDiscount?: {
    token: string;
    discountPct: number;
    originalAmount: number;
    discountedAmount: number;
  };
}

// ─── Constants ─────────────────────────────────────────────────────────

const PAYMENT_PREFIX = 'nlp:payment:';
const INVOICE_PREFIX = 'nlp:invoice:';
const SUBSCRIPTION_PREFIX = 'nlp:subscription:';
const PAYOUT_PREFIX = 'nlp:payout:';
const PAYOUT_QUEUE_PREFIX = 'nlp:payout:queue:';
const DISCOUNT_PREFIX = 'nlp:discount:';
const WEEKLY_PAYOUT_AMOUNT_THRESHOLD_CENTS = 100; // $1 minimum payout
const PLATFORM_FEE_BPS = 1000; // 10%
const CREATOR_SHARE_BPS = 9000; // 90%
const INVOICE_TTL_SECONDS = 60 * 60; // 1 hour
const TTL_YEAR = 60 * 60 * 24 * 365;

// ─── Token price approximations (USDC pegged) ──────────────────────────

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  SOL: 9,
  DEGE: 18,
};

/** Approximate USD values for native tokens (update via price oracle in production) */
const tokenPrices: Record<string, number> = {
  ETH: 3500,
  SOL: 150,
  DEGE: 0.05,
  USDC: 1,
  USDT: 1,
};

export function updateTokenPrice(token: string, priceUsd: number): void {
  tokenPrices[token.toUpperCase()] = priceUsd;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function kvGet<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function kvPut(
  kv: KVNamespace | undefined,
  key: string,
  value: unknown,
  ttl?: number,
): Promise<void> {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : {});
  } catch (err) {
    log('warn', `[nl-payments] KV put failed: ${key}`, String(err));
  }
}

async function _kvDelete(kv: KVNamespace | undefined, key: string): Promise<void> {
  if (!kv) return;
  try {
    await kv.delete(key);
  } catch {
    /* ignore */
  }
}

/**
 * Select the best payment method for a given subscriber context.
 * Priority: Same-chain native token > USDC > Lightning for small amounts.
 */
export function selectPaymentMethod(
  subscriberChains: string[],
  creatorChains: string[],
  amountCents: number,
  preferredChain?: string,
): { method: PaymentMethod; chain: string; token: string } {
  const intersection = subscriberChains.filter((c) => creatorChains.includes(c));

  // Prefer the user's preferred chain if mutually supported
  if (preferredChain && intersection.includes(preferredChain)) {
    const chain = preferredChain;
    const method: PaymentMethod = chain === 'solana' ? 'solana' : 'evm';
    const token = amountCents > 10000 ? 'USDC' : chain === 'solana' ? 'SOL' : 'ETH';
    return { method, chain, token };
  }

  // For small amounts (< $1), use native token on any available chain
  if (amountCents < 100 && intersection.length > 0) {
    const chain = intersection[0];
    const method: PaymentMethod = chain === 'solana' ? 'solana' : 'evm';
    return { method, chain, token: chain === 'solana' ? 'SOL' : 'ETH' };
  }

  // Default: USDC on any available chain
  if (intersection.length > 0) {
    return {
      method: intersection.includes('solana') ? 'solana' : 'evm',
      chain: intersection.includes('base') ? 'base' : intersection[0],
      token: 'USDC',
    };
  }

  // Fallback: Solana (most accessible)
  return { method: 'solana', chain: 'solana', token: 'USDC' };
}

/**
 * Calculate token amount from USD cents.
 */
export function calculateTokenAmount(amountCents: number, token: string): string {
  const price = tokenPrices[token.toUpperCase()] ?? 1;
  const decimals = TOKEN_DECIMALS[token.toUpperCase()] ?? 6;
  const tokenAmount = amountCents / 100 / price;
  return tokenAmount.toFixed(decimals);
}

/**
 * Create a payment invoice for newsletter subscription/issue purchase.
 * Returns the invoice details for the subscriber to sign.
 */
export async function createPaymentInvoice(
  env: Env,
  params: {
    newsletterId: string;
    subscriberWallet: string;
    creatorWallet: string;
    tier: SubscriptionTier;
    amountCents: number;
    months: number;
    recurring: boolean;
    coinDiscountApplied?: boolean;
    discountPct?: number;
    preferredChain?: string;
    toAddress: string;
  },
): Promise<PaymentInvoice | { error: string }> {
  const feeCents = Math.round((params.amountCents * PLATFORM_FEE_BPS) / 10000);
  const creatorCents = params.amountCents - feeCents;

  // Select best payment method
  const subscriberChains = params.subscriberWallet.startsWith('0x')
    ? ['ethereum', 'base', 'optimism', 'arbitrum']
    : ['solana'];
  const creatorChains = params.toAddress.startsWith('0x')
    ? ['ethereum', 'base', 'optimism', 'arbitrum']
    : ['solana'];

  const { method, chain, token } = selectPaymentMethod(
    subscriberChains,
    creatorChains,
    params.amountCents,
    params.preferredChain,
  );

  const tokenAmount = calculateTokenAmount(params.amountCents, token);

  const invoice: PaymentInvoice = {
    id: generateId(),
    newsletterId: params.newsletterId,
    subscriberWallet: params.subscriberWallet.toLowerCase(),
    tier: params.tier,
    amountCents: params.amountCents,
    feeCents,
    creatorCents,
    method,
    chain,
    toAddress: params.toAddress,
    token,
    tokenAmount,
    expiresAt: Date.now() + INVOICE_TTL_SECONDS * 1000,
    status: 'pending',
    recurring: params.recurring,
    months: params.months,
    coinDiscountApplied: params.coinDiscountApplied ?? false,
    discountPct: params.discountPct,
    createdAt: Date.now(),
  };

  await kvPut(env.CACHE, `${INVOICE_PREFIX}${invoice.id}`, invoice, INVOICE_TTL_SECONDS);

  return invoice;
}

/**
 * Get payment quote for a tier without creating an invoice.
 * Useful for displaying price before the subscribe flow.
 */
export function getPaymentQuote(params: {
  amountCents: number;
  tier: SubscriptionTier;
  subscriberWallet: string;
  creatorWallet: string;
  coinDiscountPct?: number;
  preferredChain?: string;
}): PaymentQuote {
  let discount: PaymentQuote['coinDiscount'] | undefined;

  let amountCents = params.amountCents;
  if (params.coinDiscountPct && params.coinDiscountPct > 0) {
    const discountAmount = Math.round((amountCents * params.coinDiscountPct) / 100);
    discount = {
      token: '$TICKER',
      discountPct: params.coinDiscountPct,
      originalAmount: amountCents,
      discountedAmount: amountCents - discountAmount,
    };
    amountCents = amountCents - discountAmount;
  }

  const feeCents = Math.round((amountCents * PLATFORM_FEE_BPS) / 10000);
  const creatorCents = amountCents - feeCents;

  const subscriberChains = params.subscriberWallet.startsWith('0x')
    ? ['ethereum', 'base', 'optimism', 'arbitrum']
    : ['solana'];
  const creatorChains = params.creatorWallet.startsWith('0x')
    ? ['ethereum', 'base', 'optimism', 'arbitrum']
    : ['solana'];

  const { method, chain, token } = selectPaymentMethod(
    subscriberChains,
    creatorChains,
    amountCents,
    params.preferredChain,
  );

  const tokenAmount = calculateTokenAmount(amountCents, token);

  return {
    amountCents,
    amountUsd: (amountCents / 100).toFixed(2),
    feeCents,
    creatorCents,
    feePct: `${PLATFORM_FEE_BPS / 100}%`,
    creatorSharePct: `${CREATOR_SHARE_BPS / 100}%`,
    method,
    chain,
    token,
    tokenAmount,
    coinDiscount: discount,
  };
}

/**
 * Confirm a payment by transaction signature.
 * In production, verifies the on-chain transaction.
 */
export async function confirmPayment(
  env: Env,
  invoiceId: string,
  txSignature: string,
): Promise<PaymentRecord | { error: string }> {
  const invoice = await kvGet<PaymentInvoice>(env.CACHE, `${INVOICE_PREFIX}${invoiceId}`);

  if (!invoice) {
    return { error: 'Invoice not found or expired' };
  }
  if (invoice.status !== 'pending') {
    return { error: `Invoice already ${invoice.status}` };
  }
  if (invoice.expiresAt < Date.now()) {
    return { error: 'Invoice expired' };
  }

  // In production: verify transaction on-chain
  // const verified = await verifyOnChainTransaction(txSignature, invoice.chain, invoice.tokenAmount, invoice.toAddress);
  // if (!verified) return { error: 'Transaction verification failed' };

  const now = Date.now();

  // Update invoice
  invoice.status = 'confirmed';
  invoice.txSignature = txSignature;
  await kvPut(env.CACHE, `${INVOICE_PREFIX}${invoiceId}`, invoice);

  // Create payment record
  const record: PaymentRecord = {
    id: generateId(),
    invoiceId,
    newsletterId: invoice.newsletterId,
    subscriberWallet: invoice.subscriberWallet,
    creatorWallet: invoice.toAddress,
    tier: invoice.tier,
    amountCents: invoice.amountCents,
    feeCents: invoice.feeCents,
    creatorCents: invoice.creatorCents,
    method: invoice.method,
    chain: invoice.chain,
    token: invoice.token,
    tokenAmount: invoice.tokenAmount,
    txSignature,
    status: 'confirmed',
    coinDiscountApplied: invoice.coinDiscountApplied,
    discountPct: invoice.discountPct,
    recurring: invoice.recurring,
    createdAt: now,
    confirmedAt: now,
  };

  await kvPut(env.CACHE, `${PAYMENT_PREFIX}${record.id}`, record);

  // If recurring, create or update subscription agreement
  if (invoice.recurring) {
    const subKey = `${SUBSCRIPTION_PREFIX}${invoice.subscriberWallet}:${invoice.newsletterId}`;
    const existing = await kvGet<SubscriptionAgreement>(env.CACHE, subKey);
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + invoice.months);

    const agreement: SubscriptionAgreement = {
      subscriberWallet: invoice.subscriberWallet,
      newsletterId: invoice.newsletterId,
      tier: invoice.tier,
      monthlyCents:
        invoice.months > 1 ? Math.round(invoice.amountCents / invoice.months) : invoice.amountCents,
      nextBillingAt: nextBilling.getTime(),
      autoRenew: true,
      authorizationSignature: existing?.authorizationSignature,
      paymentCount: (existing?.paymentCount ?? 0) + 1,
      lastPaymentAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await kvPut(env.CACHE, subKey, agreement, TTL_YEAR);
  }

  return record;
}

/**
 * Create/update a discount configuration for creator coin holders.
 */
export async function setDiscountConfig(
  env: Env,
  config: DiscountConfig,
): Promise<{ ok: boolean }> {
  await kvPut(env.CACHE, `${DISCOUNT_PREFIX}${config.newsletterId}`, config);
  return { ok: true };
}

/**
 * Check if a subscriber qualifies for a creator coin discount.
 */
export async function checkCoinDiscount(
  env: Env,
  newsletterId: string,
  subscriberWallet: string,
): Promise<{
  eligible: boolean;
  discountPct: number;
  config: DiscountConfig | null;
}> {
  const config = await kvGet<DiscountConfig>(env.CACHE, `${DISCOUNT_PREFIX}${newsletterId}`);

  if (!config) {
    return { eligible: false, discountPct: 0, config: null };
  }

  // In production: check on-chain token balance
  // const balance = await getTokenBalance(subscriberWallet, config.coinTokenAddress, config.coinChain);
  // const minBalance = BigInt(config.minCoinBalance);
  // const eligible = balance >= minBalance;

  // Mock: assume eligible if wallet is provided and config exists
  const eligible = !!subscriberWallet && config.discountPct > 0;

  return {
    eligible,
    discountPct: eligible ? config.discountPct : 0,
    config,
  };
}

/**
 * Add a payout to the weekly payout queue.
 */
export async function queueWeeklyPayout(
  env: Env,
  creatorWallet: string,
  amountCents: number,
): Promise<PayoutRecord> {
  const weekId = getWeekId();
  const payout: PayoutRecord = {
    id: generateId(),
    creatorWallet: creatorWallet.toLowerCase(),
    weekId,
    amountCents,
    platformFeeCents: Math.round((amountCents * PLATFORM_FEE_BPS) / 10000),
    creatorNetCents: amountCents - Math.round((amountCents * PLATFORM_FEE_BPS) / 10000),
    status: 'pending',
    createdAt: Date.now(),
  };

  // Add to payout queue for the week
  const queueKey = `${PAYOUT_QUEUE_PREFIX}${creatorWallet.toLowerCase()}:${weekId}`;
  const queue = (await kvGet<PayoutRecord[]>(env.CACHE, queueKey)) ?? [];
  queue.push(payout);
  await kvPut(env.CACHE, queueKey, queue);

  // Store individual payout record
  await kvPut(env.CACHE, `${PAYOUT_PREFIX}${payout.id}`, payout);

  return payout;
}

/**
 * Process pending payouts for a creator (called by cron or manual trigger).
 */
export async function processCreatorPayouts(
  env: Env,
  creatorWallet: string,
): Promise<{ processed: number; totalCents: number; txSignature?: string }> {
  const weekId = getWeekId();
  const queueKey = `${PAYOUT_QUEUE_PREFIX}${creatorWallet.toLowerCase()}:${weekId}`;
  const queue = (await kvGet<PayoutRecord[]>(env.CACHE, queueKey)) ?? [];

  const pending = queue.filter((p) => p.status === 'pending');
  if (pending.length === 0) {
    return { processed: 0, totalCents: 0 };
  }

  const totalCents = pending.reduce((sum, p) => sum + p.creatorNetCents, 0);

  if (totalCents < WEEKLY_PAYOUT_AMOUNT_THRESHOLD_CENTS) {
    return { processed: 0, totalCents: 0 }; // Below minimum payout threshold
  }

  // In production: execute on-chain payout transaction
  // const txHash = await sendPayoutTransaction(creatorWallet, totalCents, env);
  const txSignature = `0x${generateId().replace(/-/g, '')}`;

  const now = Date.now();
  let processed = 0;

  for (const payout of pending) {
    payout.status = 'completed';
    payout.txSignature = txSignature;
    payout.processedAt = now;
    await kvPut(env.CACHE, `${PAYOUT_PREFIX}${payout.id}`, payout);
    processed++;
  }

  // Update queue
  await kvPut(env.CACHE, queueKey, queue);

  return { processed, totalCents, txSignature };
}

/**
 * Get pending payout queue for a creator.
 */
export async function getPendingPayouts(
  env: Env,
  creatorWallet: string,
): Promise<{ pending: PayoutRecord[]; totalCents: number }> {
  const weekId = getWeekId();
  const queueKey = `${PAYOUT_QUEUE_PREFIX}${creatorWallet.toLowerCase()}:${weekId}`;
  const queue = (await kvGet<PayoutRecord[]>(env.CACHE, queueKey)) ?? [];

  const pending = queue.filter((p) => p.status === 'pending');
  const totalCents = pending.reduce((sum, p) => sum + p.creatorNetCents, 0);

  return { pending, totalCents };
}

/**
 * Get payout history for a creator.
 */
export async function getPayoutHistory(
  env: Env,
  creatorWallet: string,
  limit: number = 20,
): Promise<PayoutRecord[]> {
  // Scan for payout records with the creator prefix
  const payouts: PayoutRecord[] = [];

  if (!env.CACHE) return payouts;

  try {
    const list = await env.CACHE.list({ prefix: `${PAYOUT_PREFIX}` });
    for (const key of list.keys) {
      const raw = await env.CACHE.get(key.name);
      if (raw) {
        const payout = JSON.parse(raw) as PayoutRecord;
        if (payout.creatorWallet === creatorWallet.toLowerCase()) {
          payouts.push(payout);
        }
      }
    }
  } catch {
    /* ignore */
  }

  return payouts.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

/**
 * Get total revenue aggregated for a creator across all newsletters.
 */
export async function getCreatorRevenueSummary(
  env: Env,
  creatorWallet: string,
): Promise<{
  totalRevenue: number;
  totalFees: number;
  totalEarnings: number;
  totalPaidOut: number;
  pendingPayouts: number;
  revenueByMonth: Array<{ month: string; revenue: number; earnings: number }>;
  recentPayments: PaymentRecord[];
}> {
  const payments: PaymentRecord[] = [];

  if (!env.CACHE) {
    return {
      totalRevenue: 0,
      totalFees: 0,
      totalEarnings: 0,
      totalPaidOut: 0,
      pendingPayouts: 0,
      revenueByMonth: [],
      recentPayments: [],
    };
  }

  try {
    const list = await env.CACHE.list({ prefix: PAYMENT_PREFIX });
    for (const key of list.keys) {
      const raw = await env.CACHE.get(key.name);
      if (raw) {
        const payment = JSON.parse(raw) as PaymentRecord;
        if (payment.creatorWallet === creatorWallet.toLowerCase()) {
          payments.push(payment);
        }
      }
    }
  } catch {
    /* ignore */
  }

  const confirmed = payments.filter((p) => p.status === 'confirmed');
  const totalRevenue = confirmed.reduce((s, p) => s + p.amountCents, 0);
  const totalFees = confirmed.reduce((s, p) => s + p.feeCents, 0);
  const totalEarnings = confirmed.reduce((s, p) => s + p.creatorCents, 0);

  // Revenue by month
  const revenueByMonthMap = new Map<string, { revenue: number; earnings: number }>();
  for (const p of confirmed) {
    if (!p.confirmedAt) continue;
    const month = new Date(p.confirmedAt).toISOString().slice(0, 7);
    const existing = revenueByMonthMap.get(month) ?? { revenue: 0, earnings: 0 };
    existing.revenue += p.amountCents;
    existing.earnings += p.creatorCents;
    revenueByMonthMap.set(month, existing);
  }

  const revenueByMonth = Array.from(revenueByMonthMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Pending payouts
  const { totalCents: pendingPayouts } = await getPendingPayouts(env, creatorWallet);

  return {
    totalRevenue,
    totalFees,
    totalEarnings,
    totalPaidOut: 0, // Would come from actual on-chain payout records
    pendingPayouts,
    revenueByMonth,
    recentPayments: confirmed
      .sort((a, b) => (b.confirmedAt ?? 0) - (a.confirmedAt ?? 0))
      .slice(0, 20),
  };
}

/**
 * Trigger weekly payout processing for all creators with pending payouts.
 * Called by cron trigger.
 */
export async function processAllWeeklyPayouts(env: Env): Promise<{
  processed: number;
  totalPaid: number;
  errors: string[];
}> {
  let processed = 0;
  let totalPaid = 0;
  const errors: string[] = [];

  if (!env.CACHE) return { processed: 0, totalPaid: 0, errors: ['KV not available'] };

  try {
    const _weekId = getWeekId();
    const list = await env.CACHE.list({ prefix: PAYOUT_QUEUE_PREFIX });

    // Deduplicate creator wallets from queue keys
    const creatorWallets = new Set<string>();
    for (const key of list.keys) {
      // Key format: nlp:payout:queue:{wallet}:{weekId}
      const parts = key.name.split(':');
      if (parts.length >= 4) {
        creatorWallets.add(parts[3]);
      }
    }

    for (const wallet of creatorWallets) {
      try {
        const result = await processCreatorPayouts(env, wallet);
        if (result.processed > 0) {
          processed += result.processed;
          totalPaid += result.totalCents;
        }
      } catch (err) {
        errors.push(`Failed payout for ${wallet}: ${String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Payout scan failed: ${String(err)}`);
  }

  return { processed, totalPaid, errors };
}
