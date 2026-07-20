/**
 * Zora 2026 Coins API Client
 *
 * Integration with Zora's 2026 REST API at api-sdk.zora.engineering for:
 *   - Trending coins discovery
 *   - Coin info by address
 *   - Creator coins lookup
 *   - Live streaming comments
 *
 * ## Usage
 * ```ts
 * import { fetchZoraTrendingCoins, fetchZoraCoinInfo } from '@degenfeed/zora-sdk/zora-api';
 *
 * const trending = await fetchZoraTrendingCoins(20);
 * const coin = await fetchZoraCoinInfo('0x...');
 * ```
 *
 * ## Endpoints (2026 API)
 * - GET /api/explore/trending?limit=N   — trending coins
 * - GET /api/coin?address=&chainId=      — coin info
 * - GET /api/profile?identifier=         — creator's coins
 * - GET /api/live/:streamId/comments     — live stream comments
 */
import type { CoinInfo, ZoraCoin } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Base URL for Zora's 2026 Coins API (api-sdk.zora.engineering). */
const COINS_API_BASE = 'https://api-sdk.zora.engineering';

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
 * All prices are in ETH — ZORA token references are stripped.
 */
function normalizeZoraCoin(raw: ZoraCoin): CoinInfo {
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
    pairCurrency: 'ETH',
    pairCurrencySymbol: 'ETH',
  };
}

// ─── Trending Coins ─────────────────────────────────────────────────────────

/**
 * Fetch trending creator coins from Zora's 2026 API.
 *
 * Uses the /api/explore/trending endpoint which returns coins sorted
 * by 24h volume and market cap momentum.
 *
 * @param limit Max number of coins to return (default 20, max 100).
 * @returns Array of CoinInfo objects.
 */
export async function fetchZoraTrendingCoins(limit: number = 20): Promise<CoinInfo[]> {
  const clamped = Math.min(Math.max(1, limit), 100);
  const res = await fetchWithTimeout(`${COINS_API_BASE}/api/explore/trending?limit=${clamped}`);
  const data = (await res.json()) as ZoraCoin[] | { data: ZoraCoin[] };

  const coins: ZoraCoin[] = Array.isArray(data) ? data : (data as { data: ZoraCoin[] }).data ?? [];
  return coins.map(normalizeZoraCoin);
}

// ─── Coin Info ───────────────────────────────────────────────────────────────

/**
 * Fetch detailed information about a specific creator coin.
 *
 * Uses the 2026 /api/coin endpoint with chainId=8453 (Base).
 *
 * @param coinAddress The coin's contract address (0x-prefixed hex).
 * @returns CoinInfo object.
 */
export async function fetchZoraCoinInfo(coinAddress: string): Promise<CoinInfo> {
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/api/coin?address=${coinAddress.toLowerCase()}&chainId=8453`,
  );
  const data = (await res.json()) as ZoraCoin;
  return normalizeZoraCoin(data);
}

// ─── Creator Coins ───────────────────────────────────────────────────────────

/**
 * Fetch all coins created by a specific wallet address.
 *
 * Uses the 2026 /api/profile endpoint which returns the creator's
 * profile with all associated coin addresses.
 *
 * @param creatorAddress The creator's wallet address.
 * @returns Array of coin contract addresses.
 */
export async function fetchZoraCreatorCoins(creatorAddress: string): Promise<string[]> {
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/api/profile?identifier=${creatorAddress.toLowerCase()}`,
  );
  const data = await res.json() as { coins?: Array<{ address: string }>; data?: { coins?: Array<{ address: string }> } };
  const coins = data.coins ?? (data as any).data?.coins ?? [];
  return coins.map((c: { address: string }) => c.address);
}

// ─── Live Comments ─────────────────────────────────────────────────────────

export interface ZoraComment {
  id: string;
  userAddress: string;
  username?: string;
  text: string;
  timestamp: string;
}

/**
 * Fetch live comments for a Zora stream.
 *
 * @param streamId The stream identifier.
 * @returns Array of comments.
 */
export async function fetchZoraLiveComments(streamId: string): Promise<ZoraComment[]> {
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/api/live/${streamId}/comments`,
  );
  const data = (await res.json()) as ZoraComment[] | { comments: ZoraComment[]; data?: { comments?: ZoraComment[] } };
  if (Array.isArray(data)) return data;
  if ((data as { comments: ZoraComment[] }).comments) return (data as { comments: ZoraComment[] }).comments;
  if ((data as any).data?.comments) return (data as any).data.comments;
  return [];
}

// ─── Batch Price Query ───────────────────────────────────────────────

/**
 * Fetch prices for multiple coins from Zora's API.
 *
 * @param addresses Array of coin contract addresses.
 * @returns Map of address → price in ETH wei.
 */
export async function fetchZoraBatchPrices(
  addresses: `0x${string}`[],
): Promise<Map<`0x${string}`, string>> {
  if (addresses.length === 0) return new Map();

  const params = addresses.map(a => `addresses=${a.toLowerCase()}`).join('&');
  const res = await fetchWithTimeout(`${COINS_API_BASE}/api/prices?${params}`);
  const data = (await res.json()) as Record<string, string> | { prices: Record<string, string> };

  const prices: Record<string, string> = (data as { prices: Record<string, string> }).prices ?? data as Record<string, string>;
  const priceMap = new Map<`0x${string}`, string>();
  for (const [addr, price] of Object.entries(prices)) {
    priceMap.set(addr as `0x${string}`, price);
  }
  return priceMap;
}
