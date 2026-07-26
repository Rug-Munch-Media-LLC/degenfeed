/** Type definitions for the video platform wrapper module. */

import type { UnifiedLiveStream } from '../../feed/live-aggregator';
import type { Env } from '../../index';

export type VideoSource =
  | 'farcaster'
  | 'zora'
  | 'lens'
  | 'nostr'
  | 'dtube'
  | 'odysee'
  | 'lbry'
  | 'rumble'
  | 'bittube'
  | 'youtube'
  | 'peertube'
  | 'twitch'
  | 'ipfs'
  | 'arweave'
  | 'direct';

export interface VideoQueryOptions {
  limit?: number;
  cursor?: string;
  category?: string;
  tags?: string[];
  search?: string;
  sort?: 'trending' | 'recent' | 'popular' | 'views';
  chain?: string;
  creator?: string;
  nsfw?: boolean;
}

export interface ShortsQueryOptions {
  limit?: number;
  cursor?: string;
  duration?: { min?: number; max?: number };
  creator?: string;
  tags?: string[];
}

export interface PlatformHealth {
  healthy: boolean;
  latencyMs: number;
  lastChecked: number;
  rateLimitRemaining?: number;
  version?: string;
  error?: string;
}

export interface UnifiedCreatorBrief {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;
  followerCount?: number;
  platformMeta?: Record<string, unknown>;
}

export interface UnifiedVideo {
  id: string;
  source: VideoSource;
  title: string;
  description: string;
  duration: number;
  thumbnailUrl: string;
  embedUrl?: string;
  videoUrl: string;
  hlsUrl?: string;
  views: number;
  likes: number;
  createdAt: number;
  creator: UnifiedCreatorBrief;
  category?: string;
  tags: string[];
  isLive: boolean;
  isShort: boolean;
  nsfw: boolean;
  platformMeta?: Record<string, unknown>;
  /** For Zora: mint/collect URL */
  collectUrl?: string;
  /** For token-gated content */
  tokenGated?: boolean;
  tokenAddress?: string;
  /** IPFS/Arweave CID if stored on-chain */
  contentHash?: string;
}

export interface AggregatedShort {
  id: string;
  source: VideoSource;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  creator: UnifiedCreatorBrief;
  views: number;
  likes: number;
  createdAt: number;
  tags: string[];
  /** Used for vertical/portrait shorts */
  isPortrait: boolean;
  platformMeta?: Record<string, unknown>;
}

export interface VideoPlatformWrapper {
  /** Human-readable platform name */
  name: string;
  /** Internal source identifier */
  source: VideoSource;
  /** Detect currently live streams on this platform */
  detectLiveStreams(env: Env): Promise<UnifiedLiveStream[]>;
  /** Fetch videos with query options */
  getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]>;
  /** Fetch short-form vertical videos */
  getShorts(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]>;
  /** Health check */
  healthCheck(env: Env): Promise<PlatformHealth>;
  /** Optional: search across platform */
  search?(env: Env, query: string, limit?: number): Promise<UnifiedVideo[]>;
  /** Optional: get creator's video catalog */
  getCreatorCatalog?(env: Env, creatorId: string, limit?: number): Promise<UnifiedVideo[]>;
}
