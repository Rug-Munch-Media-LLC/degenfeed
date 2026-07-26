/**
 * @degenfeed/api-worker — Live Aggregator Types
 *
 * Shared types for the unified live stream aggregation pipeline.
 */

export type LiveSource =
  | 'owncast'
  | 'peertube'
  | 'youtube'
  | 'twitch'
  | 'kick'
  | 'spaces'
  | 'degenfeed'
  | 'farcaster'
  | 'nostr'
  | 'lens'
  | 'zora';

export interface UnifiedIdentity {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;
  followers?: number;
}

export interface UnifiedLiveStream {
  id: string;
  source: LiveSource;
  title: string;
  streamer: UnifiedIdentity;
  thumbnailUrl: string;
  viewerCount: number;
  startedAt: number;
  category: string;
  tags: string[];
  isLive: boolean;
  embedUrl?: string;
  chatEnabled: boolean;
  platformMeta?: Record<string, unknown>;
  simulcastSources?: LiveSource[];
}

export interface UpcomingStream {
  id: string;
  source: LiveSource;
  title: string;
  streamer: UnifiedIdentity;
  thumbnailUrl: string;
  scheduledAt: number;
  category: string;
  tags: string[];
}

export interface SourceHealth {
  source: LiveSource;
  healthy: boolean;
  lastChecked: number;
  error?: string;
  rateLimitRemaining?: number;
  streamCount: number;
  latencyMs: number;
}

export interface StreamSchedule {
  id: string;
  creatorId: string;
  title: string;
  description?: string;
  source: LiveSource;
  scheduledAt: number;
  category: string;
  tags: string[];
  privacy: 'public' | 'unlisted' | 'private';
  recordingEnabled: boolean;
  chatEnabled: boolean;
  thumbnailUrl?: string;
  createdAt: number;
}

export interface GoLiveConfig {
  title: string;
  description?: string;
  category: string;
  tags: string[];
  privacy: 'public' | 'unlisted' | 'private';
  recordingEnabled: boolean;
  chatEnabled: boolean;
  platform: 'owncast' | 'peertube' | 'both';
  thumbnailUrl?: string;
  creatorId: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatarUrl?: string;
}

export interface GoLiveResult {
  streamKey: string;
  rtmpUrl: string;
  playbackUrl: string;
  embedUrl: string;
  streamId: string;
  platformMessages: Record<string, { ok: boolean; id?: string; url?: string; error?: string }>;
}
