/**
 * @degenfeed/api-worker — Coin Statistics & Leaderboard API (TASK 1)
 *
 * Public endpoints for platform-wide coin statistics:
 *   GET /api/coins/stats/overview        — Platform overview
 *   GET /api/coins/stats/top             — Top coins by dimension
 *   GET /api/coins/stats/trending        — Highest volume growth (24h)
 *   GET /api/coins/stats/new             — Newest coins (launched < 7 days)
 *   GET /api/coins/stats/gainers         — Top % gainers
 *   GET /api/coins/stats/losers          — Top % losers
 *   GET /api/coins/stats/most-holders    — Most holders
 *   GET /api/coins/stats/highest-volume  — Highest 24h volume
 */

import { noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export interface CoinStatsItem {
  rank: number;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  priceChange24h: number;
  priceChange7d: number;
  bondingCurvePhase: number;
  address: string;
  chain: string;
  createdAt: number;
}

export interface CoinStatsOverview {
  totalCoins: number;
  totalVolume: number;
  totalHolders: number;
  totalMarketCap: number;
  averagePrice: number;
  graduatedCount: number;
  bondingCount: number;
}

// ─── Mock Data Generator ──────────────────────────────────────────────

const MOCK_NAMES = [
  { name: 'Degen Alice', symbol: 'ALICE' },
  { name: 'Bob Protocol', symbol: 'BOB' },
  { name: 'Charlie Coin', symbol: 'CHAR' },
  { name: 'Diana Token', symbol: 'DIA' },
  { name: 'Eve Finance', symbol: 'EVE' },
  { name: 'Frank DeFi', symbol: 'FRANK' },
  { name: 'Grace Swap', symbol: 'GRACE' },
  { name: 'Harry Hedge', symbol: 'HARRY' },
  { name: 'Ivy Invest', symbol: 'IVY' },
  { name: 'Jack Jump', symbol: 'JUMP' },
  { name: 'Kate Koin', symbol: 'KATE' },
  { name: 'Leo Launch', symbol: 'LEO' },
  { name: 'Mia Meme', symbol: 'MIA' },
  { name: 'Noah NFT', symbol: 'NOAH' },
  { name: 'Oscar Ops', symbol: 'OSCAR' },
  { name: 'Pia Pump', symbol: 'PIA' },
  { name: 'Quinn Quest', symbol: 'QUINN' },
  { name: 'Rex Rocket', symbol: 'REX' },
  { name: 'Sage Swap', symbol: 'SAGE' },
  { name: 'Tess Token', symbol: 'TESS' },
  { name: 'Uma Unicorn', symbol: 'UMA' },
  { name: 'Vince Vault', symbol: 'VINCE' },
  { name: 'Wade Whale', symbol: 'WADE' },
  { name: 'Xena Xchange', symbol: 'XENA' },
  { name: 'Yuki Yield', symbol: 'YUKI' },
  { name: 'Zane Zone', symbol: 'ZANE' },
];

function generateMockCoins(count = 50): CoinStatsItem[] {
  return Array.from({ length: Math.min(count, MOCK_NAMES.length) }, (_, i) => {
    const entry = MOCK_NAMES[i];
    if (!entry) {
      const _throwErr = new Error(`Missing mock name at index ${i}`);
      throw _throwErr;
    }
    const basePrice = Math.random() * 0.05 + 0.0001;
    const now = Date.now();
    return {
      rank: i + 1,
      symbol: entry.symbol,
      name: entry.name,
      price: basePrice,
      marketCap: basePrice * (500_000_000 + Math.random() * 2_000_000_000),
      volume24h: 1000 + Math.random() * 5_000_000,
      holders: Math.floor(Math.random() * 5000) + 10,
      priceChange24h: -30 + Math.random() * 80,
      priceChange7d: -45 + Math.random() * 100,
      bondingCurvePhase: Math.floor(Math.random() * 5),
      address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
      chain: Math.random() > 0.5 ? 'base' : 'solana',
      createdAt: now - Math.random() * 86400000 * 30,
    };
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────

function generateOverview(): CoinStatsOverview {
  const coins: CoinStatsItem[] = [];
  return {
    totalCoins: coins.length,
    totalVolume: coins.reduce((s, c) => s + c.volume24h, 0),
    totalHolders: coins.reduce((s, c) => s + c.holders, 0),
    totalMarketCap: coins.reduce((s, c) => s + c.marketCap, 0),
    averagePrice: coins.reduce((s, c) => s + c.price, 0) / coins.length,
    graduatedCount: coins.filter((c) => c.bondingCurvePhase >= 4).length,
    bondingCount: coins.filter((c) => c.bondingCurvePhase < 4).length,
  };
}

function sortAndRank(
  coins: CoinStatsItem[],
  sortFn: (a: CoinStatsItem, b: CoinStatsItem) => number,
): CoinStatsItem[] {
  return [...coins]
    .sort(sortFn)
    .slice(0, 50)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

// ─── ENDPOINT HANDLERS ────────────────────────────────────────────────

/**
 * GET /api/coins/stats/overview — Platform aggregate stats
 */
export async function handleCoinStatsOverview(_request: Request, env: Env): Promise<Response> {
  try {
    // Try real data from CACHE first
    const raw = await env.CACHE?.get('coins:stats:overview');
    if (raw) {
      return noCacheJsonResponse(JSON.parse(raw));
    }
  } catch {
    // Fall through to mock
  }
  return noCacheJsonResponse(generateOverview());
}

/**
 * GET /api/coins/stats/top — Top coins sorted by query param `by`
 * Query: ?by=marketCap|volume24h|holders|gain24h|gain7d
 */
export async function handleCoinStatsTop(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const by = url.searchParams.get('by') || 'marketCap';

  const coins = generateMockCoins(50);

  const sortMap = new Map<string, (a: CoinStatsItem, b: CoinStatsItem) => number>([
    ['marketCap', (a, b) => b.marketCap - a.marketCap],
    ['volume24h', (a, b) => b.volume24h - a.volume24h],
    ['holders', (a, b) => b.holders - a.holders],
    ['gain24h', (a, b) => b.priceChange24h - a.priceChange24h],
    ['gain7d', (a, b) => b.priceChange7d - a.priceChange7d],
  ]);

  const sortFn = sortMap.get(by) ?? sortMap.get('marketCap')!;
  return noCacheJsonResponse({ coins: sortAndRank(coins, sortFn), sortedBy: by });
}

/**
 * GET /api/coins/stats/trending — Highest volume growth (24h momentum)
 */
export async function handleCoinStatsTrending(_request: Request, _env: Env): Promise<Response> {
  const coins = generateMockCoins(50);
  // Trending = highest 24h volume * positive price momentum
  const scored = coins.map((c) => ({
    ...c,
    momentumScore: c.volume24h * (1 + Math.max(0, c.priceChange24h) / 100),
  }));
  const sorted = scored.sort((a, b) => b.momentumScore - a.momentumScore).slice(0, 30);
  return noCacheJsonResponse({
    coins: sorted.map((c, i) => {
      const { momentumScore: _, ...rest } = c;
      return { ...rest, rank: i + 1 };
    }),
  });
}

/**
 * GET /api/coins/stats/new — Newest coins (last 7 days)
 */
export async function handleCoinStatsNew(_request: Request, _env: Env): Promise<Response> {
  const coins = generateMockCoins(50);
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recent = coins.filter((c) => c.createdAt >= sevenDaysAgo);
  // If mock didn't generate enough recent, create some fresh ones
  const result = recent.length >= 5 ? recent : coins.slice(0, 15);
  return noCacheJsonResponse({
    coins: sortAndRank(result, (a, b) => b.createdAt - a.createdAt),
  });
}

/**
 * GET /api/coins/stats/gainers — Top % gainers
 * Query: ?period=24h|7d|30d
 */
export async function handleCoinStatsGainers(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '24h';
  const coins = generateMockCoins(50);

  const changeMap = new Map<string, (c: CoinStatsItem) => number>([
    ['24h', (c) => c.priceChange24h],
    ['7d', (c) => c.priceChange7d],
    ['30d', (c) => c.priceChange7d], // mock: use 7d as proxy
  ]);

  const getChange = changeMap.get(period) ?? changeMap.get('24h')!;
  const sorted = [...coins].sort((a, b) => getChange(b) - getChange(a));
  return noCacheJsonResponse({
    coins: sorted.slice(0, 30).map((c, i) => ({ ...c, rank: i + 1 })),
    period,
  });
}

/**
 * GET /api/coins/stats/losers — Top % losers
 * Query: ?period=24h|7d|30d
 */
export async function handleCoinStatsLosers(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '24h';
  const coins = generateMockCoins(50);

  const changeMap = new Map<string, (c: CoinStatsItem) => number>([
    ['24h', (c) => c.priceChange24h],
    ['7d', (c) => c.priceChange7d],
    ['30d', (c) => c.priceChange7d],
  ]);

  const getChange = changeMap.get(period) ?? changeMap.get('24h')!;
  const sorted = [...coins].sort((a, b) => getChange(a) - getChange(b));
  return noCacheJsonResponse({
    coins: sorted.slice(0, 30).map((c, i) => ({ ...c, rank: i + 1 })),
    period,
  });
}

/**
 * GET /api/coins/stats/most-holders — Coins with most holders
 */
export async function handleCoinStatsMostHolders(_request: Request, _env: Env): Promise<Response> {
  const coins = generateMockCoins(50);
  return noCacheJsonResponse({
    coins: sortAndRank(coins, (a, b) => b.holders - a.holders),
  });
}

/**
 * GET /api/coins/stats/highest-volume — Highest 24h trading volume
 */
export async function handleCoinStatsHighestVolume(
  _request: Request,
  _env: Env,
): Promise<Response> {
  const coins = generateMockCoins(50);
  return noCacheJsonResponse({
    coins: sortAndRank(coins, (a, b) => b.volume24h - a.volume24h),
  });
}
