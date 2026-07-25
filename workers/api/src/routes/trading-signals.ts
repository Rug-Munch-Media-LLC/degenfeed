/**
 * @degenfeed/api-worker — Social Trading Signals
 *
 * Real-time social trading feed showing buy/sell activity across
 * creator coins, trending coins by social volume, and whale movements.
 *
 * KV keys:
 *   trading:signals              → TradingSignal[] (ring buffer, capped at 500)
 *   trading:trending             → TrendingCoin[] (top 50 by social volume)
 *   trading:whales               → WhaleWatchEntry[] (whale watchlist)
 *   trading:signals:{coin}       → TradingSignal[] per coin (capped at 100)
 *   trading:last-updated:signals → ISO timestamp
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';

// ─── Types ────────────────────────────────────────────────────────────────

export type TradingSignalType = 'buy' | 'sell' | 'launch' | 'whale_movement' | 'social_spike';

export interface TradingSignal {
  id: string;
  type: TradingSignalType;
  /** Coin identifier (symbol or address) */
  coin: string;
  /** Coin name */
  coinName: string;
  /** Coin image URL */
  coinImage?: string;
  /** Human-readable label */
  label: string;
  /** USD amount involved */
  amountUsd: number;
  /** Token amount if available */
  amountTokens?: string;
  /** Actor (creator, wallet, or protocol) */
  actor: string;
  /** Actor display name */
  actorName: string;
  /** Actor avatar URL */
  actorAvatar?: string;
  /** Source protocol (farcaster, lens, degenfeed, solana, etc.) */
  source: string;
  /** Transaction signature / URL */
  txSignature?: string;
  /** Timestamp */
  timestamp: number;
  /** Whether this signal has been actioned (copy traded, viewed) */
  actioned?: boolean;
  /** Price at time of signal */
  priceUsd?: number;
  /** Market cap at time of signal */
  marketCapUsd?: number;
}

export interface TrendingCoin {
  /** Coin identifier */
  id: string;
  /** Coin symbol */
  symbol: string;
  /** Coin name */
  name: string;
  /** Coin image */
  image?: string;
  /** Current price in USD */
  priceUsd: number;
  /** 24h price change percent */
  change24h: number;
  /** Social volume (mentions in last 24h) */
  socialVolume: number;
  /** Social volume change vs yesterday */
  socialVolumeChange: number;
  /** Unique authors talking about this coin */
  uniqueAuthors: number;
  /** Trending rank */
  rank: number;
  /** Protocols where it's trending */
  sources: string[];
  /** Related signal IDs */
  recentSignalIds?: string[];
}

export interface WhaleWatchEntry {
  /** Wallet address */
  address: string;
  /** Display label */
  label: string;
  /** Platform */
  platform: string;
  /** Total portfolio value tracked */
  portfolioValueUsd: number;
  /** Recently traded coins */
  recentTrades: Array<{
    coin: string;
    coinName: string;
    type: 'buy' | 'sell';
    amountUsd: number;
    timestamp: number;
    txSignature?: string;
  }>;
  /** Risk score (1-10, 10 = highest risk) */
  riskScore: number;
  /** Tags (whale, smart_money, sniper, dev) */
  tags: string[];
  /** Last active timestamp */
  lastActive: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_SIGNALS = 500;
const MAX_SIGNALS_PER_COIN = 100;
const MAX_COINS = 50;
const MAX_WHALES = 100;
const KV_TTL_SEC = 60 * 60; // 1 hour

const SIGNALS_KEY = 'trading:signals';
const TRENDING_KEY = 'trading:trending';
const WHALES_KEY = 'trading:whales';
const LAST_UPDATED_KEY = 'trading:last-updated:signals';

// ─── Helpers ──────────────────────────────────────────────────────────────

function generateId(): string {
  return `tsig:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeCoinAddress(raw: unknown): string | null {
  const str = sanitizeString(raw, 64);
  if (!str) return null;
  // Accept solana addresses, EVM addresses, or symbols
  if (str.startsWith('0x') && /^0x[a-fA-F0-9]{40}$/.test(str)) return str.toLowerCase();
  if (str.length >= 32 && str.length <= 44) return str;
  if (/^[$A-Za-z0-9]{2,10}$/.test(str)) return str.toUpperCase();
  return null;
}

// ─── KV helpers ───────────────────────────────────────────────────────────┘

async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return null;
}

async function kvPut(env: Env, key: string, value: unknown, ttl?: number): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(value), {
      expirationTtl: ttl ?? KV_TTL_SEC,
    });
  } catch {
    /* ignore */
  }
}

// ─── Fallback data generator ──────────────────────────────────────────────

function generateFallbackSignals(): TradingSignal[] {
  const now = Date.now();
  const actors = [
    { name: 'vitalik.eth', label: 'Vitalik Buterin' },
    { name: '0x1234...abcd', label: 'Smart Whale' },
    { name: 'farcaster:8483', label: 'Degen Trader' },
    { name: 'sol:abc...xyz', label: 'Solana Whale' },
    { name: '@fren', label: 'Fren' },
    { name: 'lens:0x01', label: 'Lens Degen' },
    { name: '0xabcd...5678', label: 'Crypto Shark' },
    { name: 'jito_sol:5abc', label: 'Jito Whale' },
  ];

  const coins = [
    { id: '$DEGEN', name: 'Degen', image: '' },
    { id: '$BOB', name: 'Bob', image: '' },
    { id: '$FREN', name: 'Fren', image: '' },
    { id: '$SOL', name: 'Solana', image: '' },
    { id: '$ETH', name: 'Ethereum', image: '' },
    { id: '$PEPE', name: 'Pepe', image: '' },
    { id: '$DOGE', name: 'Dogecoin', image: '' },
    { id: '$WIF', name: 'dogwifhat', image: '' },
  ];

  const types: TradingSignalType[] = [
    'buy',
    'sell',
    'buy',
    'buy',
    'whale_movement',
    'launch',
    'social_spike',
    'buy',
  ];

  const signals: TradingSignal[] = [];
  for (let i = 0; i < 20; i++) {
    const coin = coins[i % coins.length]!;
    const actor = actors[i % actors.length]!;
    const t = types[i % types.length]!;
    const amount = Math.round(Math.random() * 50000 * 100) / 100;

    const signalType: TradingSignalType = t;
    const coinId = coin.id;
    const coinName = coin.name;
    const actorName = actor.name;
    const actorLabel = actor.label;
    const sourcesArr = ['farcaster', 'lens', 'degenfeed', 'solana', 'ethereum'];
    const source = sourcesArr[i % sourcesArr.length]!;

    signals.push({
      id: generateId(),
      type: signalType,
      coin: coinId,
      coinName,
      label:
        signalType === 'buy'
          ? `${actorLabel} bought ${coinId}`
          : signalType === 'sell'
            ? `${actorLabel} sold ${coinId}`
            : signalType === 'launch'
              ? `New coin ${coinId} launched by ${actorLabel}`
              : signalType === 'whale_movement'
                ? `Whale ${actorLabel} moved ${coinId}`
                : `${coinId} spiking on social`,
      amountUsd: amount,
      amountTokens: (amount * (3 + Math.random() * 10)).toFixed(0),
      actor: actorName,
      actorName: actorLabel,
      source,
      timestamp: now - i * 300000,
      priceUsd: Math.random() * 10,
      marketCapUsd: Math.random() * 100000000,
    });
  }

  return signals;
}

function generateFallbackTrending(): TrendingCoin[] {
  const coinData = [
    {
      id: '$DEGEN',
      symbol: 'DEGEN',
      name: 'Degen',
      priceUsd: 0.089,
      change24h: 24.5,
      socialVolume: 12500,
      uniqueAuthors: 3400,
      sources: ['farcaster', 'lens', 'degenfeed'],
    },
    {
      id: '$BOB',
      symbol: 'BOB',
      name: 'Bob',
      priceUsd: 0.032,
      change24h: 15.2,
      socialVolume: 8900,
      uniqueAuthors: 2100,
      sources: ['farcaster', 'base'],
    },
    {
      id: '$FREN',
      symbol: 'FREN',
      name: 'Fren',
      priceUsd: 0.0045,
      change24h: 42.1,
      socialVolume: 7500,
      uniqueAuthors: 1800,
      sources: ['lens', 'degenfeed'],
    },
    {
      id: '$SOL',
      symbol: 'SOL',
      name: 'Solana',
      priceUsd: 187.5,
      change24h: 5.3,
      socialVolume: 52000,
      uniqueAuthors: 12000,
      sources: ['solana', 'farcaster'],
    },
    {
      id: '$ETH',
      symbol: 'ETH',
      name: 'Ethereum',
      priceUsd: 3450.0,
      change24h: -2.1,
      socialVolume: 48000,
      uniqueAuthors: 11000,
      sources: ['ethereum', 'farcaster'],
    },
    {
      id: '$PEPE',
      symbol: 'PEPE',
      name: 'Pepe',
      priceUsd: 0.000012,
      change24h: 68.3,
      socialVolume: 32000,
      uniqueAuthors: 5600,
      sources: ['ethereum', 'degenfeed'],
    },
    {
      id: '$WIF',
      symbol: 'WIF',
      name: 'dogwifhat',
      priceUsd: 2.45,
      change24h: -5.8,
      socialVolume: 28000,
      uniqueAuthors: 4300,
      sources: ['solana', 'degenfeed'],
    },
    {
      id: '$BONK',
      symbol: 'BONK',
      name: 'Bonk',
      priceUsd: 0.000034,
      change24h: 12.4,
      socialVolume: 21000,
      uniqueAuthors: 3800,
      sources: ['solana'],
    },
    {
      id: '$DOGE',
      symbol: 'DOGE',
      name: 'Dogecoin',
      priceUsd: 0.15,
      change24h: 3.2,
      socialVolume: 19000,
      uniqueAuthors: 8900,
      sources: ['ethereum', 'farcaster'],
    },
    {
      id: '$TOSHI',
      symbol: 'TOSHI',
      name: 'Toshi',
      priceUsd: 0.00056,
      change24h: 92.7,
      socialVolume: 15000,
      uniqueAuthors: 2200,
      sources: ['base', 'lens'],
    },
  ];

  return coinData.map((c, i) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    image: '',
    priceUsd: c.priceUsd,
    change24h: c.change24h,
    socialVolume: c.socialVolume,
    socialVolumeChange: Math.round((Math.random() - 0.3) * 100),
    uniqueAuthors: c.uniqueAuthors,
    rank: i + 1,
    sources: c.sources,
    recentSignalIds: [],
  }));
}

// ─── GET /api/trading/signals — Recent buy/sell activity ──────────────────

export async function handleTradingSignals(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const type = sanitizeString(url.searchParams.get('type'), 16); // buy, sell, launch, whale_movement, social_spike
  const coin = sanitizeString(url.searchParams.get('coin'), 32);
  const since = Number(url.searchParams.get('since')) || 0;

  let signals = await kvGet<TradingSignal[]>(env, SIGNALS_KEY);

  // Fallback data
  if (!signals) {
    signals = generateFallbackSignals();
    // Cache fallback
    await kvPut(env, SIGNALS_KEY, signals);
  }

  // Filter by type
  const validTypes: TradingSignalType[] = [
    'buy',
    'sell',
    'launch',
    'whale_movement',
    'social_spike',
  ];
  if (type && validTypes.includes(type as TradingSignalType)) {
    signals = signals.filter((s) => s.type === type);
  }

  // Filter by coin
  if (coin) {
    signals = signals.filter((s) => s.coin.toLowerCase() === coin.toLowerCase());
  }

  // Filter by time
  if (since > 0) {
    signals = signals.filter((s) => s.timestamp > since);
  }

  // Sort newest first
  signals.sort((a, b) => b.timestamp - a.timestamp);

  return jsonResponse({
    signals: signals.slice(0, limit),
    count: signals.length,
    updatedAt: Date.now(),
  });
}

// ─── POST /api/trading/signals — Record a new signal ──────────────────────

interface CreateSignalBody {
  type?: TradingSignalType;
  coin?: string;
  coinName?: string;
  coinImage?: string;
  label?: string;
  amountUsd?: number;
  amountTokens?: string;
  actor?: string;
  actorName?: string;
  actorAvatar?: string;
  source?: string;
  txSignature?: string;
  priceUsd?: number;
  marketCapUsd?: number;
}

export async function handleTradingSignalCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: CreateSignalBody;
  try {
    body = (await request.json()) as CreateSignalBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const validTypes: TradingSignalType[] = [
    'buy',
    'sell',
    'launch',
    'whale_movement',
    'social_spike',
  ];
  if (!body.type || !validTypes.includes(body.type)) {
    return jsonResponse(
      { error: 'Valid type required: buy, sell, launch, whale_movement, social_spike' },
      400,
    );
  }

  const coin = sanitizeCoinAddress(body.coin);
  if (!coin) {
    return jsonResponse({ error: 'Valid coin identifier required' }, 400);
  }

  const coinName = sanitizeString(body.coinName, 64) || coin;
  const label = sanitizeString(body.label, 256) || `${body.type} ${coin}`;
  const amountUsd = typeof body.amountUsd === 'number' ? body.amountUsd : 0;
  const actor = sanitizeString(body.actor, 128) || session.address;
  const actorName = sanitizeString(body.actorName, 64) || actor.slice(0, 12);
  const source = sanitizeString(body.source, 32) || 'degenfeed';

  const signal: TradingSignal = {
    id: generateId(),
    type: body.type,
    coin,
    coinName,
    coinImage: sanitizeString(body.coinImage, 500) || undefined,
    label,
    amountUsd,
    amountTokens: sanitizeString(body.amountTokens, 64) || undefined,
    actor,
    actorName,
    actorAvatar: sanitizeString(body.actorAvatar, 500) || undefined,
    source,
    txSignature: sanitizeString(body.txSignature, 256) || undefined,
    timestamp: Date.now(),
    priceUsd: typeof body.priceUsd === 'number' ? body.priceUsd : undefined,
    marketCapUsd: typeof body.marketCapUsd === 'number' ? body.marketCapUsd : undefined,
  };

  try {
    // Add to global signals ring buffer
    const existing = (await kvGet<TradingSignal[]>(env, SIGNALS_KEY)) ?? [];
    await kvPut(env, SIGNALS_KEY, [signal, ...existing].slice(0, MAX_SIGNALS));

    // Add to per-coin signals
    const coinKey = `trading:signals:${coin}`;
    const coinSignals = (await kvGet<TradingSignal[]>(env, coinKey)) ?? [];
    await kvPut(env, coinKey, [signal, ...coinSignals].slice(0, MAX_SIGNALS_PER_COIN));

    return noCacheJsonResponse({ success: true, signal });
  } catch {
    return jsonResponse({ error: 'Storage unavailable' }, 500);
  }
}

// ─── POST /api/trading/signals/:id/action — Mark signal as actioned ──────

export async function handleTradingSignalAction(
  request: Request,
  env: Env,
  signalId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sanitizedId = sanitizeString(signalId, 128);
  if (!sanitizedId) {
    return jsonResponse({ error: 'Invalid signal ID' }, 400);
  }

  try {
    const signals = (await kvGet<TradingSignal[]>(env, SIGNALS_KEY)) ?? [];
    const updated = signals.map((s) => (s.id === sanitizedId ? { ...s, actioned: true } : s));
    await kvPut(env, SIGNALS_KEY, updated);
    return jsonResponse({ success: true });
  } catch {
    return jsonResponse({ error: 'Failed to update signal' }, 500);
  }
}

// ─── GET /api/trading/trending — Trending coins by social volume ──────────

export async function handleTradingTrending(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 50);
  const source = sanitizeString(url.searchParams.get('source'), 32);

  let coins = await kvGet<TrendingCoin[]>(env, TRENDING_KEY);

  if (!coins) {
    coins = generateFallbackTrending();
    await kvPut(env, TRENDING_KEY, coins);
  }

  // Filter by source
  if (source) {
    coins = coins.filter((c) => c.sources.includes(source));
  }

  // Sort by social volume
  coins.sort((a, b) => b.socialVolume - a.socialVolume);

  return jsonResponse({
    coins: coins.slice(0, limit).map((c, i) => ({ ...c, rank: i + 1 })),
    count: Math.min(limit, coins.length),
    updatedAt: Date.now(),
  });
}

// ─── GET /api/trading/whales — Whale watchlist ────────────────────────────

export async function handleTradingWhales(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);
  const tag = sanitizeString(url.searchParams.get('tag'), 32);

  let whales = await kvGet<WhaleWatchEntry[]>(env, WHALES_KEY);

  if (!whales) {
    // Generate fallback whales
    const now = Date.now();
    whales = [
      {
        address: '0x1234...abcd',
        label: 'Smart Whale',
        platform: 'ethereum',
        portfolioValueUsd: 45200000,
        recentTrades: [
          {
            coin: '$DEGEN',
            coinName: 'Degen',
            type: 'buy',
            amountUsd: 50000,
            timestamp: now - 600000,
          },
          {
            coin: '$PEPE',
            coinName: 'Pepe',
            type: 'buy',
            amountUsd: 125000,
            timestamp: now - 1800000,
          },
        ],
        riskScore: 4,
        tags: ['whale', 'smart_money'],
        lastActive: now - 300000,
      },
      {
        address: 'sol:abc...xyz',
        label: 'Solana Whale',
        platform: 'solana',
        portfolioValueUsd: 28300000,
        recentTrades: [
          {
            coin: '$WIF',
            coinName: 'dogwifhat',
            type: 'sell',
            amountUsd: 75000,
            timestamp: now - 900000,
          },
          {
            coin: '$BONK',
            coinName: 'Bonk',
            type: 'buy',
            amountUsd: 100000,
            timestamp: now - 3600000,
          },
        ],
        riskScore: 6,
        tags: ['whale', 'sniper'],
        lastActive: now - 600000,
      },
      {
        address: 'farcaster:8483',
        label: 'Degen Trader',
        platform: 'farcaster',
        portfolioValueUsd: 12500000,
        recentTrades: [
          {
            coin: '$BOB',
            coinName: 'Bob',
            type: 'buy',
            amountUsd: 25000,
            timestamp: now - 1200000,
          },
          {
            coin: '$FREN',
            coinName: 'Fren',
            type: 'buy',
            amountUsd: 10000,
            timestamp: now - 2400000,
          },
        ],
        riskScore: 7,
        tags: ['smart_money', 'degen'],
        lastActive: now - 1200000,
      },
      {
        address: '0xabcd...5678',
        label: 'Crypto Shark',
        platform: 'ethereum',
        portfolioValueUsd: 8900000,
        recentTrades: [
          {
            coin: '$ETH',
            coinName: 'Ethereum',
            type: 'buy',
            amountUsd: 200000,
            timestamp: now - 7200000,
          },
        ],
        riskScore: 3,
        tags: ['whale'],
        lastActive: now - 7200000,
      },
      {
        address: 'jito_sol:5abc',
        label: 'Jito Whale',
        platform: 'solana',
        portfolioValueUsd: 56700000,
        recentTrades: [
          {
            coin: '$SOL',
            coinName: 'Solana',
            type: 'buy',
            amountUsd: 500000,
            timestamp: now - 14400000,
          },
          {
            coin: '$WIF',
            coinName: 'dogwifhat',
            type: 'sell',
            amountUsd: 150000,
            timestamp: now - 28800000,
          },
        ],
        riskScore: 8,
        tags: ['whale', 'sniper', 'smart_money'],
        lastActive: now - 14400000,
      },
    ];
    await kvPut(env, WHALES_KEY, whales);
  }

  // Filter by tag
  if (tag) {
    whales = whales.filter((w) => w.tags.includes(tag));
  }

  // Sort by portfolio size
  whales.sort((a, b) => b.portfolioValueUsd - a.portfolioValueUsd);

  return jsonResponse({
    whales: whales.slice(0, limit).map((w, i) => ({ ...w, rank: i + 1 })),
    count: Math.min(limit, whales.length),
    updatedAt: Date.now(),
  });
}

// ─── GET /api/trading/coins/:coin — Signals for a specific coin ──────────

export async function handleTradingCoinSignals(
  _request: Request,
  env: Env,
  coin: string,
): Promise<Response> {
  const sanitizedCoin = sanitizeCoinAddress(coin);
  if (!sanitizedCoin) {
    return jsonResponse({ error: 'Invalid coin identifier' }, 400);
  }

  const coinKey = `trading:signals:${sanitizedCoin}`;
  const signals = (await kvGet<TradingSignal[]>(env, coinKey)) ?? [];
  signals.sort((a, b) => b.timestamp - a.timestamp);

  return jsonResponse({
    coin: sanitizedCoin,
    signals: signals.slice(0, 50),
    count: signals.length,
  });
}

// ─── GET /api/trading/coins/:coin/summary — Coin summary ─────────────────

export async function handleTradingCoinSummary(
  _request: Request,
  env: Env,
  coin: string,
): Promise<Response> {
  const sanitizedCoin = sanitizeCoinAddress(coin);
  if (!sanitizedCoin) {
    return jsonResponse({ error: 'Invalid coin identifier' }, 400);
  }

  const coinKey = `trading:signals:${sanitizedCoin}`;
  const signals = (await kvGet<TradingSignal[]>(env, coinKey)) ?? [];
  const trendingData = await kvGet<TrendingCoin[]>(env, TRENDING_KEY);
  const trendingCoin = trendingData?.find(
    (c) => c.id.toLowerCase() === sanitizedCoin.toLowerCase(),
  );

  const buys = signals.filter((s) => s.type === 'buy');
  const sells = signals.filter((s) => s.type === 'sell');
  const totalBuyVolume = buys.reduce((sum, s) => sum + s.amountUsd, 0);
  const totalSellVolume = sells.reduce((sum, s) => sum + s.amountUsd, 0);

  return jsonResponse({
    coin: sanitizedCoin,
    signals24h: signals.filter((s) => s.timestamp > Date.now() - 86400000).length,
    buyCount: buys.length,
    sellCount: sells.length,
    totalBuyVolumeUsd: totalBuyVolume,
    totalSellVolumeUsd: totalSellVolume,
    netVolumeUsd: totalBuyVolume - totalSellVolume,
    trending: trendingCoin || null,
  });
}
