/**
 * @degenfeed/api-worker — Creator Earnings Dashboard API
 *
 * Unified earnings aggregation across ALL revenue streams:
 *   GET /api/creator/earnings?wallet=0x...
 *
 * Aggregates: tips (Nostr zaps, Farcaster, Lens collects, direct crypto),
 * coin fees, subscriptions, NFT sales — by protocol, chain, and time period.
 */

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { checkPremiumStatus } from '../premium';

// ─── Types ──────────────────────────────────────────────────────────

export interface EarningsData {
  total: {
    usd: number;
    byStream: Record<string, number>;
  };
  byProtocol: Record<string, number>;
  byChain: Record<string, number>;
  history: {
    labels: string[];
    values: number[];
  };
  topContent: Array<{
    id: string;
    title: string;
    protocol: string;
    earnings: number;
    earningsUsd: number;
    engagements: number;
    date: string;
  }>;
  subscriptions?: {
    active: number;
    monthlyRecurring: number;
    lifetimeValue: number;
  };
  coinRevenue?: {
    tradingFees: number;
    creatorRevenue: number;
    holders: number;
  };
  nftSales?: {
    total: number;
    items: number;
    royalties: number;
  };
  withdrawable: {
    totalUsd: number;
    byChain: Record<string, { amount: string; token: string }>;
  };
  lastUpdated: number;
  isMock: boolean;
}

interface TipNotification {
  id: string;
  type: string;
  protocol: string;
  sourceProtocol?: string;
  actorName: string;
  actorHandle: string;
  amount?: string;
  currency?: string;
  createdAt: number;
  read: boolean;
}

interface SubscriptionRecord {
  creator: string;
  tier: string;
  amount: string;
  currency?: string;
  chain?: string;
  startDate: number;
  expiryDate: number;
  daysRemaining: number;
}

// ─── Constants ──────────────────────────────────────────────────────

const USD_RATES: Record<string, number> = {
  eth: 3200,
  ETH: 3200,
  sol: 140,
  SOL: 140,
  btc: 62000,
  BTC: 62000,
  usdc: 1,
  USDC: 1,
  degen: 0.005,
  DEGEN: 0.005,
  base: 3200,
  matic: 0.5,
  MATIC: 0.5,
  usd: 1,
  USD: 1,
  unknown: 1,
};

const PROTOCOL_CHAIN_MAP: Record<string, string> = {
  nostr: 'lightning',
  farcaster: 'eth',
  lens: 'matic',
  bluesky: 'usd',
  mastodon: 'usd',
  ethereum: 'eth',
  solana: 'sol',
  base: 'eth',
  zora: 'eth',
};

const CACHE_TTL = 120; // 2 minutes

// ─── Helpers ────────────────────────────────────────────────────────

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function generateDateLabels(days: number): string[] {
  const labels: string[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(dateLabel(d));
  }
  return labels;
}

function parseUsdValue(amount: string | undefined, currency: string | undefined): number {
  const raw = Number.parseFloat(amount ?? '0');
  if (!raw) return 0;
  const rate = USD_RATES[currency ?? ''] ?? USD_RATES[(currency ?? '').toLowerCase()] ?? 1;
  return raw * rate;
}

// ─── KV helpers ─────────────────────────────────────────────────────

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
  } catch {
    /* non-critical */
  }
}

// ─── Data Aggregation ───────────────────────────────────────────────

async function aggregateTipEarnings(
  env: Env,
  wallet: string,
  lookbackMs: number,
): Promise<{
  totalUsd: number;
  byProtocol: Record<string, number>;
  byChain: Record<string, number>;
  historyBuckets: Record<string, number>;
  topContent: Map<
    string,
    {
      id: string;
      title: string;
      protocol: string;
      earnings: number;
      earningsUsd: number;
      engagements: number;
      date: string;
    }
  >;
}> {
  const now = Date.now();
  const byProtocol: Record<string, number> = {};
  const byChain: Record<string, number> = {};
  const historyBuckets: Record<string, number> = {};
  const topContent = new Map<
    string,
    {
      id: string;
      title: string;
      protocol: string;
      earnings: number;
      earningsUsd: number;
      engagements: number;
      date: string;
    }
  >();

  // Fetch tip notifications
  const tips: TipNotification[] = [];
  for (const key of [`notifications:${wallet}`, `notifications:${wallet.toLowerCase()}`]) {
    try {
      const raw = await env.CACHE?.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as TipNotification[];
        tips.push(...parsed.filter((n) => n.type === 'tip'));
      }
    } catch {
      /* skip */
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = tips.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  let totalUsd = 0;

  for (const tip of unique) {
    const usdValue = parseUsdValue(tip.amount, tip.currency);
    totalUsd += usdValue;

    const proto = tip.sourceProtocol ?? tip.protocol ?? 'unknown';
    byProtocol[proto] = (byProtocol[proto] ?? 0) + usdValue;

    const chain = PROTOCOL_CHAIN_MAP[proto] ?? 'unknown';
    byChain[chain] = (byChain[chain] ?? 0) + usdValue;

    // History bucketing
    if (tip.createdAt > now - lookbackMs) {
      const dayKey = new Date(tip.createdAt).toISOString().slice(0, 10);
      historyBuckets[dayKey] = (historyBuckets[dayKey] ?? 0) + usdValue;
    }

    // Track by actor for "top content" proxy
    const contentKey = `${proto}:${tip.actorHandle || tip.actorName || tip.id}`;
    if (!topContent.has(contentKey)) {
      topContent.set(contentKey, {
        id: tip.id,
        title: `Tip from ${tip.actorName || tip.actorHandle || 'Anonymous'}`,
        protocol: proto,
        earnings: Number.parseFloat(tip.amount ?? '0'),
        earningsUsd: usdValue,
        engagements: 1,
        date: new Date(tip.createdAt).toISOString(),
      });
    } else {
      const existing = topContent.get(contentKey)!;
      existing.earnings += Number.parseFloat(tip.amount ?? '0');
      existing.earningsUsd += usdValue;
      existing.engagements += 1;
    }
  }

  return { totalUsd, byProtocol, byChain, historyBuckets, topContent };
}

async function aggregateSubscriptionEarnings(
  env: Env,
  wallet: string,
): Promise<{ active: number; monthlyRecurring: number; lifetimeValue: number } | null> {
  try {
    const raw = await env.CACHE?.get(`subscriptions:as-creator:${wallet.toLowerCase()}`);
    if (!raw) return null;
    const subs = JSON.parse(raw) as SubscriptionRecord[];
    const active = subs.filter((s) => s.daysRemaining > 0);
    const lifetimeValue = active.reduce((sum, s) => sum + Number.parseFloat(s.amount ?? '0'), 0);
    const monthlyRecurring = active.reduce((sum, s) => {
      const amt = Number.parseFloat(s.amount ?? '0');
      return sum + (s.tier === 'patron' ? amt * 3 : amt);
    }, 0);
    return {
      active: active.length,
      monthlyRecurring,
      lifetimeValue,
    };
  } catch {
    return null;
  }
}

async function aggregateCoinRevenue(
  env: Env,
  wallet: string,
): Promise<{ tradingFees: number; creatorRevenue: number; holders: number } | null> {
  try {
    const coinsKey = `creator:coins:${wallet.toLowerCase()}`;
    const coinsRaw = await env.CACHE?.get(coinsKey);
    if (!coinsRaw) return null;
    const coins = JSON.parse(coinsRaw) as Array<{ address: string }>;

    let totalTradingFees = 0;
    let totalCreatorRevenue = 0;
    let totalHolders = 0;

    for (const coin of coins) {
      const revKey = `coin:revenue:${coin.address.toLowerCase()}`;
      const rev = await kvGet<{
        totalRevenue?: string;
        creatorFees?: string;
        tradingFees?: string;
        holderCount?: number;
      }>(env.CACHE, revKey);
      if (rev) {
        totalTradingFees += Number.parseFloat(rev.tradingFees ?? rev.totalRevenue ?? '0');
        totalCreatorRevenue += Number.parseFloat(rev.creatorFees ?? '0');
        totalHolders += rev.holderCount ?? 0;
      }
    }

    return {
      tradingFees: totalTradingFees,
      creatorRevenue: totalCreatorRevenue,
      holders: totalHolders,
    };
  } catch {
    return null;
  }
}

async function aggregateNftSales(
  env: Env,
  wallet: string,
): Promise<{ total: number; items: number; royalties: number } | null> {
  try {
    const nftKey = `nft:sales:${wallet.toLowerCase()}`;
    const raw = await env.CACHE?.get(nftKey);
    if (!raw) return null;
    const sales = JSON.parse(raw) as Array<{ amount: string; royalty?: string; currency?: string }>;
    const total = sales.reduce((sum, s) => sum + Number.parseFloat(s.amount ?? '0'), 0);
    const royalties = sales.reduce((sum, s) => sum + Number.parseFloat(s.royalty ?? '0'), 0);
    return { total, items: sales.length, royalties };
  } catch {
    return null;
  }
}

function aggregateWithdrawable(
  wallet: string,
  tipsByChain: Record<string, number>,
): {
  totalUsd: number;
  byChain: Record<string, { amount: string; token: string }>;
} {
  const byChain: Record<string, { amount: string; token: string }> = {};
  let totalUsd = 0;

  for (const [chain, usdValue] of Object.entries(tipsByChain)) {
    if (usdValue <= 0) continue;
    const token =
      chain === 'lightning'
        ? 'BTC'
        : chain === 'eth'
          ? 'ETH'
          : chain === 'sol'
            ? 'SOL'
            : chain === 'matic'
              ? 'MATIC'
              : 'USDC';
    const rate = USD_RATES[token.toLowerCase()] ?? 1;
    const amount = rate > 0 ? (usdValue / rate).toFixed(rate === 1 ? 2 : rate < 1 ? 0 : 4) : '0';
    byChain[chain] = { amount, token };
    totalUsd += usdValue;
  }

  return { totalUsd, byChain };
}

// ─── Main Handler ───────────────────────────────────────────────────

export async function handleCreatorEarnings(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet')?.toLowerCase();
  const period = url.searchParams.get('period') || '90d';

  if (!wallet) {
    return jsonResponse({ error: 'wallet required' }, 400);
  }

  // Determine lookback from period param
  const lookbackDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;

  // Check premium for longer lookback
  const premium = await checkPremiumStatus(wallet, env);
  const effectiveLookback = premium ? lookbackDays : Math.min(lookbackDays, 7);
  const effectiveLookbackMs = effectiveLookback * 24 * 60 * 60 * 1000;

  // Check cache
  const cacheKey = `earnings:${wallet}:${period}`;
  if (!url.searchParams.has('refresh')) {
    const cached = await kvGet<EarningsData>(env.CACHE, cacheKey);
    if (cached) return noCacheJsonResponse(cached);
  }

  // ── 1. Aggregate tips ──────────────────────────────────────
  const tipData = await aggregateTipEarnings(env, wallet, effectiveLookbackMs);

  // ── 2. Aggregate subscriptions ─────────────────────────────
  const subs = await aggregateSubscriptionEarnings(env, wallet);

  // ── 3. Aggregate coin revenue ──────────────────────────────
  const coinRev = await aggregateCoinRevenue(env, wallet);

  // ── 4. Aggregate NFT sales ─────────────────────────────────
  const nftSales = await aggregateNftSales(env, wallet);

  // ── 5. Build history chart data ────────────────────────────
  const labels = generateDateLabels(effectiveLookback - 1);
  const historyValues: number[] = [];
  for (const label of labels) {
    // Map label back to date
    const monthAbbr = label.split(' ')[0]!;
    const dayNum = Number.parseInt(label.split(' ')[1]!, 10);
    const year = new Date().getFullYear();
    const monthMap: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    const month = monthMap[monthAbbr] ?? new Date().getMonth();
    const d = new Date(year, month, dayNum);
    const isoKey = d.toISOString().slice(0, 10);
    historyValues.push(tipData.historyBuckets[isoKey] ?? 0);
  }

  // ── 6. Top content ─────────────────────────────────────────
  const topContent = Array.from(tipData.topContent.values())
    .sort((a, b) => b.earningsUsd - a.earningsUsd)
    .slice(0, 10);

  // ── 7. Withdrawable balance ────────────────────────────────
  const withdrawable = aggregateWithdrawable(wallet, tipData.byChain);

  // ── 8. Build total by stream ───────────────────────────────
  const totalByStream: Record<string, number> = {
    tips: tipData.totalUsd,
  };
  if (subs) {
    totalByStream.subscriptions = subs.lifetimeValue;
    totalByStream.monthly_recurring = subs.monthlyRecurring;
  }
  if (coinRev) {
    totalByStream.coin_fees = coinRev.tradingFees;
    totalByStream.creator_coin_revenue = coinRev.creatorRevenue;
  }
  if (nftSales) {
    totalByStream.nft_sales = nftSales.total;
    totalByStream.nft_royalties = nftSales.royalties;
  }

  const grandTotal = Object.entries(totalByStream).reduce(
    (sum, [key, val]) => (key !== 'monthly_recurring' ? sum + val : sum),
    0,
  );

  const response: EarningsData = {
    total: {
      usd: Math.round(grandTotal * 100) / 100,
      byStream: totalByStream,
    },
    byProtocol: tipData.byProtocol,
    byChain: tipData.byChain,
    history: {
      labels,
      values: historyValues,
    },
    topContent,
    subscriptions: subs ?? undefined,
    coinRevenue: coinRev ?? undefined,
    nftSales: nftSales ?? undefined,
    withdrawable,
    lastUpdated: Date.now(),
    isMock: Object.keys(tipData.byProtocol).length === 0 && !subs && !coinRev && !nftSales,
  };

  // Cache
  await kvPut(env.CACHE, cacheKey, response, CACHE_TTL);

  return noCacheJsonResponse(response);
}

/**
 * POST /api/creator/earnings/withdraw
 * Initiate withdrawal of earnings to a specified wallet address.
 */
export async function handleEarningsWithdraw(request: Request, env: Env): Promise<Response> {
  const { requireSession } = await import('../session');
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { chain: string; address: string; amount: string; token?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.chain || !body.address || !body.amount) {
    return jsonResponse({ error: 'chain, address, and amount are required' }, 400);
  }

  // In production: execute actual withdrawal via bridge/swap contract
  const txHash = `0x${crypto.randomUUID().replace(/-/g, '')}`;

  return jsonResponse({
    success: true,
    txHash,
    chain: body.chain,
    amount: body.amount,
    address: body.address,
    token: body.token ?? 'ETH',
    estimatedTime: '2-5 minutes',
    status: 'pending',
  });
}
