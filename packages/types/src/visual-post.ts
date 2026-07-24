/**
 * VisualPost — normalized type for visual content across all platforms.
 * Every photo, video, NFT, and media post normalizes to this shape.
 */

import type { Embed, EngagementMetrics, EngagementVector, UnifiedIdentity } from './index';

export type VisualSource =
  | 'pixelfed'
  | 'zora'
  | 'bluesky'
  | 'nostr'
  | 'farcaster'
  | 'gotosocial'
  | 'mastodon';

export interface VisualPost {
  /** Canonical id: `${source}:${nativeId}` */
  id: string;
  /** Source platform */
  source: VisualSource;
  /** Original protocol this came from (for cross-protocol tracking) */
  protocol: string;
  /** Author with cross-platform identity */
  author: UnifiedIdentity;
  /** Title or caption text */
  text: string;
  /** Primary visual asset URL (image thumbnail or video poster) */
  imageUrl: string;
  /** Full-resolution or original asset URL */
  fullImageUrl?: string;
  /** Video URL if applicable */
  videoUrl?: string;
  /** Video duration in seconds */
  duration?: number;
  /** Embed data for rich media */
  embeds: Embed[];
  /** Blur hash for loading placeholder (base64) */
  blurHash?: string;
  /** Aspect ratio width/height for layout stability */
  aspectRatio: number;
  /** Media width in pixels */
  width?: number;
  /** Media height in pixels */
  height?: number;
  /** Whether this is an NFT (mintable) */
  isNFT: boolean;
  /** Zora-specific: token contract address */
  nftContract?: string;
  /** Zora-specific: token ID */
  nftTokenId?: string;
  /** Zora-specific: collection name */
  collectionName?: string;
  /** Zora-specific: creator address for minting */
  creatorAddress?: string;
  /** Content type for rendering */
  mediaType: 'image' | 'video' | 'gif' | 'nft_image' | 'nft_video';
  /** Unix ms */
  createdAt: number;
  /** Engagement metrics */
  metrics: EngagementMetrics;
  /** Viewer engagement state */
  engagement: EngagementVector;
  /** Source protocol badge info */
  sourceBadge: string;
  sourceColor: string;
  sourceLabel: string;
  /** Raw native object for round-trip */
  raw: unknown;
  /** Cross-platform tip URL */
  tipUrl?: string;
  /** Mint URL (Zora) */
  mintUrl?: string;
  /** Creator coin collect URL */
  collectUrl?: string;
  /** Original post URL (platform-native link) */
  url?: string;
  /** Protocol-specific extra data */
  meta?: Record<string, unknown>;
}

export interface VisualFeedOptions {
  /** Sources to include */
  sources: VisualSource[];
  /** Filter: all, photos, nfts, video, bluesky */
  filter?: 'all' | 'photos' | 'nfts' | 'video' | 'bluesky';
  /** Sort: newest, trending, top */
  sort?: 'newest' | 'trending' | 'top';
  /** Pagination cursor */
  cursor?: string;
  /** Results per page */
  limit: number;
  /** Personalization: followed creators only */
  followingOnly?: boolean;
  /** Creator filter (wallet addresses or DIDs) */
  creatorFilter?: string[];
}

export interface VisualFeedResponse {
  data: VisualPost[];
  nextCursor?: string;
  meta: {
    total: number;
    perSource: Record<string, number>;
    errors?: string[];
    fetchedAt: number;
  };
}
