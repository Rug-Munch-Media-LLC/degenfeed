/**
 * @degenfeed/shorts-provider — Shared types
 *
 * Extracted from index.ts to break circular dependency with scorer.ts.
 */

export type ShortVideoSource =
  | 'peertube'
  | 'youtube'
  | 'vine'
  | 'zora'
  | 'loops'
  | 'tiktok'
  | 'instagram'
  | 'bluesky';

export interface ShortVideoItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  /** Duration in seconds */
  duration: number;
  authorName: string;
  authorAvatar?: string;
  views: number;
  likes: number;
  source: ShortVideoSource;
  sourceUrl: string;
  /** Detected topics (defi, nft, trading, etc.) */
  topics: string[];
  publishedAt: number;
  /** True if detected as vertical format */
  vertical: boolean;
  /** Quality signal 0-1 */
  qualityScore: number;
  /** Human-readable source label for UI badges */
  sourceLabel: string;
  /** Source badge color hex */
  sourceColor?: string;
  /** Whether DegenFeed tipping is available */
  canTip: boolean;
  /** Creator coin ticker if available */
  creatorCoinSymbol?: string;
  /** Creator coin contract address if available */
  creatorCoinAddress?: string;
}

export interface ShortsFeedResult {
  videos: ShortVideoItem[];
  sources: {
    peertube: number;
    youtube: number;
    tiktok: number;
    instagram: number;
    bluesky: number;
  };
  cursor: string | null;
  hasMore: boolean;
}

export interface FetchShortsOptions {
  /** Max videos to return (default 20) */
  limit?: number;
  /** Comma-separated topic filter */
  topics?: string[];
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}
