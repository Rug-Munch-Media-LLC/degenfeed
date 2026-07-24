/**
 * Zora Provider — Self-hosted Zora Indexer
 *
 * Reads Zora NFT data from our local Zora indexer (port 8090) instead of
 * the external api.zora.co GraphQL API.
 *
 * This gives DegenFeed ownership of its Zora NFT data — no dependency on
 * the public Zora API for reads.
 *
 * The local indexer runs at /srv/degenfeed/zora-indexer/ and polls
 * api.zora.co every 30s, storing results in SQLite.
 *
 * Endpoint: http://127.0.0.1:8091/
 *   GET /api/collections  — NFT collections
 *   GET /api/tokens       — NFT tokens
 *   GET /api/mints        — Mint events
 *   GET /api/sales        — Sale events
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';
const $fetch = globalThis.fetch;

// ─── Configuration ────────────────────────────────────────────────────

const ZORA_INDEXER_URL = process.env.ZORA_INDEXER_URL || 'http://127.0.0.1:8091';

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
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
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

  if (token.image_url) {
    embeds.push({
      kind: 'image',
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
    createdAt: Date.now(),
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

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'zora',
  name: 'Zora NFT',
  description: 'NFT minting protocol — trending mints and collections (self-hosted indexer)',
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

  console.log(`[bridge] Zora Indexer: ${deduped.length} posts (${mints.length} mints)`);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchZoraPosts;
