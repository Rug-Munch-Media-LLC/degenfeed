// === Spaces Types ===
// Expanded for ALL content types (Audio, Video, Photos, Announcements)

export type SpaceContentType = 'audio' | 'video' | 'photos' | 'announcement';

export type SpacePlatform =
  // Audio
  | 'nostr'
  | 'peertube'
  | 'owncast'
  | 'livepeer'
  // Social Announce
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'mastodon'
  | 'discord'
  | 'telegram'
  | 'twitter'
  // Live Video
  | 'youtube'
  | 'twitch'
  | 'kick'
  // Live Photos
  | 'nostr-pictures'
  | 'bluesky-photos'
  | 'pixelfed';

export interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
}

export interface SpaceReaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface SpacePlatformData {
  platform: SpacePlatform;
  nativeId: string;
  url?: string;
  streamUrl?: string;
  chatUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SpaceGating {
  type: 'token' | 'subscription' | 'payment' | 'none';
  tokenAddress?: string;
  minBalance?: string;
  chainId?: number;
  paymentAmount?: string;
  paymentToken?: string;
  subscriptionTier?: string;
}

export interface SpaceItem {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  /** Content type: audio | video | photos */
  contentType?: SpaceContentType;
  /** Legacy: protocol name strings */
  protocols?: string[];
  /** New: structured platform data */
  platforms?: SpacePlatformData[];
  status: 'live' | 'scheduled' | 'ended';
  createdAt: number;
  scheduledAt?: string;
  listeners: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  tipTokenAddress?: string;
  tippingEnabled: boolean;
  recordingUrl?: string;
  recordingReady?: boolean;
  endedAt?: number;
  /** Premium/gating config */
  gating?: SpaceGating;
  /** Tags for discoverability */
  tags?: string[];
  /** Thumbnail / cover image URL for video streams */
  thumbnailUrl?: string;
  /** Photo URLs for live photo content */
  photoUrls?: string[];
}
