/** Type definitions for the video platform wrapper module. */

import type { UnifiedLiveStream } from '../../feed/live-aggregator';
import type { Env } from '../../index';

export type VideoSource =
  | 'farcaster' | 'zora' | 'lens' | 'nostr' | 'dtube' | 'odysee'
  | 'lbry' | 'rumble' | 'bittube' | 'youtube' | 'peertube'
  | 'twitch' | 'ipfs' | 'arweave' | 'direct';

export interface VideoQueryOptions {
  limit?: number; cursor?: string; category?: string; tags?: string[];
  search?: string; sort?: 'trending' | 'recent' | 'popular' | 'views';
  chain?: string; creator?: string; nsfw?: boolean;
}

export interface ShortsQueryOptions {
  limit?: number; cursor?: string; duration?: { min?: number; max?: number };
  creator?: string; tags?: string[];
}

export interface PlatformHealth {
  healthy: boolean; latencyMs: number; lastChecked: number;
  rateLimitRemaining?: number; version?: string; error?: string;
}

export interface UnifiedVideo {
  id: string; source: VideoSource; title: string; description: string;
  duration: number; thumbnailUrl: string; embedUrl?: string; videoUrl: string;
  views: number; likes: number; creatorId: string; creatorName: string;
  creatorAvatarUrl?: string; tags: string[]; categories: string[];
  nsfw: boolean; createdAt: number; chain?: string; tokenId?: string;
  sourceUrl?: string;
}

export interface UnifiedCreatorBrief {
  id: string; source: VideoSource; name: string; displayName: string;
  avatarUrl?: string; followerCount: number; videoCount: number;
  totalViews: number; sourceUrl?: string;
}

export interface AggregatedShort {
  id: string; source: VideoSource; title: string; description: string;
  duration: number; thumbnailUrl: string; videoUrl: string;
  views: number; likes: number; creatorId: string; creatorName: string;
  creatorAvatarUrl?: string; tags: string[]; createdAt: number;
  sourceUrl?: string;
}

export interface VideoPlatformWrapper {
  source: VideoSource;
  /** Fetch videos from this platform */
  getVideos(env: Env, options: VideoQueryOptions): Promise<UnifiedVideo[]>;
  /** Fetch shorts/reels from this platform */
  getShorts?(env: Env, options: ShortsQueryOptions): Promise<AggregatedShort[]>;
  /** Detect currently active live streams */
  detectLiveStreams?(env: Env): Promise<UnifiedLiveStream[]>;
  /** Run a health check on the platform API */
  healthCheck?(env: Env): Promise<PlatformHealth>;
}
