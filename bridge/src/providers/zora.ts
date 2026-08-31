/**
 * Zora Provider — Self-hosted Zora Indexer + Zora Coins public REST API
 *
 * Primary: local Zora indexer (http://127.0.0.1:8091/) which reads Zora NFT
 * collections/tokens/mints/sales. When the local indexer is down (as it has
 * been — it no longer runs on this host), we fall back to Zora's public
 * REST API (https://api-sdk.zora.engineering) which serves the current Zora
 * mint economy: creator/content/trend COINS (Zora pivoted from 1155 NFT
 * minting to the Coins protocol; on-chain Zora-network NFT activity has
 * essentially stopped).
 *
 * The public API works WITHOUT a key (rate-limited). Setting ZORA_API_KEY
 * (the `api-key` header, created at https://zora.co/settings/developer)
 * raises the rate limit for production use.
 *
 * ⚠️ KNOWN ISSUE: The tsx/esbuild transpiler's __name helper on export
 * aliases can cause "Maximum call stack size exceeded" during module
 * loading. We use renamed exports explicitly to prevent this.
 *
 * Endpoint: http://127.0.0.1:8091/
 *   GET /api/collections  — NFT collections
 *   GET /api/tokens       — NFT tokens
 *   GET /api/mints        — Mint events
 *   GET /api/sales        — Sale events
 *
 * External: {ZORA_API_URL}/explore?listType=NEW|LAST_TRADED&count=N
 *   returns { exploreList: { edges: [{ node: ZoraCoin }] } } — keyless.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

/**
 * Use global fetch directly. The old `$fetch = globalThis.fetch` workaround
 * was needed when we had `export const fetch = fetchZoraPosts` which caused
 * the esbuild __name transpiler to overflow. Now that we export individual
 * function names, there's no collision.
 */

// ─── Configuration ────────────────────────────────────────────────────

const ZORA_INDEXER_URL = process.env.ZORA_INDEXER_URL || 'http://127.0.0.1:8091';
/** Zora public REST API base (Coins SDK backend). Keyless works; key raises limits. */
const ZORA_API_URL = process.env.ZORA_API_URL || 'https://api-sdk.zora.engineering';
/** Optional `api-key` header — create at https://zora.co/settings/developer */
const ZORA_API_KEY = process.env.ZORA_API_KEY || '';
/**
 * Keyless API throttles burst callers by QUEUEING requests (~10s, observed
 * 2026-08-31) — so the per-call timeout must exceed that or every cold
 * request aborts. 15s > observed 10.7s queue.
 */
const ZORA_API_TIMEOUT_MS = 15_000;
/**
 * Short TTL cache for external coins. The feed prewarmer + refresher call
 * providers repeatedly (~3 protocol sets every 55s); without a cache each
 * call burns 1-2 of the keyless API's throttled request slots and the feed
 * degrades to timeouts. 90s collapses repeated calls into one real fetch.
 */
const ZORA_EXTERNAL_CACHE_TTL_MS = 90_000;
let zoraExternalCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

// ─── Zora Coins public REST API types ────────────────────────────────

interface ZoraCoinMedia {
  mimeType?: string;
  originalUri?: string;
  previewImage?: {
    medium?: string;
    small?: string;
    blurhash?: string | null;
  };
}

interface ZoraCoinProfile {
  handle?: string;
  avatar?: { previewImage?: { medium?: string; small?: string } };
}

interface ZoraCoin {
  id?: string;
  name: string;
  description?: string;
  address: string;
  symbol?: string;
  coinType?: 'CREATOR' | 'CONTENT' | 'TREND';
  totalSupply?: string;
  totalVolume?: string;
  volume24h?: string;
  createdAt?: string;
  creatorAddress?: string;
  marketCap?: string;
  marketCapDelta24h?: string;
  chainId?: number;
  tokenUri?: string;
  uniqueHolders?: number;
  creatorProfile?: ZoraCoinProfile;
  mediaContent?: ZoraCoinMedia;
  poolCurrencyToken?: { address?: string; name?: string; decimals?: number };
  tokenPrice?: { priceInUsdc?: string; priceInPoolToken?: string; currencyAddress?: string };
}

interface ZoraExploreResponse {
  exploreList?: {
    edges?: Array<{ node?: ZoraCoin }>;
    pageInfo?: { endCursor?: string };
  };
}

// ─── Interfaces ───────────────────────────────────────────────────────

interface IndexerCollection {
  address: string;
  name: string;
  symbol: string | null;
  total_supply: number;
  nft_standard: string;
  description: string | null;
  image: string | null;
  chain_id: number;
  floor_price: number;
  floor_change: number;
  volume: number;
  volume_change: number;
  sales_count: number;
}

interface IndexerToken {
  id: string;
  collection_address: string;
  collection_name: string;
  name: string;
  description: string | null;
  image_url: string | null;
  mime_type: string | null;
  image_width: number | null;
  image_height: number | null;
  owner_address: string | null;
  owner_username: string | null;
  owner_name: string | null;
  creator_address: string | null;
  creator_username: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
  mint_price_eth: number | null;
  mint_price_usdc: number | null;
  mint_block_number: number | null;
  mint_chain_id: number;
  originator_address: string | null;
  created_at: string | null;
}

interface IndexerResponse<T> {
  data: T[];
  meta: {
    total: number;
    returned: number;
    offset: number;
    limit: number;
    source: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  5: 'Goerli',
  10: 'Optimism',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  7777777: 'Zora',
  11155111: 'Sepolia',
};

const CHAIN_SHORT: Record<number, string> = {
  1: 'eth',
  10: 'optimism',
  137: 'polygon',
  42161: 'arbitrum',
  8453: 'base',
  7777777: 'zora',
};

/** Zora Coins chain names (default Base — most coin activity). */
const COIN_CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  7777777: 'Zora',
  11155111: 'Sepolia',
};

export function guessNiches(name: string, description: string, collectionName: string): string[] {
  const niches: string[] = [];
  const lower = `${name} ${description} ${collectionName}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp)\b/.test(lower)) niches.push('defi');
  if (/\b(art|artist|gallery|painting|sculpture|digital)\b/.test(lower)) niches.push('art');
  if (/\b(generative|algorithmic|code|gen)\b/.test(lower)) niches.push('generative');
  if (/\b(punk|ape|pengu|mfers|doodles|milady)\b/.test(lower)) niches.push('bluechip');
  if (/\b(meme|pepe|dog|shib|cat|based)\b/.test(lower)) niches.push('memecoin');
  if (/\b(photo|photography|landscape|portrait)\b/.test(lower)) niches.push('photography');
  if (/\b(music|song|album|track|audio)\b/.test(lower)) niches.push('music');
  if (/\b(game|gaming|play|rpg|metaverse)\b/.test(lower)) niches.push('gaming');
  if (/\b(ai|artificial|intelligence|llm|agent|neural)\b/.test(lower)) niches.push('ai');

  if (niches.length === 0) niches.push('nft');
  return niches;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}

function formatPrice(ethPrice: number | null, usdcPrice: number | null): string {
  if (usdcPrice && usdcPrice > 0) {
    return `$${usdcPrice.toFixed(2)}`;
  }
  if (ethPrice && ethPrice > 0) {
    if (ethPrice < 0.001) return `${ethPrice.toFixed(6)} ETH`;
    if (ethPrice < 1) return `${ethPrice.toFixed(4)} ETH`;
    return `${ethPrice.toFixed(3)} ETH`;
  }
  return '';
}

// ─── Fetch from Local Indexer ─────────────────────────────────────────

async function fetchFromIndexer<T>(path: string, limit: number): Promise<T[]> {
  const url = `${ZORA_INDEXER_URL}${path}?limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      // Dead-local fast-fail: the default ZORA_INDEXER_URL is the
      // container-local loopback (127.0.0.1:8091) which is frequently down —
      // fail in 1.5s so external fallbacks serve instead of a 5s stall.
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) {
      console.warn(`[bridge] Zora Indexer: HTTP ${res.status} ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as IndexerResponse<T>;
    if (!data.data || data.data.length === 0) {
      console.warn('[bridge] Zora Indexer: No data returned');
      return [];
    }

    return data.data;
  } catch (err) {
    console.warn(
      '[bridge] Zora Indexer: Error fetching:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

// ─── Token → UnifiedPost Mapping ──────────────────────────────────────

function tokenToPost(token: IndexerToken): UnifiedPost | null {
  const chainId = token.mint_chain_id || 7777777;
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  const chainShort = CHAIN_SHORT[chainId] ?? `eip155:${chainId}`;

  const priceStr = formatPrice(token.mint_price_eth, token.mint_price_usdc);

  const creatorName =
    token.creator_name ||
    token.creator_username ||
    token.creator_address?.slice(0, 10) ||
    'Unknown';

  const desc = token.description || '';
  const text = [
    `🖼 ${token.name || 'Untitled'} — ${token.collection_name || 'Unknown Collection'}`,
    priceStr ? `Price: ${priceStr}` : '',
    desc ? truncate(desc, 200) : '',
    `Chain: ${chainName}`,
    `Creator: ${creatorName}`,
  ]
    .filter(Boolean)
    .join('\n');

  const embeds: Array<{
    kind: string;
    url: string;
    meta?: Record<string, unknown>;
  }> = [];

  const mime = (token.mime_type || '').toLowerCase();
  const isVideoMime = mime.startsWith('video/');

  if (token.image_url) {
    embeds.push({
      // Zora mints can be video (e.g. video/mp4) — surface those as video embeds
      kind: isVideoMime ? 'video' : 'image',
      url: token.image_url,
      meta: {
        width: token.image_width,
        height: token.image_height,
        mimeType: token.mime_type,
        description: desc.slice(0, 100),
      },
    });
  }

  // Add Zora collect link
  embeds.push({
    kind: 'link',
    url: `https://zora.co/collect/${chainShort}:${token.collection_address}/${token.mint_block_number ?? ''}`,
    meta: {
      platform: 'zora',
      collection: token.collection_address,
      chainId,
    },
  });

  return {
    id: `zora:${token.collection_address}:${token.mint_block_number ?? Date.now()}`,
    protocol: 'zora',
    contentType: 'image',
    author: {
      id: `zora:${token.creator_address || token.collection_address}`,
      primary: {
        protocol: 'zora',
        id: token.creator_address || token.collection_address,
      },
      handles: {
        zora: token.creator_username || token.creator_address?.slice(0, 10) || 'unknown',
        eth: token.creator_address || '',
      },
      displayName: creatorName,
      bio: '',
      avatarUrl: token.creator_avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [
        {
          label: 'explore',
          url: `https://zora.co/explore/${chainShort}:${token.collection_address}`,
        },
      ],
      keys: { address: token.creator_address || token.collection_address },
    },
    text,
    embeds,
    createdAt: token.created_at ? new Date(token.created_at).getTime() : Date.now(),
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: token,
    niches: guessNiches(token.name || '', desc, token.collection_name || ''),
  };
}

// ─── Collection → UnifiedPost Mapping ─────────────────────────────────

function collectionToPost(col: IndexerCollection): UnifiedPost {
  const text = [
    `📦 ${col.name || 'Unknown Collection'}${col.symbol ? ` (${col.symbol})` : ''}`,
    col.description ? truncate(col.description, 300) : '',
    col.floor_price > 0
      ? `Floor: ${col.floor_price > 0.001 ? `${col.floor_price.toFixed(3)} ETH` : `${(col.floor_price * 1000).toFixed(1)} mETH`}`
      : '',
    col.volume > 0
      ? `Volume: ${col.volume > 0.001 ? `${col.volume.toFixed(2)} ETH` : `${(col.volume * 1000).toFixed(1)} mETH`}`
      : '',
    `Supply: ${col.total_supply?.toLocaleString() ?? '?'}`,
    `Standard: ${col.nft_standard || 'Unknown'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const embeds: Array<{
    kind: string;
    url: string;
    meta?: Record<string, unknown>;
  }> = [];

  if (col.image) {
    embeds.push({
      kind: 'image',
      url: col.image,
      meta: { collection: col.address },
    });
  }
  embeds.push({
    kind: 'link',
    url: `https://zora.co/explore/${col.address}`,
    meta: { platform: 'zora', type: 'collection' },
  });

  return {
    id: `zora:collection:${col.address}`,
    protocol: 'zora',
    contentType: 'image',
    author: {
      id: `zora:collection:${col.address}`,
      primary: { protocol: 'zora', id: col.address },
      handles: { zora: col.name || col.address.slice(0, 10) },
      displayName: col.name || 'Unknown Collection',
      bio: col.description || '',
      avatarUrl: col.image || '',
      followerCount: 0,
      followingCount: 0,
      links: [
        {
          label: 'collection',
          url: `https://zora.co/explore/${col.address}`,
        },
      ],
      keys: { address: col.address },
    },
    text,
    embeds,
    createdAt: Date.now(),
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: col.sales_count ?? 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: col,
    niches: guessNiches(col.name || '', col.description || '', col.name || ''),
  };
}

// ─── Fetch Functions ──────────────────────────────────────────────────

async function fetchTrendingMints(limit: number): Promise<UnifiedPost[]> {
  const tokens = await fetchFromIndexer<IndexerToken>('/api/tokens', Math.min(limit, 20));
  return tokens.slice(0, limit).map(tokenToPost).filter(Boolean) as UnifiedPost[];
}

async function fetchTrendingCollections(limit: number): Promise<UnifiedPost[]> {
  const collections = await fetchFromIndexer<IndexerCollection>(
    '/api/collections',
    Math.min(limit, 10),
  );
  return collections.slice(0, limit).map(collectionToPost);
}

// ─── Zora Coins external fallback (public REST API) ───────────────────

function formatUsdcPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '';
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.001) return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(4)}`;
}

/**
 * Fetch coins from Zora's public REST API (keyless; ZORA_API_KEY raises the
 * rate limit). listType values: NEW, LAST_TRADED, TOP_GAINERS, TOP_VOLUME_24H,
 * MOST_VALUABLE, FEATURED, NEW_CREATORS, MOST_VALUABLE_CREATORS.
 */
async function fetchExternalCoins(listType: string, limit: number): Promise<ZoraCoin[]> {
  const headers: Record<string, string> = {
    'User-Agent': 'DegenFeed-Bridge/0.1',
    Accept: 'application/json',
  };
  if (ZORA_API_KEY) headers['api-key'] = ZORA_API_KEY;

  const url = `${ZORA_API_URL}/explore?listType=${encodeURIComponent(listType)}&count=${Math.min(Math.max(limit, 1), 50)}`;

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(ZORA_API_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `[bridge] Zora API: HTTP ${res.status} ${res.statusText} (listType=${listType})`,
      );
      return [];
    }
    const data = (await res.json()) as ZoraExploreResponse;
    const coins = (data.exploreList?.edges ?? [])
      .map((e) => e.node)
      .filter((n): n is ZoraCoin => Boolean(n?.name && n.address));
    if (coins.length === 0) {
      console.warn(`[bridge] Zora API: no coins for listType=${listType}`);
    }
    return coins;
  } catch (err) {
    console.warn('[bridge] Zora API: Error fetching:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Coin → UnifiedPost (Zora coins: creator/content/trend tokens). */
function coinToPost(coin: ZoraCoin): UnifiedPost | null {
  if (!coin?.name || !coin.address) return null;

  const chainId = coin.chainId || 8453;
  const chainName = COIN_CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  const chainShort = CHAIN_SHORT[chainId] ?? String(chainId);
  const created = coin.createdAt ? new Date(coin.createdAt).getTime() : Date.now();

  const desc = (coin.description || '').trim();
  const priceUsdc = coin.tokenPrice?.priceInUsdc ? Number(coin.tokenPrice.priceInUsdc) : 0;
  const pricePool = coin.tokenPrice?.priceInPoolToken
    ? Number(coin.tokenPrice.priceInPoolToken)
    : 0;
  const mcap = coin.marketCap ? Number(coin.marketCap) : 0;
  const volume = coin.totalVolume ? Number(coin.totalVolume) : 0;

  const creatorName = coin.creatorProfile?.handle || coin.creatorAddress?.slice(0, 10) || 'Unknown';
  const image =
    coin.mediaContent?.previewImage?.medium || coin.mediaContent?.previewImage?.small || '';

  const priceStr =
    formatUsdcPrice(priceUsdc) ||
    (pricePool > 0 ? `${pricePool.toFixed(4)} ${coin.poolCurrencyToken?.name || 'pool'}` : '');

  const typeLabel =
    coin.coinType === 'CREATOR'
      ? 'Creator coin'
      : coin.coinType === 'TREND'
        ? 'Trend coin'
        : 'Content coin';

  const text = [
    `🪙 ${coin.name}${coin.symbol && coin.symbol !== coin.name.toLowerCase() ? ` ($${coin.symbol})` : ''} — ${typeLabel}`,
    priceStr ? `Price: ${priceStr}` : '',
    mcap > 0
      ? `Market cap: ${mcap >= 1000 ? `$${mcap.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${mcap.toFixed(4)}`}`
      : '',
    volume > 0
      ? `Volume: ${volume >= 1000 ? volume.toLocaleString(undefined, { maximumFractionDigits: 2 }) : volume.toFixed(4)}`
      : '',
    desc ? truncate(desc, 220) : '',
    `Chain: ${chainName}`,
  ]
    .filter(Boolean)
    .join('\n');

  const embeds: Array<{
    kind: string;
    url: string;
    meta?: Record<string, unknown>;
  }> = [];

  if (image) {
    embeds.push({
      kind: 'image',
      url: image,
      meta: {
        platform: 'zora',
        mimeType: coin.mediaContent?.mimeType,
        description: desc.slice(0, 100),
      },
    });
  }
  embeds.push({
    kind: 'link',
    url: `https://zora.co/coin/${chainShort}:${coin.address}`,
    meta: { platform: 'zora', type: 'coin', chainId, address: coin.address },
  });

  return {
    id: `zora:coin:${chainId}:${coin.address}`,
    protocol: 'zora',
    contentType: image ? 'image' : 'link',
    author: {
      id: `zora:${coin.creatorAddress || coin.address}`,
      primary: { protocol: 'zora', id: coin.creatorAddress || coin.address },
      handles: {
        zora: coin.creatorProfile?.handle || coin.creatorAddress?.slice(0, 10) || 'unknown',
        eth: coin.creatorAddress || '',
      },
      displayName: creatorName,
      bio: '',
      avatarUrl: coin.creatorProfile?.avatar?.previewImage?.medium || '',
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'explore', url: `https://zora.co/coin/${chainShort}:${coin.address}` }],
      keys: { address: coin.creatorAddress || coin.address },
    },
    text,
    embeds,
    createdAt: Number.isNaN(created) ? Date.now() : created,
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: coin.uniqueHolders || 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: coin.uniqueHolders || 0 },
    },
    raw: coin,
    niches: guessNiches(coin.name, desc, `${coin.coinType || ''} ${chainName}`),
  };
}

/** External fallback: recent/trending Zora coins (NEW first, then LAST_TRADED). */
async function fetchExternalCoinPosts(limit: number): Promise<UnifiedPost[]> {
  if (zoraExternalCache && Date.now() < zoraExternalCache.expiresAt) {
    return zoraExternalCache.posts.slice(0, limit);
  }
  const want = Math.min(Math.max(limit, 1), 50);
  const fresh = await fetchExternalCoins('NEW', want);
  let coins = fresh;
  if (coins.length < want) {
    const traded = await fetchExternalCoins('LAST_TRADED', want - coins.length);
    coins = [...coins, ...traded];
  }
  const posts = coins
    .slice(0, limit)
    .map(coinToPost)
    .filter((p): p is UnifiedPost => p !== null);
  if (posts.length > 0) {
    zoraExternalCache = { posts, expiresAt: Date.now() + ZORA_EXTERNAL_CACHE_TTL_MS };
  }
  return posts;
}

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'zora',
  name: 'Zora NFT',
  description:
    'Zora mint economy — creator/content/trend coins + indexer NFTs (external API fallback)',
  endpoint: '/api/feed/zora',
  requiresAuth: false,
  contentType: 'image',
};

export async function fetchZoraPosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // 1. Fetch tokens (mints) from local indexer
  const mints = await fetchTrendingMints(Math.ceil(limit / 2));
  all.push(...mints);

  // 2. Fetch collections as supplement
  if (all.length < limit) {
    const collections = await fetchTrendingCollections(Math.ceil((limit - all.length) / 2));
    all.push(...collections);
  }

  // 3. External fallback: Zora Coins public REST API. The local indexer is
  // usually down (dead-local fast-fail above), so this is the primary path
  // for real content. Serves the current Zora mint economy (coins), keyless.
  if (all.length < limit) {
    const coinPosts = await fetchExternalCoinPosts(limit - all.length);
    all.push(...coinPosts);
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = p.text.slice(0, 60) + (p.embeds[0]?.url ?? '');
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] Zora: ${deduped.length} posts (${mints.length} indexer mints)`);
  return deduped;
}

// ─── Exports ──────────────────────────────────────────────────────────
// All functions are already exported inline (export async function / export const).
// No need for a re-export block that causes tsx transpiler __name decoration.
// The PROVIDERS registry in feeds.ts uses { fetchZoraPosts } directly.
