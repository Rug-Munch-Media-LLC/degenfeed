/**
 * @degenfeed/api-worker — Creator Coin Dashboard API (TASK 3)
 *
 * Admin endpoints for creators who have launched coins:
 *   GET    /api/creator/coins                  — list creator's coins
 *   GET    /api/creator/coin/:address/stats    — real-time stats
 *   GET    /api/creator/coin/:address/holders  — holder list with balances
 *   GET    /api/creator/coin/:address/trades   — recent trades
 *   POST   /api/creator/coin/:address/burn     — burn tokens
 *   POST   /api/creator/coin/:address/airdrop  — airdrop to addresses
 *   POST   /api/creator/coin/:address/gated-post — create token-gated content
 *   GET    /api/creator/coin/:address/revenue  — revenue breakdown
 */

import { log } from '../index';
import {
  getCoinHolders,
  getCoinRevenue,
  getCoinStats,
  getCoinTrades,
} from '../lib/coin-onchain-data';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── KV Key Prefixes ─────────────────────────────────────────────────────

const CREATOR_COINS_PREFIX = 'creator:coins:';
const COIN_DATA_PREFIX = 'coin:data:';
const COIN_HOLDERS_PREFIX = 'coin:holders:';
const COIN_TRADES_PREFIX = 'coin:trades:';
const COIN_REVENUE_PREFIX = 'coin:revenue:';
const COIN_GATED_POSTS_PREFIX = 'coin:gated-posts:';
const _TTL_1H = 3600;
const _TTL_24H = 86400;

// ─── Helpers ─────────────────────────────────────────────────────────────

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
    const opts = ttl ? { expirationTtl: ttl } : {};
    await kv.put(key, JSON.stringify(value), opts);
  } catch (err) {
    log('warn', `[creator-dashboard] KV put failed: ${key}`, String(err));
  }
}

// ─── GET /api/creator/coins ─────────────────────────────────────────────

export async function handleCreatorCoinsList(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();
  const coins = await kvGet<
    Array<{ address: string; name: string; symbol: string; chain: string; deployedAt: number }>
  >(env.CACHE, CREATOR_COINS_PREFIX + wallet);

  // Honest platform stats: the worker does not track global totals, so these
  // are reported as 0 (unknown) rather than fabricated. Consumers must treat
  // 0 as "no data".
  return noCacheJsonResponse({
    coins: coins ?? [],
    totalLaunched: 0,
    totalVolume: 0,
    activePrebonding: 0,
  });
}

// ─── GET /api/creator/coin/:address/stats ───────────────────────────────

export async function handleCreatorCoinStats(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const address = parts[parts.length - 2]; // .../:address/stats

  if (!address || address.length < 10) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  // Try KV cache first
  const cached = await kvGet<Record<string, unknown>>(
    env.CACHE,
    COIN_DATA_PREFIX + address.toLowerCase(),
  );
  if (cached) {
    return noCacheJsonResponse(cached);
  }

  // Try on-chain query — infer chain from address format
  const chain = address.startsWith('0x') ? 'base' : 'solana';
  const stats = await getCoinStats(address, chain, env);

  if (!stats) {
    // FENCE: the on-chain query returned no data for this coin. Never
    // fabricate market numbers — return the stable stats shape with honest
    // zero/"unknown" values. Nothing is cached here, so a later real
    // on-chain result is never shadowed by a "no data" entry.
    return noCacheJsonResponse({
      name: 'Unknown',
      symbol: 'N/A',
      marketCap: '0',
      fdv: '0',
      price: '0',
      priceNative: '0',
      volume24h: '0',
      holderCount: 0,
      totalSupply: '0',
      totalRaised: '0',
      uniqueBuyers: 0,
      graduated: false,
      bondingPhase: 0,
      bondingPhaseName: 'Unknown',
      creator: '0x0000000000000000000000000000000000000000',
      creatorFeeBps: 0,
      platformFeeBps: 0,
      createdAt: 0,
      creatorClaimed: '0',
    });
  }

  // Cache on-chain data for 1 hour
  await kvPut(env.CACHE, COIN_DATA_PREFIX + address.toLowerCase(), stats, _TTL_1H).catch(() => {});

  return noCacheJsonResponse(stats);
}

// ─── GET /api/creator/coin/:address/holders ────────────────────────────

export async function handleCreatorCoinHolders(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const address = parts[parts.length - 2];

  if (!address || address.length < 10) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;

  // Try KV cache first
  const cached = await kvGet<
    Array<{
      address: string;
      balance: string;
      percentage: number;
      isCreator: boolean;
      lastTx: number;
    }>
  >(env.CACHE, COIN_HOLDERS_PREFIX + address.toLowerCase());

  if (cached) {
    const paginated = cached.slice(offset, offset + limit);
    return noCacheJsonResponse({ holders: paginated, total: cached.length, offset, limit });
  }

  // Try on-chain query
  const chain = address.startsWith('0x') ? 'base' : 'solana';
  const onChainHolders = await getCoinHolders(address, chain, env);

  if (onChainHolders.length > 0) {
    // Cache for 5 minutes
    await kvPut(env.CACHE, COIN_HOLDERS_PREFIX + address.toLowerCase(), onChainHolders, 300).catch(
      () => {},
    );
    const paginated = onChainHolders.slice(offset, offset + limit);
    return noCacheJsonResponse({ holders: paginated, total: onChainHolders.length, offset, limit });
  }

  // FENCE: no on-chain holder data is available for this coin. Never
  // fabricate holder addresses/balances — return an honest empty list.
  return noCacheJsonResponse({ holders: [], total: 0, offset, limit });
}

// ─── GET /api/creator/coin/:address/trades ─────────────────────────────

export async function handleCreatorCoinTrades(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const address = parts[parts.length - 2];

  if (!address || address.length < 10) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

  // Try KV cache first
  const cached = await kvGet<
    Array<{
      txHash: string;
      type: 'buy' | 'sell';
      trader: string;
      tokenAmount: string;
      nativeValue: string;
      price: string;
      timestamp: number;
    }>
  >(env.CACHE, COIN_TRADES_PREFIX + address.toLowerCase());

  if (cached) {
    return noCacheJsonResponse({ trades: cached.slice(0, limit) });
  }

  // Try on-chain query
  const chain = address.startsWith('0x') ? 'base' : 'solana';
  const onChainTrades = await getCoinTrades(address, chain, env, limit);

  if (onChainTrades.length > 0) {
    // Cache for 1 minute
    await kvPut(env.CACHE, COIN_TRADES_PREFIX + address.toLowerCase(), onChainTrades, 60).catch(
      () => {},
    );
    return noCacheJsonResponse({ trades: onChainTrades });
  }

  // FENCE: no on-chain trade data is available for this coin. Never fabricate
  // txHashes/traders — return an honest empty list.
  return noCacheJsonResponse({ trades: [] });
}

// ─── POST /api/creator/coin/:address/burn ──────────────────────────────

export async function handleCreatorCoinBurn(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const address = parts[parts.length - 2];

  if (!address || address.length < 10) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: { amount?: string };
  try {
    body = (await request.json()) as { amount?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const amount = sanitizeString(body.amount, 64) || '0';
  const amountNum = Number.parseInt(amount, 10);
  if (!amountNum || amountNum <= 0) {
    return jsonResponse({ error: 'amount must be a positive integer' }, 400);
  }

  // In production: execute on-chain burn via smart contract
  // const tx = await burnTokens(address, amountNum, env);

  // FENCE: on-chain burn is NOT implemented. Never fabricate a txHash or
  // report success — no transaction is ever submitted here.
  return jsonResponse(
    {
      ok: false,
      success: false,
      error:
        'On-chain token burning is not implemented. No tokens were burned and no transaction was submitted.',
      message:
        'POST /api/creator/coin/:address/burn is not implemented yet — no on-chain burn was executed.',
    },
    501,
  );
}

// ─── POST /api/creator/coin/:address/airdrop ───────────────────────────

export async function handleCreatorCoinAirdrop(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const address = parts[parts.length - 2];

  if (!address || address.length < 10) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  const sizeCheck = validateBodySize(request, 50 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: { recipients?: Array<{ address: string; amount: string }> };
  try {
    body = (await request.json()) as { recipients?: Array<{ address: string; amount: string }> };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.recipients || body.recipients.length === 0) {
    return jsonResponse({ error: 'recipients array is required' }, 400);
  }

  if (body.recipients.length > 500) {
    return jsonResponse({ error: 'Max 500 recipients per airdrop' }, 400);
  }

  for (const r of body.recipients) {
    if (!r.address || !r.amount || hasSuspiciousPayload(r.address)) {
      return jsonResponse({ error: `Invalid recipient: ${r.address || 'missing address'}` }, 400);
    }
  }

  // In production: execute batch airdrop on-chain

  // FENCE: on-chain airdrop is NOT implemented. Never fabricate a txHash or
  // report success — no tokens are ever distributed here.
  return jsonResponse(
    {
      ok: false,
      success: false,
      error:
        'On-chain airdrop is not implemented. No tokens were distributed and no transaction was submitted.',
      message:
        'POST /api/creator/coin/:address/airdrop is not implemented yet — no on-chain airdrop was executed.',
    },
    501,
  );
}

// ─── POST /api/creator/coin/:address/gated-post ────────────────────────

export async function handleCreatorCoinGatedPost(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const address = parts[parts.length - 2];

  if (!address || address.length < 10) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  const sizeCheck = validateBodySize(request, 100 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: {
    title?: string;
    content?: string;
    minTokens?: string;
    category?: 'exclusive' | 'announcement' | 'ama';
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const title = sanitizeString(body.title, 200) || 'Untitled';
  const content = sanitizeString(body.content, 50000) || '';
  const minTokens = sanitizeString(body.minTokens, 64) || '1000';
  const category = body.category || 'exclusive';

  if (!content) {
    return jsonResponse({ error: 'content is required' }, 400);
  }

  if (hasSuspiciousPayload(title) || hasSuspiciousPayload(content)) {
    return jsonResponse({ error: 'Invalid characters in content' }, 400);
  }

  const post = {
    id: crypto.randomUUID(),
    coinAddress: address.toLowerCase(),
    title,
    content,
    minTokens,
    category,
    createdAt: Date.now(),
    createdBy: session.address,
  };

  const key = COIN_GATED_POSTS_PREFIX + address.toLowerCase();
  const existing = (await kvGet<(typeof post)[]>(env.CACHE, key)) ?? [];
  existing.unshift(post);
  await kvPut(env.CACHE, key, existing);

  return jsonResponse({ success: true, post }, 201);
}

// ─── GET /api/creator/coin/:address/revenue ────────────────────────────

export async function handleCreatorCoinRevenue(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const address = parts[parts.length - 2];

  if (!address || address.length < 10) {
    return jsonResponse({ error: 'Invalid coin address' }, 400);
  }

  // Try KV cache first
  const cached = await kvGet<{
    totalRevenue: string;
    creatorFees: string;
    treasuryFees: string;
    tipsReceived: string;
    platformFees: string;
    revenueByDay: Array<{ date: string; amount: string }>;
  }>(env.CACHE, COIN_REVENUE_PREFIX + address.toLowerCase());

  if (cached) {
    return noCacheJsonResponse(cached);
  }

  // Try on-chain query
  const chain = address.startsWith('0x') ? 'base' : 'solana';
  const onChainRevenue = await getCoinRevenue(address, chain, env);

  if (onChainRevenue) {
    // Cache for 5 minutes
    await kvPut(env.CACHE, COIN_REVENUE_PREFIX + address.toLowerCase(), onChainRevenue, 300).catch(
      () => {},
    );
    return noCacheJsonResponse(onChainRevenue);
  }

  // FENCE: no on-chain revenue data is available for this coin. Never
  // fabricate fee totals or a daily breakdown — return the stable revenue
  // shape with honest zero values and an empty breakdown.
  return noCacheJsonResponse({
    totalRevenue: '0',
    creatorFees: '0',
    treasuryFees: '0',
    tipsReceived: '0',
    platformFees: '0',
    revenueByDay: [],
  });
}

// ─── GET /api/platform/revenue (public) ────────────────────────────────

export async function handlePlatformRevenue(_request: Request, env: Env): Promise<Response> {
  const revenue = await kvGet<{
    totalFeesCollected: string;
    totalTrades: number;
    activeCoins: number;
    dailyVolume: string;
    feeDistribution: {
      protocolTreasury: string;
      degenfeedOps: string;
      creatorRewardPool: string;
    };
    lastUpdated: number;
  }>(env.CACHE, 'platform:revenue:aggregate');

  if (!revenue) {
    // FENCE: the worker does not track platform-wide revenue aggregates, so
    // none are reported — never fabricate platform totals. Consumers must
    // treat 0 as "no data". lastUpdated 0 signals "never aggregated".
    return noCacheJsonResponse({
      totalFeesCollected: '0',
      totalTrades: 0,
      activeCoins: 0,
      dailyVolume: '0',
      feeDistribution: {
        protocolTreasury: '0',
        degenfeedOps: '0',
        creatorRewardPool: '0',
      },
      lastUpdated: 0,
    });
  }

  return noCacheJsonResponse(revenue);
}
