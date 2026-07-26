/**
 * /api/newsletter/subscriptions — Creator Newsletter Subscription System
 *
 * Tiered newsletter subscriptions for creators:
 *   Free tier      → Public posts
 *   Paid tier      → $5/mo — Premium content, early access
 *   Founding tier  → $25/mo — Everything + recognition
 *
 * Endpoints:
 *   POST   /api/newsletter/:id/subscribe       — Subscribe (free or paid)
 *   POST   /api/newsletter/:id/unsubscribe     — Unsubscribe
 *   GET    /api/newsletter/:id/subscribers     — Subscriber list (creator only)
 *   GET    /api/newsletter/my-subscriptions    — My subscriptions
 *   POST   /api/newsletter/:id/tier            — Create/update paid tier
 *   GET    /api/newsletter/:id/settings        — Get newsletter settings
 */

import { log } from '../index';
import { jsonResponse } from '../response-helpers';
import { sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'paid' | 'founding';

export const TIER_PRICES: Record<
  Exclude<SubscriptionTier, 'free'>,
  { monthlyUsd: number; monthlyCents: number }
> = {
  paid: { monthlyUsd: 5, monthlyCents: 500 },
  founding: { monthlyUsd: 25, monthlyCents: 2500 },
};

export const VALID_TIERS: SubscriptionTier[] = ['free', 'paid', 'founding'];

export interface NewsletterSubscription {
  /** Subscriber identifier (wallet address or email) */
  id: string;
  /** Subscription tier */
  tier: SubscriptionTier;
  /** When the subscription started */
  subscribedAt: number;
  /** When the subscription expires (null = free/active) */
  expiresAt: number | null;
  /** Whether the subscription is active */
  active: boolean;
  /** Email address if subscribed via email */
  email?: string;
  /** Wallet address if subscribed via wallet */
  wallet?: string;
  /** Creator coin held for discount (if applicable) */
  coinDiscount?: boolean;
}

export interface NewsletterTierConfig {
  /** Newsletter identifier */
  newsletterId: string;
  /** Creator wallet address */
  creatorWallet: string;
  /** Price config for paid tier */
  paidPrice: number; // USD cents
  /** Price config for founding tier */
  foundingPrice: number; // USD cents
  /** Creator coin token address for discount eligibility */
  coinTokenAddress?: string;
  /** Coin symbol for display */
  coinSymbol?: string;
  /** Percentage discount for coin holders (0-100) */
  coinDiscountPct?: number;
  /** Minimum coin balance to qualify for discount */
  minCoinBalance?: string;
  /** Creator's payout wallet address */
  payoutWallet: string;
  /** Revenue split: creator share (basis points, default 9000 = 90%) */
  creatorShareBps: number;
  /** Revenue split: platform share (basis points, default 1000 = 10%) */
  platformShareBps: number;
  /** When the tier was created/updated */
  updatedAt: number;
}

export interface NewsletterSettings {
  /** Newsletter display name */
  name: string;
  /** Newsletter description */
  description: string;
  /** Creator wallet */
  creatorWallet: string;
  /** Newsletter category */
  category: string;
  /** Newsletter tags */
  tags: string[];
  /** Cover image URL */
  coverImage?: string;
  /** Whether newsletter is featured */
  featured: boolean;
  /** Subscriber counts */
  subscriberCounts: {
    free: number;
    paid: number;
    founding: number;
    total: number;
  };
  /** Created at */
  createdAt: number;
}

export interface NewsletterRevenueRecord {
  /** Newsletter ID */
  newsletterId: string;
  /** Total revenue in USD cents */
  totalRevenue: number;
  /** Platform fees collected in USD cents */
  platformFees: number;
  /** Creator earnings in USD cents */
  creatorEarnings: number;
  /** Revenue by month */
  monthlyRevenue: Array<{
    month: string;
    amount: number;
    platformFee: number;
    creatorShare: number;
  }>;
  /** Transactions */
  transactions: Array<{
    id: string;
    type: 'subscription' | 'issue_purchase';
    tier?: SubscriptionTier;
    amountCents: number;
    feeCents: number;
    creatorCents: number;
    txSignature?: string;
    subscriberWallet?: string;
    createdAt: number;
  }>;
  /** Last payout timestamp */
  lastPayoutAt?: number;
  /** Total paid out */
  totalPayouts: number;
  /** Payouts history */
  payouts: Array<{
    id: string;
    amountCents: number;
    txSignature: string;
    paidAt: number;
    weekId: string;
  }>;
}

export interface NewsletterAnalytics {
  /** Newsletter ID */
  newsletterId: string;
  /** Total subscriber count (free + paid + founding) */
  totalSubscribers: number;
  /** Subscriber breakdown */
  subscribersByTier: Record<SubscriptionTier, number>;
  /** Subscriber growth over time */
  subscriberGrowth: Array<{ date: string; count: number }>;
  /** Revenue metrics */
  revenue: {
    total: number;
    thisMonth: number;
    averagePerSubscriber: number;
  };
  /** Churn rate (percentage over last 30 days) */
  churnRate: number;
  /** New subscribers this month */
  newSubscribersThisMonth: number;
  /** Unsubscribes this month */
  unsubscribesThisMonth: number;
}

// ─── KV Key Patterns ─────────────────────────────────────────────────

const SUBSCRIPTION_PREFIX = 'nlsub:';
const SUBSCRIPTION_INDEX_PREFIX = 'nlsub:index:';
const TIER_CONFIG_PREFIX = 'nltier:';
const NEWSLETTER_SETTINGS_PREFIX = 'nlsettings:';
const REVENUE_PREFIX = 'nlrevenue:';
const ANALYTICS_PREFIX = 'nlanalytics:';
const USER_SUBSCRIPTIONS_PREFIX = 'nluser:subs:';
const SUBSCRIBER_COUNT_PREFIX = 'nlsub:count:';
const TTL_30D = 60 * 60 * 24 * 30;

// ─── Helpers ─────────────────────────────────────────────────────────

function safeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

function isValidEmail(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function newsletterSubKey(newsletterId: string, subscriberId: string): string {
  return `${SUBSCRIPTION_PREFIX}${safeKey(newsletterId)}:${safeKey(subscriberId)}`;
}

function newsletterIndexKey(newsletterId: string): string {
  return `${SUBSCRIPTION_INDEX_PREFIX}${safeKey(newsletterId)}`;
}

function tierConfigKey(newsletterId: string): string {
  return `${TIER_CONFIG_PREFIX}${safeKey(newsletterId)}`;
}

function newsletterSettingsKey(newsletterId: string): string {
  return `${NEWSLETTER_SETTINGS_PREFIX}${safeKey(newsletterId)}`;
}

function revenueKey(newsletterId: string): string {
  return `${REVENUE_PREFIX}${safeKey(newsletterId)}`;
}

function analyticsKey(newsletterId: string): string {
  return `${ANALYTICS_PREFIX}${safeKey(newsletterId)}`;
}

function userSubscriptionsKey(userId: string): string {
  return `${USER_SUBSCRIPTIONS_PREFIX}${safeKey(userId)}`;
}

function subscriberCountKey(newsletterId: string): string {
  return `${SUBSCRIBER_COUNT_PREFIX}${safeKey(newsletterId)}`;
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
    log('warn', `[nl-subs] KV put failed: ${key}`, String(err));
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

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getMonthId(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─── POST /api/newsletter/:id/subscribe ──────────────────────────────

export async function handleCreatorSubSubscribe(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const nlIndex = pathParts.indexOf('newsletter');
  const newsletterId = nlIndex >= 0 && pathParts.length > nlIndex + 1 ? pathParts[nlIndex + 1] : '';

  if (!newsletterId) {
    return jsonResponse({ error: 'newsletterId is required' }, 400);
  }

  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  const bodyCheck = validateBodySize(req, 10 * 1024);
  if (!bodyCheck.ok) return jsonResponse({ error: bodyCheck.error }, 413);

  let body: {
    tier?: string;
    email?: string;
    wallet?: string;
    txSignature?: string;
    /** For paid tiers, the subscription period in months */
    months?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const tier = sanitizeString(body.tier, 16) || 'free';
  if (!VALID_TIERS.includes(tier as SubscriptionTier)) {
    return jsonResponse({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` }, 400);
  }

  const subscriberId = safeKey(session.address);
  const email = body.email ? sanitizeString(body.email, 254).toLowerCase() : '';

  if (tier !== 'free' && email && !isValidEmail(email)) {
    return jsonResponse({ error: 'Invalid email address' }, 400);
  }

  const subKey = newsletterSubKey(newsletterId, subscriberId);

  // If paid tier, verify payment or tier config exists
  if (tier !== 'free') {
    const config = await kvGet<NewsletterTierConfig>(env.CACHE, tierConfigKey(newsletterId));
    if (!config) {
      // If no tier config yet, the creator hasn't set up paid tiers
      // Allow the subscribe request but mark as pending payment
      return jsonResponse(
        {
          error: 'Paid tiers not configured. Creator must set up pricing first.',
          requiresSetup: true,
        },
        400,
      );
    }

    const priceCents = tier === 'founding' ? config.foundingPrice : config.paidPrice;
    const months = Math.max(1, Math.min(12, body.months ?? 1));
    const totalCents = priceCents * months;
    const feeCents = Math.round((totalCents * config.platformShareBps) / 10000);
    const creatorCents = totalCents - feeCents;

    // Verify transaction signature for paid subscriptions
    if (!body.txSignature) {
      return jsonResponse(
        {
          error: 'Transaction signature required for paid subscription',
          requiresPayment: true,
          amount: {
            usdCents: totalCents,
            usd: (totalCents / 100).toFixed(2),
            months,
            tier,
            breakdown: {
              total: totalCents,
              creatorShare: creatorCents,
              platformFee: feeCents,
              creatorSharePct: (config.creatorShareBps / 100).toFixed(1),
              platformFeePct: (config.platformShareBps / 100).toFixed(1),
            },
            coinDiscount:
              config.coinTokenAddress && config.coinDiscountPct
                ? {
                    token: config.coinSymbol,
                    discountPct: config.coinDiscountPct,
                    minBalance: config.minCoinBalance,
                  }
                : undefined,
          },
        },
        402,
      );
    }

    // In production: verify the on-chain transaction via RPC
    // const verified = await verifyPaymentTransaction(body.txSignature, totalCents, config.payoutWallet, env);
    // if (!verified) return jsonResponse({ error: 'Payment verification failed' }, 400);

    // Record revenue
    const rev = (await kvGet<NewsletterRevenueRecord>(env.CACHE, revenueKey(newsletterId))) ?? {
      newsletterId,
      totalRevenue: 0,
      platformFees: 0,
      creatorEarnings: 0,
      monthlyRevenue: [],
      transactions: [],
      totalPayouts: 0,
      payouts: [],
    };

    const monthId = getMonthId();
    const tx: NewsletterRevenueRecord['transactions'][0] = {
      id: generateId(),
      type: 'subscription',
      tier: tier as SubscriptionTier,
      amountCents: totalCents,
      feeCents,
      creatorCents,
      txSignature: body.txSignature,
      subscriberWallet: session.address,
      createdAt: Date.now(),
    };

    rev.totalRevenue += totalCents;
    rev.platformFees += feeCents;
    rev.creatorEarnings += creatorCents;
    rev.transactions.unshift(tx);

    // Update monthly revenue
    const existingMonth = rev.monthlyRevenue.find((m) => m.month === monthId);
    if (existingMonth) {
      existingMonth.amount += totalCents;
      existingMonth.platformFee += feeCents;
      existingMonth.creatorShare += creatorCents;
    } else {
      rev.monthlyRevenue.push({
        month: monthId,
        amount: totalCents,
        platformFee: feeCents,
        creatorShare: creatorCents,
      });
    }

    await kvPut(env.CACHE, revenueKey(newsletterId), rev);
  }

  // Create/update subscription record
  const now = Date.now();
  const expiresAt =
    tier !== 'free'
      ? now + Math.max(1, Math.min(12, body.months ?? 1)) * 30 * 24 * 60 * 60 * 1000
      : null;

  const subscription: NewsletterSubscription = {
    id: subscriberId,
    tier: tier as SubscriptionTier,
    subscribedAt: now,
    expiresAt,
    active: true,
    email: email || undefined,
    wallet: session.address,
    coinDiscount: false,
  };

  await kvPut(env.CACHE, subKey, subscription, TTL_30D);

  // Index subscription
  const indexKey = newsletterIndexKey(newsletterId);
  const idx = (await kvGet<string[]>(env.CACHE, indexKey)) ?? [];
  if (!idx.includes(subscriberId)) {
    idx.push(subscriberId);
  }
  await kvPut(env.CACHE, indexKey, idx, TTL_30D);

  // Add to user's subscriptions
  const userKey = userSubscriptionsKey(session.address);
  const userSubs =
    (await kvGet<Array<{ newsletterId: string; tier: SubscriptionTier }>>(env.CACHE, userKey)) ??
    [];
  const existing = userSubs.find((s) => s.newsletterId === newsletterId);
  if (existing) {
    existing.tier = tier as SubscriptionTier;
  } else {
    userSubs.push({ newsletterId, tier: tier as SubscriptionTier });
  }
  await kvPut(env.CACHE, userKey, userSubs, TTL_30D);

  // Update subscriber counts
  await updateSubscriberCounts(env, newsletterId);

  return jsonResponse(
    {
      ok: true,
      newsletterId,
      tier,
      subscriberId,
      expiresAt,
      action: 'subscribed',
    },
    201,
  );
}

// ─── POST /api/newsletter/:id/unsubscribe ──────────────────────────

export async function handleCreatorSubUnsubscribe(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const nlIndex = pathParts.indexOf('newsletter');
  const newsletterId = nlIndex >= 0 && pathParts.length > nlIndex + 1 ? pathParts[nlIndex + 1] : '';

  if (!newsletterId) {
    return jsonResponse({ error: 'newsletterId is required' }, 400);
  }

  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  const subscriberId = safeKey(session.address);
  const subKey = newsletterSubKey(newsletterId, subscriberId);

  const existing = await kvGet<NewsletterSubscription>(env.CACHE, subKey);
  if (!existing) {
    return jsonResponse({ error: 'Not subscribed to this newsletter' }, 404);
  }

  existing.active = false;
  existing.expiresAt = Date.now(); // mark as expired
  await kvPut(env.CACHE, subKey, existing, TTL_30D);

  // Remove from subscriber index
  const indexKey = newsletterIndexKey(newsletterId);
  const idx = (await kvGet<string[]>(env.CACHE, indexKey)) ?? [];
  const filtered = idx.filter((id) => id !== subscriberId);
  await kvPut(env.CACHE, indexKey, filtered, TTL_30D);

  // Update user's subscriptions
  const userKey = userSubscriptionsKey(session.address);
  const userSubs =
    (await kvGet<Array<{ newsletterId: string; tier: SubscriptionTier }>>(env.CACHE, userKey)) ??
    [];
  const updated = userSubs.filter((s) => s.newsletterId !== newsletterId);
  await kvPut(env.CACHE, userKey, updated, TTL_30D);

  // Track unsub for analytics
  await trackAnalyticsEvent(env, newsletterId, 'unsubscribe');

  // Update subscriber counts
  await updateSubscriberCounts(env, newsletterId);

  return jsonResponse({ ok: true, newsletterId, action: 'unsubscribed' });
}

// ─── GET /api/newsletter/:id/subscribers ───────────────────────────

export async function handleCreatorSubSubscribers(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const nlIndex = pathParts.indexOf('newsletter');
  const newsletterId = nlIndex >= 0 && pathParts.length > nlIndex + 1 ? pathParts[nlIndex + 1] : '';

  if (!newsletterId) {
    return jsonResponse({ error: 'newsletterId is required' }, 400);
  }

  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  // Verify creator owns this newsletter
  const settings = await kvGet<NewsletterSettings>(env.CACHE, newsletterSettingsKey(newsletterId));
  if (settings && settings.creatorWallet.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Only the newsletter creator can view subscribers' }, 403);
  }

  const tierFilter = sanitizeString(url.searchParams.get('tier'), 16) as SubscriptionTier | '';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));

  const indexKey = newsletterIndexKey(newsletterId);
  const subscriberIds = (await kvGet<string[]>(env.CACHE, indexKey)) ?? [];

  // Load subscription details
  const subscribers: NewsletterSubscription[] = [];
  for (const id of subscriberIds) {
    const sub = await kvGet<NewsletterSubscription>(env.CACHE, newsletterSubKey(newsletterId, id));
    if (sub?.active && (!tierFilter || sub.tier === tierFilter)) {
      subscribers.push(sub);
    }
  }

  // Sort by subscribedAt descending
  subscribers.sort((a, b) => b.subscribedAt - a.subscribedAt);

  const start = (page - 1) * limit;
  const paged = subscribers.slice(start, start + limit);

  return jsonResponse({
    subscribers: paged.map((s) => ({
      id: s.id,
      tier: s.tier,
      email: s.email,
      wallet: s.wallet,
      subscribedAt: s.subscribedAt,
      active: s.active,
      expiresAt: s.expiresAt,
      coinDiscount: s.coinDiscount,
    })),
    total: subscribers.length,
    page,
    limit,
    hasMore: start + limit < subscribers.length,
  });
}

// ─── GET /api/newsletter/my-subscriptions ─────────────────────────

export async function handleMySubscriptions(req: Request, env: Env): Promise<Response> {
  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  const userKey = userSubscriptionsKey(session.address);
  const userSubs =
    (await kvGet<Array<{ newsletterId: string; tier: SubscriptionTier }>>(env.CACHE, userKey)) ??
    [];

  // Enrich with newsletter settings
  const enriched = await Promise.all(
    userSubs.map(async (sub) => {
      const settings = await kvGet<NewsletterSettings>(
        env.CACHE,
        newsletterSettingsKey(sub.newsletterId),
      );
      return {
        newsletterId: sub.newsletterId,
        tier: sub.tier,
        name: settings?.name ?? 'Unknown Newsletter',
        description: settings?.description ?? '',
        category: settings?.category ?? '',
        coverImage: settings?.coverImage,
        creatorWallet: settings?.creatorWallet ?? '',
        subscriberCounts: settings?.subscriberCounts ?? { free: 0, paid: 0, founding: 0, total: 0 },
      };
    }),
  );

  return jsonResponse({
    subscriptions: enriched,
    total: enriched.length,
  });
}

// ─── POST /api/newsletter/:id/tier ─────────────────────────────────

export async function handleCreatorSubTierConfig(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const nlIndex = pathParts.indexOf('newsletter');
  const newsletterId = nlIndex >= 0 && pathParts.length > nlIndex + 1 ? pathParts[nlIndex + 1] : '';

  if (!newsletterId) {
    return jsonResponse({ error: 'newsletterId is required' }, 400);
  }

  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  // Verify ownership
  const settings = await kvGet<NewsletterSettings>(env.CACHE, newsletterSettingsKey(newsletterId));
  if (settings && settings.creatorWallet.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Only the newsletter creator can configure tiers' }, 403);
  }

  const bodyCheck = validateBodySize(req, 10 * 1024);
  if (!bodyCheck.ok) return jsonResponse({ error: bodyCheck.error }, 413);

  let body: {
    paidPrice?: number;
    foundingPrice?: number;
    payoutWallet?: string;
    coinTokenAddress?: string;
    coinSymbol?: string;
    coinDiscountPct?: number;
    minCoinBalance?: string;
    creatorShareBps?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const existing = (await kvGet<NewsletterTierConfig>(env.CACHE, tierConfigKey(newsletterId))) ?? {
    newsletterId,
    creatorWallet: session.address,
    paidPrice: TIER_PRICES.paid.monthlyCents,
    foundingPrice: TIER_PRICES.founding.monthlyCents,
    payoutWallet: session.address,
    creatorShareBps: 9000, // 90%
    platformShareBps: 1000, // 10%
    updatedAt: Date.now(),
  };

  const config: NewsletterTierConfig = {
    ...existing,
    newsletterId,
    creatorWallet: session.address,
    paidPrice: body.paidPrice ?? existing.paidPrice,
    foundingPrice: body.foundingPrice ?? existing.foundingPrice,
    payoutWallet: body.payoutWallet
      ? sanitizeString(body.payoutWallet, 128)
      : existing.payoutWallet,
    coinTokenAddress: body.coinTokenAddress
      ? sanitizeString(body.coinTokenAddress, 128)
      : existing.coinTokenAddress,
    coinSymbol: body.coinSymbol
      ? sanitizeString(body.coinSymbol, 16).toUpperCase()
      : existing.coinSymbol,
    coinDiscountPct: body.coinDiscountPct ?? existing.coinDiscountPct,
    minCoinBalance: body.minCoinBalance
      ? sanitizeString(body.minCoinBalance, 64)
      : existing.minCoinBalance,
    creatorShareBps: Math.min(
      9900,
      Math.max(5000, body.creatorShareBps ?? existing.creatorShareBps),
    ),
    platformShareBps:
      10000 - Math.min(9900, Math.max(5000, body.creatorShareBps ?? existing.creatorShareBps)),
    updatedAt: Date.now(),
  };

  await kvPut(env.CACHE, tierConfigKey(newsletterId), config);

  return jsonResponse({
    ok: true,
    newsletterId,
    config: {
      paid: { price: (config.paidPrice / 100).toFixed(2), monthlyCents: config.paidPrice },
      founding: {
        price: (config.foundingPrice / 100).toFixed(2),
        monthlyCents: config.foundingPrice,
      },
      payoutWallet: config.payoutWallet,
      coinDiscount: config.coinTokenAddress
        ? {
            token: config.coinSymbol,
            discountPct: config.coinDiscountPct,
            minBalance: config.minCoinBalance,
          }
        : null,
      revenueSplit: {
        creator: `${(config.creatorShareBps / 100).toFixed(1)}%`,
        platform: `${(config.platformShareBps / 100).toFixed(1)}%`,
      },
    },
  });
}

// ─── GET /api/newsletter/:id/tier ──────────────────────────────────

export async function handleCreatorSubTierGet(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const nlIndex = pathParts.indexOf('newsletter');
  const newsletterId = nlIndex >= 0 && pathParts.length > nlIndex + 1 ? pathParts[nlIndex + 1] : '';

  if (!newsletterId) {
    return jsonResponse({ error: 'newsletterId is required' }, 400);
  }

  const config = await kvGet<NewsletterTierConfig>(env.CACHE, tierConfigKey(newsletterId));
  if (!config) {
    return jsonResponse({
      newsletterId,
      configured: false,
      availableTiers: [
        { tier: 'free', label: 'Free', price: 0, description: 'Public posts' },
        {
          tier: 'paid',
          label: 'Paid',
          price: TIER_PRICES.paid.monthlyUsd,
          description: 'Premium content, early access',
        },
        {
          tier: 'founding',
          label: 'Founding',
          price: TIER_PRICES.founding.monthlyUsd,
          description: 'Everything + recognition',
        },
      ],
    });
  }

  return jsonResponse({
    newsletterId,
    configured: true,
    creatorWallet: config.creatorWallet,
    payoutWallet: config.payoutWallet,
    tiers: {
      free: { price: 0, label: 'Free', description: 'Public posts' },
      paid: {
        price: (config.paidPrice / 100).toFixed(2),
        monthlyCents: config.paidPrice,
        label: 'Paid',
        description: 'Premium content, early access',
      },
      founding: {
        price: (config.foundingPrice / 100).toFixed(2),
        monthlyCents: config.foundingPrice,
        label: 'Founding',
        description: 'Everything + recognition',
      },
    },
    coinDiscount: config.coinTokenAddress
      ? {
          token: config.coinSymbol,
          tokenAddress: config.coinTokenAddress,
          discountPct: config.coinDiscountPct,
          minBalance: config.minCoinBalance,
        }
      : null,
    revenueSplit: {
      creator: `${(config.creatorShareBps / 100).toFixed(1)}%`,
      platform: `${(config.platformShareBps / 100).toFixed(1)}%`,
    },
  });
}

// ─── GET /api/newsletter/:id/analytics ────────────────────────────

export async function handleCreatorSubAnalytics(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const nlIndex = pathParts.indexOf('newsletter');
  const newsletterId = nlIndex >= 0 && pathParts.length > nlIndex + 1 ? pathParts[nlIndex + 1] : '';

  if (!newsletterId) {
    return jsonResponse({ error: 'newsletterId is required' }, 400);
  }

  const session = await requireSession(req, env);
  if (session instanceof Response) return session;

  // Verify creator owns this newsletter
  const settings = await kvGet<NewsletterSettings>(env.CACHE, newsletterSettingsKey(newsletterId));
  if (settings && settings.creatorWallet.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Only the newsletter creator can view analytics' }, 403);
  }

  // Build analytics from KV data
  const counts = (await kvGet<{ free: number; paid: number; founding: number }>(
    env.CACHE,
    subscriberCountKey(newsletterId),
  )) ?? { free: 0, paid: 0, founding: 0 };

  const revenue = (await kvGet<NewsletterRevenueRecord>(env.CACHE, revenueKey(newsletterId))) ?? {
    newsletterId,
    totalRevenue: 0,
    platformFees: 0,
    creatorEarnings: 0,
    monthlyRevenue: [],
    transactions: [],
    totalPayouts: 0,
    payouts: [],
  };

  const analytics =
    (await kvGet<NewsletterAnalytics['subscriberGrowth']>(env.CACHE, analyticsKey(newsletterId))) ??
    [];

  // Calculate this month's revenue
  const currentMonth = getMonthId();
  const thisMonthRev = revenue.monthlyRevenue.find((m) => m.month === currentMonth);
  const totalSubs = counts.free + counts.paid + counts.founding;

  // Churn calculation (simplified: unsubscribe events tracked as analytics events)
  const churnRate =
    totalSubs > 0
      ? Math.round(
          ((analytics.filter((a) => a.date.startsWith(currentMonth.slice(0, 7))).length || 0) /
            Math.max(totalSubs, 1)) *
            10000,
        ) / 100
      : 0;

  return jsonResponse({
    newsletterId,
    subscribers: {
      total: totalSubs,
      free: counts.free,
      paid: counts.paid,
      founding: counts.founding,
    },
    subscriberGrowth: analytics.slice(0, 365),
    revenue: {
      total: revenue.totalRevenue,
      thisMonth: thisMonthRev?.amount ?? 0,
      platformFees: revenue.platformFees,
      creatorEarnings: revenue.creatorEarnings,
      monthlyRevenue: revenue.monthlyRevenue,
      averagePerSubscriber:
        totalSubs > 0 ? Math.round((revenue.totalRevenue / totalSubs) * 100) / 100 : 0,
    },
    churn: {
      rate: churnRate,
      period: 'last_30_days',
    },
    recentTransactions: revenue.transactions.slice(0, 20),
    payouts: revenue.payouts.slice(0, 20),
    totalPayouts: revenue.totalPayouts,
  });
}

// ─── Internal helpers ─────────────────────────────────────────────

async function updateSubscriberCounts(env: Env, newsletterId: string): Promise<void> {
  const indexKey = newsletterIndexKey(newsletterId);
  const subscriberIds = (await kvGet<string[]>(env.CACHE, indexKey)) ?? [];

  let free = 0;
  let paid = 0;
  let founding = 0;

  for (const id of subscriberIds) {
    const sub = await kvGet<NewsletterSubscription>(env.CACHE, newsletterSubKey(newsletterId, id));
    if (sub?.active) {
      if (sub.tier === 'free') free++;
      else if (sub.tier === 'paid') paid++;
      else if (sub.tier === 'founding') founding++;
    }
  }

  await kvPut(env.CACHE, subscriberCountKey(newsletterId), { free, paid, founding });
}

async function trackAnalyticsEvent(
  env: Env,
  newsletterId: string,
  event: 'subscribe' | 'unsubscribe',
): Promise<void> {
  const key = analyticsKey(newsletterId);
  const existing = (await kvGet<Array<{ date: string; event: string }>>(env.CACHE, key)) ?? [];
  existing.push({ date: new Date().toISOString().slice(0, 10), event });
  // Keep last 365 days
  const trimmed = existing.slice(-365);
  await kvPut(env.CACHE, key, trimmed);
}
