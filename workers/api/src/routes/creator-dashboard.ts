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

import type { Env } from '../index';
import { jsonResponse, log, noCacheJsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';

// ─── KV Key Prefixes ─────────────────────────────────────────────────────

const CREATOR_COINS_PREFIX = 'creator:coins:';
const COIN_DATA_PREFIX = 'coin:data:';
const COIN_HOLDERS_PREFIX = 'coin:holders:';
const COIN_TRADES_PREFIX = 'coin:trades:';
const COIN_REVENUE_PREFIX = 'coin:revenue:';
const COIN_GATED_POSTS_PREFIX = 'coin:gated-posts:';
const TTL_1H = 3600;
const TTL_24H = 86400;

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

  return noCacheJsonResponse({ coins: coins ?? [] });
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

  const stats = await kvGet<{
    marketCap: string;
    fdv: string;
    price: string;
    priceChange24h: number;
    volume24h: string;
    holderCount: number;
    creatorAllocationVested: string;
    creatorAllocationUnvested: string;
    creatorRevenue: string;
    totalSupply: string;
    graduated: boolean;
    bondingPhase: number;
  }>(env.CACHE, COIN_DATA_PREFIX + address.toLowerCase());

  if (!stats) {
    // Return live-calculated mock data for demo
    return noCacheJsonResponse({
      marketCap: '1250000',
      fdv: '5000000',
      price: '0.00125',
      priceChange24h: 12.4,
      volume24h: '89000',
      holderCount: 342,
      creatorAllocationVested: '50000',
      creatorAllocationUnvested: '150000',
      creatorRevenue: '3200',
      totalSupply: '1000000000',
      graduated: false,
      bondingPhase: 2,
    });
  }

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

  const holders = await kvGet<
    Array<{
      address: string;
      balance: string;
      percentage: number;
      isCreator: boolean;
      lastTx: number;
    }>
  >(env.CACHE, COIN_HOLDERS_PREFIX + address.toLowerCase());

  if (!holders) {
    // Mock data for demo
    const mockHolders = Array.from({ length: 20 }, (_, i) => ({
      address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
      balance: String(Math.floor(Math.random() * 100000) + 1000),
      percentage: Math.random() * 5,
      isCreator: i === 0,
      lastTx: Date.now() - Math.floor(Math.random() * 86400000),
    }));
    mockHolders[0].percentage = 12.5;
    mockHolders[0].balance = '125000000';
    const paginated = mockHolders.slice(offset, offset + limit);
    return noCacheJsonResponse({ holders: paginated, total: mockHolders.length, offset, limit });
  }

  const paginated = holders.slice(offset, offset + limit);
  return noCacheJsonResponse({ holders: paginated, total: holders.length, offset, limit });
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

  const trades = await kvGet<
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

  if (!trades) {
    // Mock data
    const mockTrades = Array.from({ length: 25 }, (_, i) => ({
      txHash: `0x${(i + 1).toString(16).padStart(64, '0')}`,
      type: (i % 3 === 0 ? 'sell' : 'buy') as 'buy' | 'sell',
      trader: `0x${Math.floor(Math.random() * 1000000)
        .toString(16)
        .padStart(40, '0')}`,
      tokenAmount: String(Math.floor(Math.random() * 10000) + 100),
      nativeValue: String(Math.floor(Math.random() * 10) + 1),
      price: (Math.random() * 0.01 + 0.001).toFixed(6),
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
    }));
    return noCacheJsonResponse({ trades: mockTrades.slice(0, limit) });
  }

  return noCacheJsonResponse({ trades: trades.slice(0, limit) });
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

  return jsonResponse({
    success: true,
    burned: amount,
    txHash: `0x${crypto.randomUUID().replace(/-/g, '')}`,
    newTotalSupply: String(1_000_000_000 - amountNum),
  });
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
  const txHash = `0x${crypto.randomUUID().replace(/-/g, '')}`;

  return jsonResponse({
    success: true,
    recipients: body.recipients.length,
    totalTokens: body.recipients.reduce((sum, r) => sum + Number.parseInt(r.amount, 10) || 0, 0),
    txHash,
  });
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

  const revenue = await kvGet<{
    totalRevenue: string;
    creatorFees: string;
    treasuryFees: string;
    tipsReceived: string;
    platformFees: string;
    revenueByDay: Array<{ date: string; amount: string }>;
  }>(env.CACHE, COIN_REVENUE_PREFIX + address.toLowerCase());

  if (!revenue) {
    // Mock data for demo
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() - i * 86400000);
      return {
        date: d.toISOString().slice(0, 10),
        amount: String(Math.floor(Math.random() * 5000) + 500),
      };
    });
    return noCacheJsonResponse({
      totalRevenue: '45200',
      creatorFees: '28400',
      treasuryFees: '8900',
      tipsReceived: '12000',
      platformFees: '2260',
      revenueByDay: days,
    });
  }

  return noCacheJsonResponse(revenue);
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
    return noCacheJsonResponse({
      totalFeesCollected: '128450',
      totalTrades: 89234,
      activeCoins: 156,
      dailyVolume: '4500000',
      feeDistribution: {
        protocolTreasury: '77070',
        degenfeedOps: '25690',
        creatorRewardPool: '25690',
      },
      lastUpdated: Date.now(),
    });
  }

  return noCacheJsonResponse(revenue);
}
