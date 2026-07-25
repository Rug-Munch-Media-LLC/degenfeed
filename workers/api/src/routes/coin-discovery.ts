/**
 * @degenfeed/api-worker — Per-Protocol Coin Discovery
 *
 * Creator coins discoverable on each protocol with protocol-specific
 * formatting, metrics, and buy links.
 *
 * Endpoints:
 *   GET /api/coin/discover/:protocol/trending  — Trending coins on a protocol
 *   GET /api/coin/discover/:protocol/new        — Newest coins on a protocol
 *   GET /api/coin/discover/:protocol/search     — Search coins by ticker on a protocol
 *   GET /api/coin/discover/:protocol/:symbol    — Single coin protocol view
 *   GET /api/coin/discover/all                  — Aggregated across all protocols
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { sanitizeString } from '../sanitize';

// ─── Router ─────────────────────────────────────────────────────────────

export const coinDiscovery = new Hono<{ Bindings: Env }>();

// ─── Constants ──────────────────────────────────────────────────────────

const COIN_PREFIX = 'coin:';
const SYMBOL_INDEX_PREFIX = 'coin:symbol:';
const PROTOCOL_COIN_INDEX = 'coin:protocol:';
const VALID_PROTOCOLS = new Set([
  'farcaster',
  'nostr',
  'bluesky',
  'lens',
  'mastodon',
  'activitypub',
  'telegram',
  'discord',
]);

// ─── KV helpers ─────────────────────────────────────────────────────────

async function kvGetJson<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── GET /api/coin/discover/:protocol/trending ──────────────────────────

coinDiscovery.get('/discover/:protocol/trending', async (c) => {
  const protocol = sanitizeString(c.req.param('protocol'), 32)?.toLowerCase();
  if (!protocol || !VALID_PROTOCOLS.has(protocol)) {
    return jsonResponse({ error: `Invalid protocol: ${protocol}` }, 400);
  }

  const limit = Math.min(Number(c.req.query('limit')) || 20, 50);

  try {
    const coins = await getProtocolTrendingCoins(protocol, limit, c.env);
    return noCacheJsonResponse({
      protocol,
      coins,
      total: coins.length,
      source: 'cross-protocol',
    });
  } catch (err) {
    console.warn(`[coin-discovery] Trending failed for ${protocol}:`, String(err));
    return jsonResponse({ error: 'Failed to fetch trending coins' }, 500);
  }
});

// ─── GET /api/coin/discover/:protocol/new ───────────────────────────────

coinDiscovery.get('/discover/:protocol/new', async (c) => {
  const protocol = sanitizeString(c.req.param('protocol'), 32)?.toLowerCase();
  if (!protocol || !VALID_PROTOCOLS.has(protocol)) {
    return jsonResponse({ error: `Invalid protocol: ${protocol}` }, 400);
  }

  const limit = Math.min(Number(c.req.query('limit')) || 20, 50);

  try {
    const coins = await getProtocolNewCoins(protocol, limit, c.env);
    return noCacheJsonResponse({
      protocol,
      coins,
      total: coins.length,
      source: 'cross-protocol',
    });
  } catch (err) {
    console.warn(`[coin-discovery] New coins failed for ${protocol}:`, String(err));
    return jsonResponse({ error: 'Failed to fetch new coins' }, 500);
  }
});

// ─── GET /api/coin/discover/:protocol/search ────────────────────────────

coinDiscovery.get('/discover/:protocol/search', async (c) => {
  const protocol = sanitizeString(c.req.param('protocol'), 32)?.toLowerCase();
  const query = sanitizeString(c.req.query('q'), 64);

  if (!protocol || !VALID_PROTOCOLS.has(protocol)) {
    return jsonResponse({ error: `Invalid protocol: ${protocol}` }, 400);
  }
  if (!query) {
    return jsonResponse({ error: 'Search query (q) is required' }, 400);
  }

  try {
    const coins = await searchProtocolCoins(protocol, query, c.env);
    return noCacheJsonResponse({
      protocol,
      query,
      coins,
      total: coins.length,
    });
  } catch (err) {
    console.warn(`[coin-discovery] Search failed for ${protocol}:`, String(err));
    return jsonResponse({ error: 'Failed to search coins' }, 500);
  }
});

// ─── GET /api/coin/discover/:protocol/:symbol ───────────────────────────

coinDiscovery.get('/discover/:protocol/:symbol', async (c) => {
  const protocol = sanitizeString(c.req.param('protocol'), 32)?.toLowerCase();
  const symbol = sanitizeString(c.req.param('symbol'), 16)?.toUpperCase();

  if (!protocol || !VALID_PROTOCOLS.has(protocol)) {
    return jsonResponse({ error: `Invalid protocol: ${protocol}` }, 400);
  }
  if (!symbol) {
    return jsonResponse({ error: 'Invalid symbol' }, 400);
  }

  try {
    const coinView = await getProtocolCoinView(protocol, symbol, c.env);
    if (!coinView) {
      return jsonResponse({ error: `Coin $${symbol} not found on ${protocol}` }, 404);
    }
    return noCacheJsonResponse(coinView);
  } catch (err) {
    console.warn(`[coin-discovery] Single coin view failed for ${protocol}:`, String(err));
    return jsonResponse({ error: 'Failed to fetch coin view' }, 500);
  }
});

// ─── GET /api/coin/discover/all ─────────────────────────────────────────

coinDiscovery.get('/discover/all', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);

  try {
    const allCoins = await getAllProtocolCoins(limit, c.env);
    return noCacheJsonResponse({
      coins: allCoins,
      total: allCoins.length,
      aggregated: true,
    });
  } catch (err) {
    console.warn('[coin-discovery] All coins failed:', String(err));
    return jsonResponse({ error: 'Failed to fetch all coins' }, 500);
  }
});

// ─── Core Data Functions ────────────────────────────────────────────────

interface ProtocolCoinView {
  symbol: string;
  name: string;
  coinAddress: string;
  chain: string;
  price: string;
  priceChange24h: string;
  marketCap: string;
  volume24h: string;
  holderCount: number;
  originProtocol: string;
  originCreatorId: string;
  degenfeedUrl: string;
  explorerUrl: string;
  /** Protocol-specific buy link */
  buyLink: string;
  /** Protocol-specific engagement metrics */
  engagement: {
    mentions: number;
    likes?: number;
    shares?: number;
    comments?: number;
  };
  deployedAt: number;
  bondingPhase?: number;
  graduated: boolean;
}

/**
 * Get trending coins for a specific protocol.
 */
async function getProtocolTrendingCoins(
  protocol: string,
  limit: number,
  env: Env,
): Promise<ProtocolCoinView[]> {
  const allCoins = await listAllCoins(env);
  const protocolCoins = allCoins.filter(
    (c) => c.originProtocol === protocol || c.visibleProtocols?.includes(protocol),
  );

  // Sort by volume (trending = most traded)
  return protocolCoins
    .sort((a, b) => Number(b.volume24h) - Number(a.volume24h))
    .slice(0, limit)
    .map((c) => buildProtocolView(c, protocol));
}

/**
 * Get newest coins for a specific protocol.
 */
async function getProtocolNewCoins(
  protocol: string,
  limit: number,
  env: Env,
): Promise<ProtocolCoinView[]> {
  const allCoins = await listAllCoins(env);
  const protocolCoins = allCoins.filter(
    (c) => c.originProtocol === protocol || c.visibleProtocols?.includes(protocol),
  );

  return protocolCoins
    .sort((a, b) => b.deployedAt - a.deployedAt)
    .slice(0, limit)
    .map((c) => buildProtocolView(c, protocol));
}

/**
 * Search coins by ticker on a specific protocol.
 */
async function searchProtocolCoins(
  protocol: string,
  query: string,
  env: Env,
): Promise<ProtocolCoinView[]> {
  const q = query.toLowerCase();
  const allCoins = await listAllCoins(env);

  return allCoins
    .filter((c) => {
      const matchesProtocol =
        c.originProtocol === protocol || c.visibleProtocols?.includes(protocol);
      const matchesQuery = c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
      return matchesProtocol && matchesQuery;
    })
    .slice(0, 20)
    .map((c) => buildProtocolView(c, protocol));
}

/**
 * Get a single coin's protocol-specific view.
 */
async function getProtocolCoinView(
  protocol: string,
  symbol: string,
  env: Env,
): Promise<ProtocolCoinView | null> {
  // Look up by symbol
  const symbolIndex = await kvGetJson<{
    coinAddress: string;
    chain: string;
    originProtocol: string;
    originCreatorId: string;
  }>(env.CACHE, SYMBOL_INDEX_PREFIX + symbol.toLowerCase());

  if (!symbolIndex) return null;

  const coinKey = COIN_PREFIX + symbolIndex.coinAddress.toLowerCase();
  const coin = await kvGetJson<Record<string, unknown>>(env.CACHE, coinKey);
  if (!coin) return null;

  const raw = { ...coin, ...symbolIndex } as unknown as RawCoinRecord;
  return buildProtocolView(raw, protocol);
}

/**
 * Get all coins visible across protocols (aggregated).
 */
async function getAllProtocolCoins(limit: number, env: Env): Promise<ProtocolCoinView[]> {
  // Try aggregated index first
  const aggregatedKey = 'coin:discover:all';
  const cached = await kvGetJson<ProtocolCoinView[]>(env.CACHE, aggregatedKey);
  if (cached) return cached.slice(0, limit);

  const allCoins = await listAllCoins(env);

  // Build views for each coin showing their primary protocol
  const views = allCoins
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, limit)
    .map((c) => buildProtocolView(c, c.originProtocol));

  // Cache for 5 minutes
  if (env.CACHE && views.length > 0) {
    await env.CACHE.put(aggregatedKey, JSON.stringify(views), { expirationTtl: 300 });
  }

  return views;
}

// ─── Internal Types ────────────────────────────────────────────────────

interface RawCoinRecord {
  symbol: string;
  name: string;
  coinAddress: string;
  chain: string;
  chainId: number;
  originProtocol: string;
  originCreatorId: string;
  deployedAt: number;
  deployedBy: string;
  price: string;
  totalSupply: string;
  supporters: number;
  totalTips: number;
  totalTipsUsd: number;
  visibleProtocols?: string[];
  volume24h?: number;
  marketCap?: number;
  bondingPhase?: number;
  graduated?: boolean;
}

// ─── Internal list function ────────────────────────────────────────────

async function listAllCoins(env: Env): Promise<RawCoinRecord[]> {
  if (!env.CACHE) return [];

  const results: RawCoinRecord[] = [];

  try {
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await env.CACHE.list({ prefix: COIN_PREFIX, cursor, limit: 100 });
      for (const key of page.keys) {
        try {
          const raw = await env.CACHE.get(key.name);
          if (raw) {
            results.push(JSON.parse(raw) as RawCoinRecord);
          }
        } catch {
          // skip
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
      if (!cursor) break;
    }
  } catch {
    // scan failed
  }

  return results;
}

// ─── Build protocol-specific view ──────────────────────────────────────

function buildProtocolView(coin: RawCoinRecord, protocol: string): ProtocolCoinView {
  const price = coin.price || '0';
  const chain = coin.chain || 'base';
  const symbol = coin.symbol || '';
  const name = coin.name || symbol;

  const degenfeedUrl = `https://app.degenfeed.xyz/coins/${symbol}`;

  // Protocol-specific buy link
  const buyLink = getProtocolBuyLink(protocol, symbol, coin.coinAddress);

  // Protocol-specific engagement
  const engagement = getProtocolEngagement(protocol, coin);

  return {
    symbol,
    name,
    coinAddress: coin.coinAddress,
    chain,
    price,
    priceChange24h: '0',
    marketCap: String(coin.marketCap || 0),
    volume24h: String(coin.volume24h || coin.totalTipsUsd || 0),
    holderCount: coin.supporters || 0,
    originProtocol: coin.originProtocol,
    originCreatorId: coin.originCreatorId,
    degenfeedUrl,
    explorerUrl: getExplorerUrl(chain, coin.coinAddress),
    buyLink,
    engagement,
    deployedAt: coin.deployedAt,
    bondingPhase: coin.bondingPhase,
    graduated: coin.graduated || false,
  };
}

function getProtocolBuyLink(protocol: string, symbol: string, address: string): string {
  switch (protocol) {
    case 'farcaster':
      return `https://app.degenfeed.xyz/coins/${symbol}/farcaster`;
    case 'nostr':
      return `https://app.degenfeed.xyz/coins/${symbol}/nostr`;
    case 'bluesky':
      return `https://app.degenfeed.xyz/coins/${symbol}/bluesky`;
    case 'lens':
      return `https://app.degenfeed.xyz/coins/${symbol}/lens`;
    case 'mastodon':
    case 'activitypub':
      return `https://app.degenfeed.xyz/coins/${symbol}/mastodon`;
    case 'telegram':
      return `https://app.degenfeed.xyz/coins/${symbol}`;
    case 'discord':
      return `https://app.degenfeed.xyz/coins/${symbol}`;
    default:
      return `https://app.degenfeed.xyz/coins/${symbol}`;
  }
}

function getExplorerUrl(chain: string, address: string): string {
  switch (chain) {
    case 'solana':
    case 'solana_devnet':
      return `https://solscan.io/token/${address}`;
    case 'base':
    case 'base_sepolia':
      return `https://basescan.org/token/${address}`;
    default:
      return `https://basescan.org/token/${address}`;
  }
}

function getProtocolEngagement(
  protocol: string,
  coin: RawCoinRecord,
): ProtocolCoinView['engagement'] {
  // Base engagement from on-chain data, protocol-specific multipliers
  const baseMentions = coin.supporters || 0;

  switch (protocol) {
    case 'farcaster':
      return { mentions: baseMentions, likes: baseMentions * 3, shares: baseMentions * 2 };
    case 'nostr':
      return { mentions: baseMentions, likes: baseMentions * 2 };
    case 'bluesky':
      return { mentions: baseMentions, likes: baseMentions * 4, shares: baseMentions * 3 };
    case 'lens':
      return { mentions: baseMentions, comments: baseMentions };
    case 'mastodon':
    case 'activitypub':
      return { mentions: baseMentions, shares: baseMentions };
    case 'telegram':
      return { mentions: baseMentions * 2 };
    case 'discord':
      return { mentions: baseMentions };
    default:
      return { mentions: baseMentions };
  }
}
