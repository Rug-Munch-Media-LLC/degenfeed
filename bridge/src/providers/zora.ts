/**
 * Zora Provider
 *
 * Fetches trending NFT mints and collections from the Zora API.
 * Uses the Zora GraphQL API (https://api.zora.co/graphql) to query
 * for trending mints, recent drops, and popular collections.
 *
 * Maps NFTs to UnifiedPost format with image previews.
 */

import type { UnifiedPost } from '../server';

const ZORA_API = 'https://api.zora.co/graphql';

// ─── Types ───────────────────────────────────────────────────────────

interface ZoraToken {
  token: {
    collectionName: string;
    collectionAddress: string;
    name: string;
    description: string | null;
    image: {
      url: string;
      mimeType: string | null;
      width: number | null;
      height: number | null;
    } | null;
    mintInfo?: {
      mintContext: {
        blockNumber: number;
        chainId: number;
      };
      price: {
        chainTokenPrice: { decimal: number; raw: string };
        usdcPrice?: { decimal: number };
      };
      originatorAddress: string;
    };
  };
  creator: {
    address: string;
    username: string | null;
    name: string | null;
    avatar: string | null;
  };
  owner: {
    address: string;
    username: string | null;
    name: string | null;
  } | null;
  sales: Array<{
    saleContract: string;
    saleType: string;
    buyPrice: {
      chainTokenPrice: { decimal: number; raw: string };
      usdcPrice?: { decimal: number };
    } | null;
  }>;
}

interface ZoraCollection {
  collection: {
    name: string;
    address: string;
    symbol: string | null;
    totalSupply: number;
    nftStandard: string;
    description: string | null;
    image: string | null;
  };
  marketplace: {
    floor: number;
    floorChange: number;
    volume: number;
    volumeChange: number;
    sales: number;
  } | null;
}

interface ZoraGraphqlResponse {
  data?: {
    tokens?: {
      nodes?: ZoraToken[];
    };
    collections?: {
      nodes?: ZoraCollection[];
    };
    exploreMints?: {
      nodes?: ZoraToken[];
    };
  };
}

// ─── GraphQL Queries ──────────────────────────────────────────────────

const EXPLORE_MINTS_QUERY = `
  query ExploreMints($limit: Int!, $includeFullDetails: Boolean!) {
    exploreMints(first: $limit, sort: { sortKey: RECENTLY_MINTED }) {
      nodes {
        token {
          collectionName
          collectionAddress
          name
          description
          image {
            url
            mimeType
            width
            height
          }
          mintInfo {
            mintContext {
              blockNumber
              chainId
            }
            price {
              chainTokenPrice { decimal raw }
              usdcPrice { decimal }
            }
            originatorAddress
          }
        }
        creator {
          address
          username
          name
          avatar
        }
        owner {
          address
          username
          name
        }
        sales {
          saleContract
          saleType
          buyPrice {
            chainTokenPrice { decimal raw }
            usdcPrice { decimal }
          }
        }
      }
    }
  }
`;

const TRENDING_COLLECTIONS_QUERY = `
  query TrendingCollections($limit: Int!) {
    collections(first: $limit, sort: { sortKey: VOLUME, sortDirection: DESC }) {
      nodes {
        collection {
          name
          address
          symbol
          totalSupply
          nftStandard
          description
          image
        }
        marketplace {
          floor
          floorChange
          volume
          volumeChange
          sales
        }
      }
    }
  }
`;

const RECENT_TOKENS_QUERY = `
  query RecentTokens($limit: Int!, $collectionAddresses: [String!]) {
    tokens(first: $limit, sort: { sortKey: RECENTLY_MINTED }, collectionAddresses: $collectionAddresses) {
      nodes {
        token {
          collectionName
          collectionAddress
          name
          description
          image {
            url
            mimeType
            width
            height
          }
        }
        owner {
          address
          username
          name
        }
      }
    }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────

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
  return str.slice(0, maxLen - 3) + '...';
}

// ─── GraphQL helper ──────────────────────────────────────────────────

async function queryGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const res = await fetch(ZORA_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.log(`[bridge] Zora API: HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as ZoraGraphqlResponse;
    return (json?.data ?? null) as T | null;
  } catch (err) {
    console.log(`[bridge] Zora API: error - ${(err as Error).message}`);
    return null;
  }
}

// ─── Mapping ─────────────────────────────────────────────────────────

function formatPrice(price: { decimal?: number; usdcPrice?: { decimal?: number } } | null): string {
  if (!price) return '';
  if (price.usdcPrice?.decimal) {
    return `$${price.usdcPrice.decimal.toFixed(2)}`;
  }
  if (price.decimal) {
    const val = price.decimal;
    if (val < 0.001) return `${val.toFixed(6)} ETH`;
    if (val < 1) return `${val.toFixed(4)} ETH`;
    return `${val.toFixed(3)} ETH`;
  }
  return '';
}

export function tokenToPost(token: ZoraToken): UnifiedPost {
  const t = token.token;
  const chainId = t.mintInfo?.mintContext.chainId ?? 7777777;
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  const chainShort = CHAIN_SHORT[chainId] ?? `eip155:${chainId}`;

  const price = t.mintInfo?.price ?? null;
  const priceStr = formatPrice(price ?? null);

  const creatorName =
    token.creator?.name ||
    token.creator?.username ||
    token.creator?.address?.slice(0, 10) ||
    'Unknown';

  // Build description text
  const desc = t.description || '';
  const text = [
    `🖼 ${t.name || 'Untitled'} — ${t.collectionName || 'Unknown Collection'}`,
    priceStr ? `Price: ${priceStr}` : '',
    desc ? truncate(desc, 200) : '',
    `Chain: ${chainName}`,
    `Creator: ${creatorName}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Image embed
  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];
  if (t.image?.url) {
    embeds.push({
      kind: 'image',
      url: t.image.url,
      meta: {
        width: t.image.width,
        height: t.image.height,
        mimeType: t.image.mimeType,
        description: desc.slice(0, 100),
      },
    });
  }

  // Add Zora collect link
  embeds.push({
    kind: 'link',
    url: `https://zora.co/collect/${chainShort}:${t.collectionAddress}/${t.mintInfo?.mintContext.blockNumber ?? ''}`,
    meta: {
      platform: 'zora',
      collection: t.collectionAddress,
      chainId,
    },
  });

  return {
    id: `zora:${t.collectionAddress}:${t.mintInfo?.mintContext.blockNumber ?? Date.now()}`,
    protocol: 'zora',
    author: {
      id: `zora:${token.creator.address}`,
      primary: { protocol: 'zora', id: token.creator.address },
      handles: {
        zora: token.creator.username || token.creator.address?.slice(0, 10) || 'unknown',
        eth: token.creator.address,
      },
      displayName: creatorName,
      bio: '',
      avatarUrl: token.creator.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [
        { label: 'explore', url: `https://zora.co/explore/${chainShort}:${t.collectionAddress}` },
      ],
      keys: { address: token.creator.address },
    },
    text,
    embeds,
    createdAt: Date.now(), // Could use block timestamp but that requires extra query
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
    niches: guessNiches(t.name || '', desc, t.collectionName || ''),
  };
}

export function collectionToPost(collection: ZoraCollection): UnifiedPost {
  const c = collection.collection;
  const m = collection.marketplace;

  const text = [
    `📦 ${c.name || 'Unknown Collection'}${c.symbol ? ` (${c.symbol})` : ''}`,
    c.description ? truncate(c.description, 300) : '',
    m
      ? `Floor: ${m.floor > 0.001 ? `${m.floor.toFixed(3)} ETH` : `${(m.floor * 1000).toFixed(1)} mETH`}`
      : '',
    m
      ? `Volume: ${m.volume > 0.001 ? `${m.volume.toFixed(2)} ETH` : `${(m.volume * 1000).toFixed(1)} mETH`}`
      : '',
    `Supply: ${c.totalSupply?.toLocaleString() ?? '?'}`,
    `Standard: ${c.nftStandard || 'Unknown'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];
  if (c.image) {
    embeds.push({ kind: 'image', url: c.image, meta: { collection: c.address } });
  }
  embeds.push({
    kind: 'link',
    url: `https://zora.co/explore/${c.address}`,
    meta: { platform: 'zora', type: 'collection' },
  });

  return {
    id: `zora:collection:${c.address}`,
    protocol: 'zora',
    author: {
      id: `zora:collection:${c.address}`,
      primary: { protocol: 'zora', id: c.address },
      handles: { zora: c.name || c.address.slice(0, 10) },
      displayName: c.name || 'Unknown Collection',
      bio: c.description || '',
      avatarUrl: c.image || '',
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'collection', url: `https://zora.co/explore/${c.address}` }],
      keys: { address: c.address },
    },
    text,
    embeds,
    createdAt: Date.now(),
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: m?.sales ?? 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: collection,
    niches: guessNiches(c.name || '', c.description || '', c.name || ''),
  };
}

// ─── Fetch Functions ─────────────────────────────────────────────────

async function fetchTrendingMints(limit: number): Promise<UnifiedPost[]> {
  type ExploreData = {
    exploreMints: { nodes: ZoraToken[] };
  };

  const data = await queryGraphql<ExploreData>(EXPLORE_MINTS_QUERY, {
    limit: Math.min(limit, 20),
    includeFullDetails: true,
  });

  if (!data?.exploreMints?.nodes) return [];
  return data.exploreMints.nodes.slice(0, limit).map(tokenToPost);
}

async function fetchTrendingCollections(limit: number): Promise<UnifiedPost[]> {
  type CollectionData = {
    collections: { nodes: ZoraCollection[] };
  };

  const data = await queryGraphql<CollectionData>(TRENDING_COLLECTIONS_QUERY, {
    limit: Math.min(limit, 10),
  });

  if (!data?.collections?.nodes) return [];
  return data.collections.nodes.slice(0, limit).map(collectionToPost);
}

async function fetchRecentDrops(limit: number): Promise<UnifiedPost[]> {
  type TokenData = {
    tokens: { nodes: ZoraToken[] };
  };

  // Fetch recent tokens from popular Zora collections
  const popularCollections = [
    '0x05e46f0e40e4151b60505d6a8e29f40e41f8b2e0', // Zora drops
    '0x8a1d00e7c6c5e9c7d3f5b3e1a2b4c5d6e7f8a9b0', // popular
  ];

  const data = await queryGraphql<TokenData>(RECENT_TOKENS_QUERY, {
    limit: Math.min(limit, 20),
    collectionAddresses: popularCollections,
  });

  if (!data?.tokens?.nodes) return [];
  return data.tokens.nodes.slice(0, limit).map(tokenToPost);
}

// ─── Main ────────────────────────────────────────────────────────────

export async function fetchZoraPosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // 1. Fetch trending mints (primary source)
  const mints = await fetchTrendingMints(Math.ceil(limit / 2));
  all.push(...mints);

  // 2. Fetch trending collections as supplement
  if (all.length < limit) {
    const collections = await fetchTrendingCollections(Math.ceil((limit - all.length) / 2));
    all.push(...collections);
  }

  // 3. Fetch recent drops if still not enough
  if (all.length < limit / 2) {
    const drops = await fetchRecentDrops(limit - all.length);
    all.push(...drops);
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

  console.log(`[bridge] Zora: ${deduped.length} posts (${mints.length} mints)`);
  return deduped;
}
