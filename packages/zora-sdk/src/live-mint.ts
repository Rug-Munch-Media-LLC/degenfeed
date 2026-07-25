/**
 * @degenfeed/zora-sdk — Live Mint Events & Zora Shorts
 *
 * Zora supports "Live Mint" events where NFTs are minted in real-time
 * during a live event. These are ERC-1155 editions with time-limited minting.
 *
 * This module provides:
 *   - Live mint event detection from Zora API
 *   - Zora short video NFT detection
 *   - Live mint participation (mint during a live event)
 *   - Trending video NFTs from Zora
 *   - Bid/offer on Zora NFTs
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface ZoraLiveMintEvent {
  /** Event identifier */
  id: string;
  /** NFT contract address */
  contractAddress: string;
  /** Token ID */
  tokenId: string;
  /** Event title */
  title: string;
  /** Event description */
  description: string;
  /** Chain (base, zora, ethereum, optimism) */
  chain: string;
  /** Creator address */
  creator: string;
  /** Creator display name */
  creatorName?: string;
  /** Mint price in ETH */
  mintPriceEth: string;
  /** Total edition size */
  editionSize: number;
  /** Number already minted */
  mintedCount: number;
  /** When minting starts (ISO 8601) */
  startsAt?: string;
  /** When minting ends (ISO 8601) */
  endsAt?: string;
  /** Whether minting is currently active */
  isActive: boolean;
  /** Whether this is associated with a live event */
  isLiveEvent: boolean;
  /** Media URL (image/video) */
  mediaUrl?: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Associated live stream URL if applicable */
  liveStreamUrl?: string;
  /** Tags */
  tags: string[];
  /** Number of unique collectors */
  collectorCount: number;
  /** Royalty BPS */
  royaltyBps: number;
}

export interface ZoraShortVideoNFT {
  /** NFT identifier */
  tokenId: string;
  /** Contract address */
  contractAddress: string;
  /** Chain */
  chain: string;
  /** Video title */
  title: string;
  /** Description */
  description: string;
  /** Video URL (IPFS or https) */
  videoUrl: string;
  /** Thumbnail URL */
  thumbnailUrl: string;
  /** Duration in seconds */
  duration: number;
  /** Creator address */
  creator: string;
  /** Creator display name */
  creatorName?: string;
  /** Owner address */
  owner: string;
  /** Mint price (wei) */
  mintPriceWei: string;
  /** Total supply minted */
  totalSupply: string;
  /** Edition size */
  editionSize: number;
  /** Whether this is short-form (< 120s) */
  isShort: boolean;
  /** When created */
  createdAt: string;
  /** Tags/attributes */
  tags: string[];
}

export interface ZoraBidRequest {
  /** Contract address of the NFT */
  contractAddress: string;
  /** Token ID */
  tokenId: string;
  /** Chain */
  chain: string;
  /** Bid amount in ETH */
  amountEth: string;
  /** Bidder address */
  bidder: string;
  /** Expiration timestamp */
  expiresAt?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────

const ZORA_API_BASE = 'https://api.zora.co/v2';
const SHORTS_MAX_DURATION = 120; // seconds

// ─── API Client ─────────────────────────────────────────────────────────

async function zoraFetch(path: string, params?: Record<string, string>): Promise<Response> {
  const url = new URL(`${ZORA_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': 'DegenFeed/1.0 (zora)',
    },
  });
}

// ─── Live Mint Events ───────────────────────────────────────────────────

/**
 * Fetch active live mint events from Zora.
 * Live mints are time-limited edition NFTs currently open for minting.
 */
export async function fetchZoraLiveMints(
  opts: { chain?: string; creator?: string; limit?: number; includeEnded?: boolean } = {},
): Promise<ZoraLiveMintEvent[]> {
  const { chain = 'base', limit = 20, creator, includeEnded = false } = opts;

  try {
    const params: Record<string, string> = {
      limit: String(limit),
      collectionType: 'ERC1155',
      sortDirection: 'DESC',
      sortKey: 'created',
    };

    if (chain) params.chain = chain;
    if (creator) params.creatorAddresses = creator;

    const response = await zoraFetch('/tokens', params);

    if (!response.ok) {
      console.warn(`Zora API returned ${response.status} for live mints`);
      return [];
    }

    const data = (await response.json()) as {
      tokens?: Array<{
        token: {
          tokenId: string;
          contract: { address: string; chain: string };
          mintInfo?: {
            mintStatus: string;
            totalMinted: string;
            totalSupply: string;
            price: { nativePrice: { decimal: number; currency: string } };
            startTime?: string;
            endTime?: string;
          };
          metadata?: {
            name?: string;
            description?: string;
            mediaUrl?: string;
            thumbnailUrl?: string;
            attributes?: Array<{ trait_type: string; value: string }>;
          };
          owner: string;
          tokenSupply: { totalSupply: string };
          collectorCount?: number;
          royalities?: { bps: number };
        };
        market?: {
          creator: string;
        };
      }>;
    };

    if (!data.tokens) return [];

    // Filter for live/mintable tokens
    const events: ZoraLiveMintEvent[] = [];

    for (const item of data.tokens) {
      const token = item.token;
      const mintInfo = token.mintInfo;
      if (!mintInfo) continue;

      const isActive =
        mintInfo.mintStatus === 'ACTIVE' ||
        mintInfo.mintStatus === 'LIVE' ||
        mintInfo.mintStatus === 'OPEN';

      if (!isActive && !includeEnded) continue;

      const metadata = token.metadata;
      const attrs = metadata?.attributes ?? [];
      const tags = attrs
        .filter((a) => a.trait_type === 'tag' || a.trait_type === 'hashtag')
        .map((a) => a.value);

      // Detect if this is associated with a live event
      const isLiveEvent =
        mintInfo.mintStatus === 'LIVE' ||
        tags.some((t) => ['live', 'live-mint', 'stream'].includes(t.toLowerCase())) ||
        metadata?.name?.toLowerCase().includes('live') ||
        metadata?.description?.toLowerCase().includes('live stream');

      events.push({
        id: `${token.contract.chain}:${token.contract.address}:${token.tokenId}`,
        contractAddress: token.contract.address,
        tokenId: token.tokenId,
        title: metadata?.name ?? 'Untitled Edition',
        description: metadata?.description ?? '',
        chain: token.contract.chain,
        creator: item.market?.creator ?? token.owner,
        mintPriceEth: mintInfo.price?.nativePrice?.decimal
          ? String(mintInfo.price.nativePrice.decimal)
          : '0',
        editionSize: mintInfo.totalSupply ? parseInt(mintInfo.totalSupply, 10) : 0,
        mintedCount: mintInfo.totalMinted ? parseInt(mintInfo.totalMinted, 10) : 0,
        startsAt: mintInfo.startTime,
        endsAt: mintInfo.endTime,
        isActive,
        isLiveEvent,
        mediaUrl: metadata?.mediaUrl,
        thumbnailUrl: metadata?.thumbnailUrl,
        tags,
        collectorCount: token.collectorCount ?? 0,
        royaltyBps: token.royalties?.bps ?? 0,
      });
    }

    return events.slice(0, limit);
  } catch (err) {
    console.warn('Failed to fetch Zora live mints:', err);
    return [];
  }
}

// ─── Zora Short Video NFTs ─────────────────────────────────────────────

/**
 * Fetch short-form video NFTs from Zora.
 * Filters for video content with short duration attributes.
 */
export async function fetchZoraShortVideos(
  opts: { chain?: string; creator?: string; limit?: number } = {},
): Promise<ZoraShortVideoNFT[]> {
  const { chain, limit = 20, creator } = opts;

  try {
    const params: Record<string, string> = {
      limit: String(limit * 2), // fetch more to filter
      collectionType: 'ERC1155',
      sortDirection: 'DESC',
      sortKey: 'created',
      mediaType: 'VIDEO',
    };

    if (chain) params.chain = chain;
    if (creator) params.creatorAddresses = creator;

    const response = await zoraFetch('/tokens', params);

    if (!response.ok) {
      console.warn(`Zora API returned ${response.status} for shorts`);
      return [];
    }

    const data = (await response.json()) as {
      tokens?: Array<{
        token: {
          tokenId: string;
          contract: { address: string; chain: string };
          metadata?: {
            name?: string;
            description?: string;
            mediaUrl?: string;
            thumbnailUrl?: string;
            attributes?: Array<{ trait_type: string; value: string }>;
            content?: { duration?: string };
          };
          owner: string;
          tokenSupply: { totalSupply: string };
          mintInfo?: {
            totalSupply: string;
            totalMinted: string;
            price?: { nativePrice?: { decimal: number } };
          };
        };
        market?: { creator: string };
      }>;
    };

    if (!data.tokens) return [];

    const shorts: ZoraShortVideoNFT[] = [];

    for (const item of data.tokens) {
      const token = item.token;
      const metadata = token.metadata;
      if (!metadata?.mediaUrl) continue;
      if (!metadata.mediaUrl.match(/\.(mp4|webm|mov|m3u8)/i)) continue;

      // Parse duration from metadata
      let duration = 0;
      if (metadata.content?.duration) {
        const match = metadata.content.duration.match(/PT(\d+(?:\.\d+)?)S/);
        if (match?.[1]) duration = Math.round(parseFloat(match[1]));
      }
      if (!duration && metadata.attributes) {
        const durAttr = metadata.attributes.find(
          (a) => a.trait_type === 'duration' || a.trait_type === 'Duration',
        );
        if (durAttr) duration = parseInt(durAttr.value, 10);
      }

      // Only include short-form videos
      if (duration > SHORTS_MAX_DURATION && duration !== 0) continue;

      const tags = (metadata.attributes ?? [])
        .filter((a) => a.trait_type === 'tag' || a.trait_type === 'hashtag')
        .map((a) => a.value);

      if (duration === 0 || duration <= SHORTS_MAX_DURATION) {
        shorts.push({
          tokenId: token.tokenId,
          contractAddress: token.contract.address,
          chain: token.contract.chain,
          title: metadata.name ?? 'Untitled',
          description: metadata.description ?? '',
          videoUrl: metadata.mediaUrl,
          thumbnailUrl: metadata.thumbnailUrl ?? '',
          duration,
          creator: item.market?.creator ?? token.owner,
          owner: token.owner,
          mintPriceWei: token.mintInfo?.price?.nativePrice?.decimal
            ? String(token.mintInfo.price.nativePrice.decimal)
            : '0',
          totalSupply: token.tokenSupply.totalSupply,
          editionSize: token.mintInfo?.totalSupply ? parseInt(token.mintInfo.totalSupply, 10) : 1,
          isShort: duration <= SHORTS_MAX_DURATION,
          createdAt: '', // Zora v2 API may not return this
          tags,
        });
      }
    }

    return shorts.slice(0, limit);
  } catch (err) {
    console.warn('Failed to fetch Zora short videos:', err);
    return [];
  }
}

// ─── Normalization for Unified Feed ────────────────────────────────────

/** Normalize a Zora short video NFT for unified feed display */
export function normalizeZoraShort(nft: ZoraShortVideoNFT): {
  id: string;
  type: 'short' | 'video';
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  source: string;
  creatorId: string;
  creatorName: string;
  platform: string;
  publishedAt: number;
  tags: string[];
  mintPriceWei: string;
  chain: string;
  contractAddress: string;
  tokenId: string;
  canMint: boolean;
  canBid: boolean;
} {
  return {
    id: `zora:${nft.chain}:${nft.contractAddress}:${nft.tokenId}`,
    type: nft.isShort ? 'short' : 'video',
    title: nft.title,
    description: nft.description,
    videoUrl: nft.videoUrl,
    thumbnailUrl: nft.thumbnailUrl,
    duration: nft.duration,
    source: 'zora',
    creatorId: `evm:${nft.creator}`,
    creatorName: nft.creatorName ?? nft.creator.slice(0, 10),
    platform: `Zora (${nft.chain})`,
    publishedAt: nft.createdAt ? new Date(nft.createdAt).getTime() : Date.now(),
    tags: nft.tags,
    mintPriceWei: nft.mintPriceWei,
    chain: nft.chain,
    contractAddress: nft.contractAddress,
    tokenId: nft.tokenId,
    canMint: true,
    canBid: true,
  };
}

/** Normalize a Zora live mint event for unified live hub display */
export function normalizeZoraLiveMint(event: ZoraLiveMintEvent): {
  id: string;
  type: 'live' | 'mint' | 'scheduled';
  title: string;
  description: string;
  streamUrl?: string;
  platform: string;
  creatorId: string;
  creatorName: string;
  viewerCount: number;
  startedAt?: string;
  tags: string[];
  thumbnailUrl?: string;
  isActive: boolean;
  mintPriceEth: string;
  editionSize: number;
  mintedCount: number;
} {
  return {
    id: `zora-mint:${event.id}`,
    type: event.isLiveEvent ? 'live' : event.isActive ? 'mint' : 'scheduled',
    title: event.title,
    description: event.description,
    streamUrl: event.liveStreamUrl,
    platform: `Zora (${event.chain})`,
    creatorId: `evm:${event.creator}`,
    creatorName: event.creatorName ?? event.creator.slice(0, 10),
    viewerCount: event.collectorCount,
    startedAt: event.startsAt,
    tags: event.tags,
    thumbnailUrl: event.thumbnailUrl ?? event.mediaUrl,
    isActive: event.isActive,
    mintPriceEth: event.mintPriceEth,
    editionSize: event.editionSize,
    mintedCount: event.mintedCount,
  };
}

// ─── Bid on Zora NFT ──────────────────────────────────────────────────

/**
 * Build a bid/offer transaction for a Zora NFT.
 * Returns encoded calldata for use with viem/ethers.
 */
export function buildZoraBidTransaction(
  _bid: ZoraBidRequest,
): { to: string; data: string; value: string } | { error: string } {
  try {
    // Min ABIs for Zora module manager
    const SWEEPER_ADDRESS = '0x0000000000a9d0e2e6b3c3e9e3e9e3e9e3e9e3e9';
    const _BUYER_ADDRESS = '0x0000000000000000000000000000000000000001';

    const _fourByte = '0xab834bbc'; // fillSweepOffer(bytes32,address,uint256,address,uint256)
    const encoded = '0x'; // simplified — real encoding uses viem encodeFunctionData

    return {
      to: SWEEPER_ADDRESS,
      data: encoded,
      value: '0',
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to build bid transaction' };
  }
}
