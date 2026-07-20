/**
 * Zora 2026 Coins API Client
 *
 * Integration with Zora's Coins API at coins.zora.co/api/v1/ for:
 *   - Trending coins discovery
 *   - Coin info by address
 *   - Creator coins lookup
 *   - Live streaming support check
 *
 * ## Usage
 * ```ts
 * import { fetchZoraTrendingCoins, fetchZoraCoinInfo } from '@degenfeed/zora-sdk/zora-api';
 *
 * const trending = await fetchZoraTrendingCoins(20);
 * const coin = await fetchZoraCoinInfo('0x...');
 * ```
 *
 * ## Endpoints
 * - GET /api/v1/trending?limit=N  — trending coins
 * - GET /api/v1/coins/:address    — coin info
 * - GET /api/v1/creator/:address  — coins by creator
 * - GraphQL (api.zora.co/graphql) — live stream query
 */

import type { CoinInfo, ZoraCoin } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Base URL for Zora's Coins API. */
const COINS_API_BASE = 'https://coins.zora.co/api/v1';
/** Zora GraphQL endpoint (for live streams, advanced queries). */
const GRAPHQL_ENDPOINT = 'https://api.zora.co/graphql';

/** Chain ID → name mapping for Zora API. */
const ZORA_CHAIN_MAP: Record<string, string> = {
  '8453': 'base',
  '1': 'ethereum',
  '10': 'optimism',
  '42161': 'arbitrum',
  '7777777': 'zora',
};

/** Default request timeout in ms. */
const DEFAULT_TIMEOUT = 10_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch with timeout wrapper.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Zora API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Normalize a raw ZoraCoin API response to our CoinInfo type.
 */
function normalizeZoraCoin(raw: ZoraCoin): CoinInfo {
  const chainId = raw.address.startsWith('0x') ? '8453' : 'base';
  return {
    address: raw.address as `0x${string}`,
    name: raw.name,
    symbol: raw.symbol,
    creator: raw.creator as `0x${string}`,
    uri: raw.uri,
    price: raw.price || '0',
    marketCap: raw.marketCap || '0',
    totalSupply: raw.totalSupply || '0',
    totalRaised: raw.totalRaised || '0',
    holderCount: raw.holderCount || 0,
    volume24h: raw.volume24h || '0',
    priceChange24h: raw.priceChange24h ?? 0,
    graduated: raw.graduated ?? false,
    poolAddress: raw.poolAddress as `0x${string}` | undefined,
    chain: 'base',
  };
}

// ─── Trending Coins ─────────────────────────────────────────────────────────

/**
 * Fetch trending creator coins from Zora's Coins API.
 *
 * @param limit Max number of coins to return (default 20, max 100).
 * @returns Array of CoinInfo objects.
 */
export async function fetchZoraTrendingCoins(limit: number = 20): Promise<CoinInfo[]> {
  const clamped = Math.min(Math.max(1, limit), 100);
  const res = await fetchWithTimeout(`${COINS_API_BASE}/trending?limit=${clamped}`);
  const data = (await res.json()) as ZoraCoin[] | { data: ZoraCoin[] };

  // Handle both `ZoraCoin[]` and `{ data: ZoraCoin[] }` response shapes
  const coins: ZoraCoin[] = Array.isArray(data) ? data : (data as { data: ZoraCoin[] }).data;

  return coins.map(normalizeZoraCoin);
}

// ─── Coin Info ───────────────────────────────────────────────────────────────

/**
 * Fetch detailed information about a specific creator coin.
 *
 * @param coinAddress The coin's contract address (0x-prefixed hex).
 * @returns CoinInfo object.
 */
export async function fetchZoraCoinInfo(coinAddress: string): Promise<CoinInfo> {
  const res = await fetchWithTimeout(`${COINS_API_BASE}/coins/${coinAddress.toLowerCase()}`);
  const data = (await res.json()) as ZoraCoin;
  return normalizeZoraCoin(data);
}

// ─── Creator Coins ───────────────────────────────────────────────────────────

/**
 * Fetch all coins created by a specific wallet address.
 *
 * @param creatorAddress The creator's wallet address.
 * @returns Array of CoinInfo objects.
 */
export async function fetchZoraCreatorCoins(creatorAddress: string): Promise<CoinInfo[]> {
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/creator/${creatorAddress.toLowerCase()}`,
  );
  const data = await res.json();
  const coins: ZoraCoin[] = Array.isArray(data) ? data : (data as { data: ZoraCoin[] }).data ?? [];
  return coins.map(normalizeZoraCoin);
}

// ─── Live Streaming Support Check ───────────────────────────────────────────

/**
 * Check if Zora's GraphQL API has live streaming capabilities.
 *
 * Queries the Zora GraphQL endpoint for `liveStreams` to detect support.
 *
 * @returns True if live streaming is available.
 */
export async function checkZoraLiveSupport(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `{ liveStreams { id } }`,
      }),
    }, 5_000);

    // If the query succeeds (even with empty results), live streaming exists
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Legacy/Batch Price Query ───────────────────────────────────────────────

/**
 * Fetch prices for multiple coins in a single batch request.
 *
 * @param addresses Array of coin contract addresses.
 * @returns Map of address → price in ETH wei.
 */
export async function fetchZoraBatchPrices(
  addresses: `0x${string}`[],
): Promise<Map<`0x${string}`, string>> {
  if (addresses.length === 0) return new Map();

  const params = addresses.map(a => `addresses=${a.toLowerCase()}`).join('&');
  const res = await fetchWithTimeout(`${COINS_API_BASE}/prices?${params}`);
  const data = (await res.json()) as Record<string, string>;

  const priceMap = new Map<`0x${string}`, string>();
  for (const [addr, price] of Object.entries(data)) {
    priceMap.set(addr as `0x${string}`, price);
  }
  return priceMap;
}
