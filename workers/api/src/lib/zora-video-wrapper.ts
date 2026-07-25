/**
 * @degenfeed/api-worker — Zora Video Discovery & Integration Wrapper
 *
 * Integrates Zora video content (video NFTs) into the DegenFeed unified video hub,
 * shorts feed, and creator coin ecosystem.
 *
 * Capabilities:
 *   1. Zora video discovery — Pull trending/popular videos from Zora
 *   2. Unified player — Embed Zora videos in our video discovery + shorts feed
 *   3. Creator coin integration — Zora videos can be tipped with DegenFeed creator coins
 *   4. Cross-platform — Zora videos appear in our video hub alongside PeerTube/YouTube/etc.
 *
 * API endpoints (handled by zora-video-routes.ts):
 *   GET    /api/zora/videos/trending     — Trending Zora videos
 *   GET    /api/zora/videos/:id          — Video details
 *   POST   /api/zora/videos/:id/tip      — Tip creator via DegenFeed coin
 *   GET    /api/zora/creators/:address   — Creator's video catalog
 *
 * Uses @degenfeed/zora-sdk for on-chain operations and video SDK.
 * Integrates with the video-platform-wrapper for unified aggregation.
 */

import type { Env } from '../index';

// ─── Zora Video Types ────────────────────────────────────────────────────

export type ZoraNetwork = 'base' | 'ethereum' | 'optimism' | 'arbitrum' | 'zora';

export interface ZoraVideoItem {
  /** Zora token ID */
  tokenId: string;
  /** Contract address */
  contractAddress: string;
  /** Video NFT name */
  name: string;
  /** Description */
  description: string;
  /** Video content URL (IPFS/Arweave/HTTP) */
  videoUrl: string;
  /** Thumbnail/preview image URL */
  thumbnailUrl: string;
  /** MIME type of video content */
  mimeType: string;
  /** Duration in seconds (0 if unknown) */
  duration: number;
  /** Creator wallet address */
  creator: string;
  /** Creator display name (from ENS/Zora profile) */
  creatorName?: string;
  /** Creator avatar URL */
  creatorAvatarUrl?: string;
  /** Mint price in ETH (string representation) */
  mintPrice: string;
  /** Edition size (1 = unique, >1 = open edition) */
  editionSize: number;
  /** Number of editions already minted */
  editionsMinted: number;
  /** Chain this NFT lives on */
  chain: ZoraNetwork;
  /** Zora.co URL for collecting */
  zoraUrl: string;
  /** Total volume (ETH) */
  volume?: string;
  /** 24h price change percentage (0 if unknown) */
  priceChange24h?: number;
  /** Number of unique collectors */
  uniqueCollectors?: number;
  /** Tags */
  tags: string[];
  /** Unix timestamp of creation */
  createdAt: number;
  /** Whether the creator has a linked DegenFeed creator coin */
  hasDegenFeedCoin?: boolean;
  /** DegenFeed creator coin address (if linked) */
  degenFeedCoinAddress?: string;
  /** Platform metadata */
  platformMeta?: Record<string, unknown>;
}

export interface ZoraCreatorCatalog {
  address: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  totalVideos: number;
  totalVolume: string;
  uniqueCollectors: number;
  videos: ZoraVideoItem[];
  hasDegenFeedCoin: boolean;
  degenFeedCoinAddress?: string;
}

export interface TrendingQueryOptions {
  limit?: number;
  chain?: ZoraNetwork;
  cursor?: string;
  sortBy?: 'trending' | 'recent' | 'volume' | 'collectors';
  minDuration?: number;
  creator?: string;
}

// ─── KV Key Patterns ────────────────────────────────────────────────────

function trendingCacheKey(chain: string): string {
  return `zora:video:trending:${chain}`;
}

function videoLookupKey(chain: string, tokenId: string): string {
  return `zora:video:lookup:${chain}:${tokenId}`;
}

function creatorKey(address: string): string {
  return `zora:video:creator:${address.toLowerCase()}`;
}

function coinLinkKey(address: string): string {
  return `zora:video:coin-link:${address.toLowerCase()}`;
}

// ─── Zora GraphQL Queries ────────────────────────────────────────────────

const TRENDING_VIDEOS_QUERY = `
  query TrendingVideos($first: Int!, $chain: ChainID!, $cursor: String) {
    tokens(
      where: { collectionAddresses: $contracts }
      sort: { sortKey: TRANSFER_COUNT, sortDirection: DESC }
      networks: { network: ETH, chain: $chain }
      pagination: { limit: $first, after: $cursor }
    ) {
      nodes {
        token {
          tokenId
          name
          description
          image { url }
          content { url mimeType }
          owner
          mintInfo { price }
          collection { address name }
          tokenContract { totalSupply }
        }
        tokenCounts {
          timesTransferred
          uniqueOwners
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

const CREATOR_VIDEOS_QUERY = `
  query CreatorVideos($owner: String!, $first: Int!) {
    tokens(
      where: { ownerAddresses: [$owner] }
      sort: { sortKey: MINTED, sortDirection: DESC }
      pagination: { limit: $first }
    ) {
      nodes {
        token {
          tokenId
          name
          description
          image { url }
          content { url mimeType }
          owner
          mintInfo { price }
          collection { address name }
          tokenContract { totalSupply }
        }
        tokenCounts {
          timesTransferred
          uniqueOwners
        }
      }
    }
  }
`;

// ─── Zora API Configuration ─────────────────────────────────────────────

const ZORA_API_URL = 'https://api.zora.co/graphql';
const ZORA_CO_BASE = 'https://zora.co/collect';

const CHAIN_CONFIG: Record<ZoraNetwork, { chainId: string; network: string }> = {
  base: { chainId: 'BASE_MAINNET', network: 'BASE' },
  ethereum: { chainId: 'ETH_MAINNET', network: 'ETH' },
  optimism: { chainId: 'OPTIMISM_MAINNET', network: 'OPTIMISM' },
  arbitrum: { chainId: 'ARBITRUM_MAINNET', network: 'ARBITRUM' },
  zora: { chainId: 'ZORA_MAINNET', network: 'ZORA' },
};

// ─── Zora Video Wrapper Class ───────────────────────────────────────────

export class ZoraVideoWrapper {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Get trending Zora video NFTs.
   * Results are cached in KV for 5 minutes by chain.
   */
  async getTrendingVideos(options: TrendingQueryOptions = {}): Promise<{
    videos: ZoraVideoItem[];
    cursor: string | null;
    hasMore: boolean;
  }> {
    const chain = options.chain ?? 'base';
    const limit = Math.min(options.limit ?? 20, 100);
    const cacheKey = trendingCacheKey(chain);

    // Check cache first
    if (!options.cursor) {
      try {
        const cachedRaw = await this.env.CACHE?.get(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as { videos: ZoraVideoItem[]; timestamp: number };
          if (Date.now() - cached.timestamp < 300_000) {
            // 5 min cache
            let videos = cached.videos;

            // Apply filters
            const creatorFilter = options.creator;
            if (creatorFilter) {
              videos = videos.filter(
                (v) => v.creator.toLowerCase() === creatorFilter.toLowerCase(),
              );
            }
            if (options.minDuration && options.minDuration > 0) {
              videos = videos.filter((v) => v.duration >= options.minDuration!);
            }

            return {
              videos: videos.slice(0, limit),
              cursor: null,
              hasMore: videos.length > limit,
            };
          }
        }
      } catch {
        // Cache miss — fetch fresh
      }
    }

    // Fetch from Zora API
    try {
      const contracts = this.env.ZORA_VIDEO_CONTRACT ? `["${this.env.ZORA_VIDEO_CONTRACT}"]` : '[]';
      const chainConfig = CHAIN_CONFIG[chain];

      const variables: Record<string, unknown> = {
        first: limit,
        chain: chainConfig.chainId,
        contracts: contracts.length > 2 ? JSON.parse(contracts) : [],
      };

      if (options.cursor) {
        variables.cursor = options.cursor;
      }

      const res = await fetch(ZORA_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: TRENDING_VIDEOS_QUERY,
          variables,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return { videos: [], cursor: null, hasMore: false };
      }

      const data = (await res.json()) as {
        data?: {
          tokens?: {
            nodes?: Array<{
              token?: {
                tokenId: string;
                name: string;
                description: string;
                image?: { url: string };
                content?: { url: string; mimeType: string };
                owner: string;
                mintInfo?: { price: string };
                collection?: { address: string; name: string };
                tokenContract?: { totalSupply: string };
              };
              tokenCounts?: {
                timesTransferred: number;
                uniqueOwners: number;
              };
            }>;
            pageInfo?: { endCursor?: string; hasNextPage: boolean };
          };
        };
      };

      const nodes = data?.data?.tokens?.nodes ?? [];
      const pageInfo = data?.data?.tokens?.pageInfo;

      // Filter to video content only and map
      const videos: ZoraVideoItem[] = [];

      for (const node of nodes) {
        const token = node.token;
        if (!token) continue;

        // Skip non-video content
        if (token.content?.mimeType && !token.content.mimeType.startsWith('video/')) continue;
        if (!token.content?.url && !token.image?.url) continue;

        // Determine if this is a video content (may not have explicit mimeType for legacy)
        const isVideo = token.content?.mimeType?.startsWith('video/') ?? false;
        if (!isVideo && !token.content?.url?.match(/\.(mp4|webm|m3u8|mov)$/i)) continue;

        const chainInfo = CHAIN_CONFIG[chain];

        // Check for linked DegenFeed creator coin
        const coinLink = await this.getLinkedCoin(token.owner);

        videos.push({
          tokenId: token.tokenId,
          contractAddress: token.collection?.address || '',
          name: token.name || 'Untitled',
          description: token.description || '',
          videoUrl: token.content?.url || token.image?.url || '',
          thumbnailUrl: token.image?.url || '',
          mimeType: token.content?.mimeType || 'video/mp4',
          duration: 0, // Zora doesn't expose duration in GraphQL
          creator: token.owner,
          mintPrice: token.mintInfo?.price || '0',
          editionSize: Number(token.tokenContract?.totalSupply) || 1,
          editionsMinted: node.tokenCounts?.timesTransferred ?? 0,
          chain,
          zoraUrl: `${ZORA_CO_BASE}/${chain}:${token.collection?.address || ''}/${token.tokenId}`,
          uniqueCollectors: node.tokenCounts?.uniqueOwners ?? 0,
          tags: ['zora', 'nft', 'video', chain],
          createdAt: Date.now(), // Zora GraphQL doesn't expose createdAt directly
          hasDegenFeedCoin: coinLink.exists,
          degenFeedCoinAddress: coinLink.address,
          platformMeta: {
            network: chainInfo.network,
            collectionName: token.collection?.name,
          },
        });
      }

      // Cache the full result (no cursor = first page = cacheable)
      if (!options.cursor) {
        await this.env.CACHE?.put(cacheKey, JSON.stringify({ videos, timestamp: Date.now() }), {
          expirationTtl: 300,
        }).catch(() => {});
      }

      return {
        videos: videos.slice(0, limit),
        cursor: pageInfo?.endCursor ?? null,
        hasMore: pageInfo?.hasNextPage ?? false,
      };
    } catch (err) {
      console.error('[zora-video-wrapper] Failed to fetch trending:', err);
      return { videos: [], cursor: null, hasMore: false };
    }
  }

  /**
   * Get a single Zora video by token ID.
   */
  async getVideoById(tokenId: string, chain: ZoraNetwork = 'base'): Promise<ZoraVideoItem | null> {
    // Check KV cache first
    try {
      const cachedRaw = await this.env.CACHE?.get(videoLookupKey(chain, tokenId));
      if (cachedRaw) {
        return JSON.parse(cachedRaw) as ZoraVideoItem;
      }
    } catch {
      // Cache miss
    }

    // Fetch from trending results (single video query through Zora is expensive)
    const { videos } = await this.getTrendingVideos({ chain, limit: 50 });
    const video = videos.find((v) => v.tokenId === tokenId || v.contractAddress === tokenId);

    if (video) {
      await this.env.CACHE?.put(videoLookupKey(chain, tokenId), JSON.stringify(video), {
        expirationTtl: 3600,
      }).catch(() => {});
    }

    return video ?? null;
  }

  /**
   * Get all Zora videos by a specific creator wallet address.
   */
  async getCreatorVideos(creatorAddress: string): Promise<ZoraCreatorCatalog | null> {
    const addr = creatorAddress.toLowerCase();
    const cacheKey = creatorKey(addr);

    // Check cache
    try {
      const cachedRaw = await this.env.CACHE?.get(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { catalog: ZoraCreatorCatalog; timestamp: number };
        if (Date.now() - cached.timestamp < 300_000) {
          return cached.catalog;
        }
      }
    } catch {
      // Cache miss
    }

    try {
      const res = await fetch(ZORA_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: CREATOR_VIDEOS_QUERY,
          variables: { owner: addr, first: 50 },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        data?: {
          tokens?: {
            nodes?: Array<{
              token?: {
                tokenId: string;
                name: string;
                description: string;
                image?: { url: string };
                content?: { url: string; mimeType: string };
                owner: string;
                mintInfo?: { price: string };
                collection?: { address: string; name: string };
                tokenContract?: { totalSupply: string };
              };
              tokenCounts?: {
                timesTransferred: number;
                uniqueOwners: number;
              };
            }>;
          };
        };
      };

      const nodes = data?.data?.tokens?.nodes ?? [];
      const coinLink = await this.getLinkedCoin(addr);
      const totalVolume = 0;
      const uniqueCollectors = new Set<string>();

      const videos: ZoraVideoItem[] = [];
      for (const node of nodes) {
        const token = node.token;
        if (!token) continue;

        const isVideo = token.content?.mimeType?.startsWith('video/') ?? false;
        if (!isVideo && !token.content?.url?.match(/\.(mp4|webm|m3u8|mov)$/i)) continue;

        if (node.tokenCounts?.uniqueOwners) {
          // approximate — really need a separate query
        }

        videos.push({
          tokenId: token.tokenId,
          contractAddress: token.collection?.address || '',
          name: token.name || 'Untitled',
          description: token.description || '',
          videoUrl: token.content?.url || token.image?.url || '',
          thumbnailUrl: token.image?.url || '',
          mimeType: token.content?.mimeType || 'video/mp4',
          duration: 0,
          creator: token.owner,
          mintPrice: token.mintInfo?.price || '0',
          editionSize: Number(token.tokenContract?.totalSupply) || 1,
          editionsMinted: node.tokenCounts?.timesTransferred ?? 0,
          chain: 'base',
          zoraUrl: `${ZORA_CO_BASE}/base:${token.collection?.address || ''}/${token.tokenId}`,
          uniqueCollectors: node.tokenCounts?.uniqueOwners ?? 0,
          tags: ['zora', 'nft', 'video', 'base'],
          createdAt: Date.now(),
          hasDegenFeedCoin: coinLink.exists,
          degenFeedCoinAddress: coinLink.address,
        });
      }

      const catalog: ZoraCreatorCatalog = {
        address: addr,
        name: addr.slice(0, 8),
        totalVideos: videos.length,
        totalVolume: totalVolume.toFixed(4),
        uniqueCollectors: uniqueCollectors.size,
        videos,
        hasDegenFeedCoin: coinLink.exists,
        degenFeedCoinAddress: coinLink.address,
      };

      // Cache for 5 minutes
      await this.env.CACHE?.put(cacheKey, JSON.stringify({ catalog, timestamp: Date.now() }), {
        expirationTtl: 300,
      }).catch(() => {});

      return catalog;
    } catch (err) {
      console.error('[zora-video-wrapper] Failed to fetch creator videos:', err);
      return null;
    }
  }

  /**
   * Tip a Zora video creator via DegenFeed creator coin.
   * Uses the relayer or direct mint.
   */
  async tipVideoCreator(
    tokenId: string,
    contractAddress: string,
    tipperAddress: string,
    amount: string,
    chain: ZoraNetwork = 'base',
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const relayerUrl =
        (this.env as Record<string, string | undefined>).ZORA_RELAYER_URL ||
        (this.env as Record<string, string | undefined>).X402_RELAYER_URL;

      if (!relayerUrl) {
        return { success: false, error: 'No relayer configured for tipping' };
      }

      const res = await fetch(relayerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chain,
          action: 'mint_edition',
          tokenId,
          contractAddress,
          tipper: tipperAddress,
          amount,
          value: amount,
          // If creator has a linked coin, tip through the coin instead
          creatorCoin: undefined, // Will be resolved by the relayer
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { success: false, error: `Relayer error: ${body.slice(0, 200)}` };
      }

      const data = (await res.json()) as { txHash?: string };
      return { success: true, txHash: data.txHash };
    } catch (err) {
      return {
        success: false,
        error: `Tip failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Check if a creator has a linked DegenFeed creator coin.
   */
  async getLinkedCoin(creatorAddress: string): Promise<{ exists: boolean; address?: string }> {
    try {
      const raw = await this.env.CACHE?.get(coinLinkKey(creatorAddress.toLowerCase()));
      if (raw) {
        const link = JSON.parse(raw) as { coinAddress: string };
        return { exists: true, address: link.coinAddress };
      }
    } catch {
      // Not found
    }
    return { exists: false };
  }

  /**
   * Link a DegenFeed creator coin to a Zora creator address.
   */
  async linkCreatorCoin(creatorAddress: string, coinAddress: string): Promise<void> {
    await this.env.CACHE?.put(
      coinLinkKey(creatorAddress.toLowerCase()),
      JSON.stringify({ coinAddress: coinAddress.toLowerCase(), linkedAt: Date.now() }),
      { expirationTtl: 86400 * 365 },
    ).catch(() => {});
  }

  /**
   * Convert a ZoraVideoItem to UnifiedVideo format for the video aggregator.
   */
  toUnifiedVideo(video: ZoraVideoItem): import('../lib/video-platform-wrapper').UnifiedVideo {
    return {
      id: `zora:${video.tokenId}`,
      source: 'zora',
      title: video.name,
      description: video.description,
      duration: video.duration,
      thumbnailUrl: video.thumbnailUrl,
      videoUrl: video.videoUrl,
      views: video.editionsMinted,
      likes: video.uniqueCollectors ?? 0,
      createdAt: video.createdAt,
      creator: {
        id: `zora:owner:${video.creator}`,
        handle: video.creator.slice(0, 8),
        displayName: video.creatorName || video.creator.slice(0, 10),
        avatarUrl: video.creatorAvatarUrl,
        walletAddress: video.creator,
      },
      tags: video.tags,
      isLive: false,
      isShort: true,
      nsfw: false,
      collectUrl: video.zoraUrl,
      contentHash: video.tokenId,
      platformMeta: {
        tokenId: video.tokenId,
        contractAddress: video.contractAddress,
        chain: video.chain,
        mintPrice: video.mintPrice,
        editionSize: video.editionSize,
        hasDegenFeedCoin: video.hasDegenFeedCoin,
        degenFeedCoinAddress: video.degenFeedCoinAddress,
      },
    };
  }

  /**
   * Convert a ZoraVideoItem to AggregatedShort format for the shorts feed.
   */
  toAggregatedShort(video: ZoraVideoItem): import('../lib/video-platform-wrapper').AggregatedShort {
    return {
      id: `zora:${video.tokenId}`,
      source: 'zora',
      title: video.name,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration || 30,
      creator: {
        id: `zora:owner:${video.creator}`,
        handle: video.creator.slice(0, 8),
        displayName: video.creatorName || video.creator.slice(0, 10),
        walletAddress: video.creator,
      },
      views: video.editionsMinted,
      likes: video.uniqueCollectors ?? 0,
      createdAt: video.createdAt,
      tags: ['zora', 'nft', 'short'],
      isPortrait: false,
      platformMeta: { tokenId: video.tokenId, chain: video.chain },
    };
  }

  /**
   * Health check: verify Zora GraphQL API is reachable.
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const res = await fetch(ZORA_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: res.ok,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
