/**
 * Zora 2026 Coins API Client
 *
 * Integration with Zora's 2026 REST API at api-sdk.zora.engineering for:
 *   - Trending coins discovery
 *   - Coin info by address
 *   - Creator coins lookup
 *   - Coin price history
 *   - Coin comments
 *
 * ## Usage
 * ```ts
 * import { fetchZoraTrendingCoins, fetchZoraCoinInfo } from '@degenfeed/zora-sdk/zora-api';
 *
 * const trending = await fetchZoraTrendingCoins(20);
 * const coin = await fetchZoraCoinInfo('0x...');
 * ```
 *
 * ## Endpoints (2026 API — verified against api-sdk.zora.engineering/openapi)
 * - GET /explore?listType=TOP_VOLUME_24H&count=N        — trending coins
 * - GET /coin?address=&chain=8453                        — coin info
 * - GET /profileCoins?identifier=&count=&after=          — creator's coins
 * - GET /coinPriceHistory?address=&chain=                — coin price history
 * - GET /coinComments?address=&chain=&after=&count=      — coin comments
 */
import type { CoinInfo } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Base URL for Zora's 2026 Coins API (api-sdk.zora.engineering). */
const COINS_API_BASE = 'https://api-sdk.zora.engineering';

/** Default request timeout in ms. */
const DEFAULT_TIMEOUT = 10_000;

/** Base chain ID (all Zora coins trade on Base). */
const BASE_CHAIN_ID = 8453;

// ─── Raw GraphQL-shaped response types (2026 API) ───────────────────────────

interface ZoraApiCoinNode {
  __typename?: string;
  id?: string;
  address: string;
  name: string;
  symbol: string;
  description?: string;
  coinType?: string;
  totalSupply?: string;
  totalVolume?: string;
  volume24h?: string;
  createdAt?: string;
  creatorAddress?: string;
  creatorProfile?: {
    handle?: string;
    avatar?: { previewImage?: { medium?: string; small?: string } } | null;
    socialAccounts?: unknown[];
  } | null;
  poolCurrencyToken?: {
    address?: string;
    name?: string;
    decimals?: number;
  } | null;
  tokenPrice?: {
    priceInUsdc?: string;
    priceInPoolToken?: string;
    currencyAddress?: string;
  } | null;
  marketCap?: string;
  marketCapDelta24h?: string;
  chainId?: number;
  tokenUri?: string;
  uniqueHolders?: number;
  uniswapV3PoolAddress?: string | null;
  uniswapV4PoolKey?: string | null;
  platformBlocked?: boolean;
}

interface ZoraApiCoinResponse {
  zora20Token?: ZoraApiCoinNode | null;
}

interface ZoraApiExploreResponse {
  exploreList?: {
    edges?: Array<{ node?: ZoraApiCoinNode | null }>;
    pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
  } | null;
}

interface ZoraApiProfileCoinsResponse {
  profile?: {
    createdCoins?: {
      count?: number;
      edges?: Array<{ node?: { address?: string } | null }>;
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
    } | null;
  } | null;
}

export interface ZoraPricePoint {
  /** ISO timestamp of the price point */
  timestamp: string;
  /** Close price as a USDC decimal string */
  closePrice: string;
}

interface ZoraApiPriceHistoryResponse {
  zora20Token?: {
    oneHour?: ZoraPricePoint[];
    oneDay?: ZoraPricePoint[];
    oneWeek?: ZoraPricePoint[];
    oneMonth?: ZoraPricePoint[];
    all?: ZoraPricePoint[];
  } | null;
}

interface ZoraApiCoinCommentsResponse {
  zora20Token?: {
    zoraComments?: {
      count?: number;
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      edges?: Array<{
        node?: {
          commentId?: string;
          nonce?: string;
          userAddress?: string;
          txHash?: string;
          comment?: string;
          timestamp?: number;
          userProfile?: {
            handle?: string;
            avatar?: { previewImage?: { small?: string; medium?: string } } | null;
          } | null;
          replies?: { count?: number; edges?: unknown[] };
        } | null;
      }>;
    } | null;
  } | null;
}

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
 * Normalize a raw Zora 2026 API coin node to our CoinInfo type.
 * The 2026 API returns GraphQL-shaped nodes — map the real fields.
 */
function normalizeZoraCoin(node: ZoraApiCoinNode): CoinInfo {
  const poolAddress = node.uniswapV3PoolAddress || node.uniswapV4PoolKey || undefined;
  return {
    address: node.address as `0x${string}`,
    name: node.name,
    symbol: node.symbol,
    creator: (node.creatorAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    uri: node.tokenUri || '',
    // 2026 API returns USDC decimal strings (priceInUsdc), not ETH wei.
    price: node.tokenPrice?.priceInUsdc ?? '0',
    marketCap: node.marketCap ?? '0',
    totalSupply: node.totalSupply ?? '0',
    totalRaised: node.totalVolume ?? '0',
    holderCount: node.uniqueHolders ?? 0,
    volume24h: node.volume24h ?? '0',
    priceChange24h: node.marketCapDelta24h ? Number(node.marketCapDelta24h) : 0,
    graduated: Boolean(poolAddress),
    poolAddress: poolAddress as `0x${string}` | undefined,
    chain: 'base',
    pairCurrency: 'ETH',
    pairCurrencySymbol: 'ETH',
  };
}

// ─── Trending Coins ─────────────────────────────────────────────────────────

/**
 * Fetch trending creator coins from Zora's 2026 API.
 *
 * Uses the /explore endpoint with listType=TOP_VOLUME_24H which returns
 * coins sorted by 24h volume (mirrors the Python indexer).
 *
 * @param limit Max number of coins to return (default 20, max 100).
 * @returns Array of CoinInfo objects.
 */
export async function fetchZoraTrendingCoins(limit: number = 20): Promise<CoinInfo[]> {
  const clamped = Math.min(Math.max(1, limit), 100);
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/explore?listType=TOP_VOLUME_24H&count=${clamped}`,
  );
  const data = (await res.json()) as ZoraApiExploreResponse;
  const edges = data.exploreList?.edges ?? [];
  return edges
    .map((e) => (e.node ? normalizeZoraCoin(e.node) : null))
    .filter((c): c is CoinInfo => c !== null);
}

// ─── Coin Info ───────────────────────────────────────────────────────────────

/**
 * Fetch detailed information about a specific creator coin.
 *
 * Uses the 2026 /coin endpoint with chain=8453 (Base).
 *
 * @param coinAddress The coin's contract address (0x-prefixed hex).
 * @returns CoinInfo object.
 */
export async function fetchZoraCoinInfo(coinAddress: string): Promise<CoinInfo> {
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/coin?address=${coinAddress.toLowerCase()}&chain=${BASE_CHAIN_ID}`,
  );
  const data = (await res.json()) as ZoraApiCoinResponse;
  const node = data.zora20Token;
  if (!node) {
    throw new Error(`Zora API: coin not found for ${coinAddress}`);
  }
  return normalizeZoraCoin(node);
}

// ─── Creator Coins ───────────────────────────────────────────────────────────

/**
 * Fetch all coins created by a specific wallet address.
 *
 * Uses the 2026 /profileCoins endpoint which returns the creator's
 * created coins. NOTE: /profile alone returns only profile metadata
 * (handle/avatar/bio) — the coins live under /profileCoins.
 *
 * @param creatorAddress The creator's wallet address.
 * @param limit Max number of coins to return (default 100).
 * @returns Array of coin contract addresses.
 */
export async function fetchZoraCreatorCoins(
  creatorAddress: string,
  limit: number = 100,
): Promise<string[]> {
  const clamped = Math.min(Math.max(1, limit), 500);
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/profileCoins?identifier=${creatorAddress.toLowerCase()}&count=${clamped}`,
  );
  const data = (await res.json()) as ZoraApiProfileCoinsResponse;
  const edges = data.profile?.createdCoins?.edges ?? [];
  return edges.map((e) => e.node?.address).filter((a): a is string => Boolean(a));
}

// ─── Coin Price History ────────────────────────────────────────────────────

/**
 * Fetch price history for a coin.
 *
 * The 2026 API has no batch /prices endpoint — the correct endpoint is
 * /coinPriceHistory which returns OHLC-ish close-price series per coin.
 * Callers that need current prices should use fetchZoraCoinInfo().
 *
 * @param coinAddress The coin's contract address.
 * @param range Which series to return (default oneDay).
 * @returns Array of price points (ISO timestamp + USDC close price).
 */
export async function fetchZoraCoinPriceHistory(
  coinAddress: string,
  range: 'oneHour' | 'oneDay' | 'oneWeek' | 'oneMonth' | 'all' = 'oneDay',
): Promise<ZoraPricePoint[]> {
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/coinPriceHistory?address=${coinAddress.toLowerCase()}&chain=${BASE_CHAIN_ID}`,
  );
  const data = (await res.json()) as ZoraApiPriceHistoryResponse;
  return data.zora20Token?.[range] ?? [];
}

// ─── Coin Comments ──────────────────────────────────────────────────────────

export interface ZoraComment {
  /** On-chain comment ID */
  id: string;
  /** Commenter wallet address */
  userAddress: string;
  /** Commenter display handle (from profile) */
  username?: string;
  /** Comment text */
  text: string;
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** Commenter avatar URL */
  avatarUrl?: string;
}

/**
 * Fetch comments for a Zora coin.
 *
 * The 2026 API exposes comments under /coinComments (keyed by coin
 * address) — there is no /live/:id/comments endpoint.
 *
 * @param coinAddress The coin's contract address.
 * @param count Max number of comments to return (default 20).
 * @returns Array of comments.
 */
export async function fetchZoraLiveComments(
  coinAddress: string,
  count: number = 20,
): Promise<ZoraComment[]> {
  const clamped = Math.min(Math.max(1, count), 100);
  const res = await fetchWithTimeout(
    `${COINS_API_BASE}/coinComments?address=${coinAddress.toLowerCase()}&chain=${BASE_CHAIN_ID}&count=${clamped}`,
  );
  const data = (await res.json()) as ZoraApiCoinCommentsResponse;
  const edges = data.zora20Token?.zoraComments?.edges ?? [];
  const comments: ZoraComment[] = [];
  for (const e of edges) {
    const node = e.node;
    if (!node) continue;
    comments.push({
      id: node.commentId || node.txHash || '',
      userAddress: node.userAddress || '',
      username: node.userProfile?.handle,
      text: node.comment || '',
      timestamp: node.timestamp || 0,
      avatarUrl: node.userProfile?.avatar?.previewImage?.small,
    });
  }
  return comments;
}

// ─── Batch Price Query ───────────────────────────────────────────────────────

/**
 * Fetch prices for multiple coins.
 *
 * The 2026 API has no batch /prices endpoint, so prices are fetched
 * per-coin via /coin (the node's tokenPrice.priceInUsdc). Failed lookups
 * are skipped rather than throwing.
 *
 * @param addresses Array of coin contract addresses.
 * @returns Map of address → current price in USDC (decimal string).
 */
export async function fetchZoraBatchPrices(
  addresses: `0x${string}`[],
): Promise<Map<`0x${string}`, string>> {
  const priceMap = new Map<`0x${string}`, string>();
  if (addresses.length === 0) return priceMap;

  // Bound the fan-out to avoid hammering the API.
  const batch = addresses.slice(0, 50);
  const results = await Promise.allSettled(
    batch.map(async (addr) => {
      const res = await fetchWithTimeout(
        `${COINS_API_BASE}/coin?address=${addr.toLowerCase()}&chain=${BASE_CHAIN_ID}`,
      );
      const data = (await res.json()) as ZoraApiCoinResponse;
      const price = data.zora20Token?.tokenPrice?.priceInUsdc;
      return { addr, price };
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.price) {
      priceMap.set(result.value.addr, result.value.price);
    }
  }
  return priceMap;
}
