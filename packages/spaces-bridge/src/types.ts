/**
 * @degenfeed/spaces-bridge — Shared types for cross-platform Spaces
 *
 * BROADCAST PLATFORMS (actual streaming destinations):
 *   nostr, peertube, owncast, livepeer, youtube, twitch, kick
 *
 * ANNOUNCEMENT PLATFORMS (social posts when space goes live):
 *   farcaster, lens, bluesky, mastodon, discord, telegram, twitter
 *
 * LIVE PHOTOS (ephemeral image content):
 *   nostr-pictures, bluesky-photos, pixelfed
 *
 * CONTENT TYPE:
 *   audio   → Voice-based spaces (Twitter Spaces clone)
 *   video   → Live video streams (YouTube Live, Twitch, etc.)
 *   photos  → Ephemeral photo sharing (stories-like)
 */

export type SpacePlatform =
  // ── Audio (existing) ──
  | 'nostr'
  | 'peertube'
  | 'owncast'
  | 'livepeer'
  // ── Social Announcement ──
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'mastodon'
  | 'discord'
  | 'telegram'
  | 'twitter'
  // ── Live Video ──
  | 'youtube'
  | 'twitch'
  | 'kick'
  // ── Live Photos ──
  | 'nostr-pictures'
  | 'bluesky-photos'
  | 'pixelfed';

export type SpaceContentType = 'audio' | 'video' | 'photos' | 'announcement';
export type SpaceStatus = 'live' | 'scheduled' | 'ended';

export type AnnouncePlatform =
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'mastodon'
  | 'discord'
  | 'telegram'
  | 'twitter';

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

export interface SpaceGating {
  type: 'token' | 'subscription' | 'payment' | 'none';
  /** Token address for token-gated spaces */
  tokenAddress?: string;
  /** Minimum token balance required */
  minBalance?: string;
  /** Chain ID for token gating */
  chainId?: number;
  /** Payment amount for x402 paid spaces (in wei) */
  paymentAmount?: string;
  /** Payment token address (ETH if empty) */
  paymentToken?: string;
  /** Subscription tier required */
  subscriptionTier?: string;
}

export interface SpacePlatformData {
  platform: SpacePlatform;
  /** Native ID on the platform */
  nativeId: string;
  /** Platform-specific URL */
  url?: string;
  /** RTMP/HLS/embed URL for audio/video */
  streamUrl?: string;
  /** Chat URL or channel */
  chatUrl?: string;
  /** Platform-specific metadata */
  metadata?: Record<string, unknown>;
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
  /** Platforms the space is broadcast on */
  platforms: SpacePlatformData[];
  status: SpaceStatus;
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
  /** Premium/gating configuration */
  gating?: SpaceGating;
  /** Whether current user can access (client-side check) */
  canAccess?: boolean;
  /** Tags for discoverability */
  tags?: string[];
  /** Thumbnail / cover image URL for video streams */
  thumbnailUrl?: string;
  /** Photo URLs for live photo content */
  photoUrls?: string[];
}

/** Unified create options accepted by all platforms */
export interface CreateSpaceOptions {
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts?: string[];
  platforms: SpacePlatform[];
  scheduledAt?: string;
  tippingEnabled?: boolean;
  tipTokenAddress?: string;
  gating?: SpaceGating;
  tags?: string[];
  /** Content type */
  contentType?: SpaceContentType;
  /** Photo URLs (for live photos content type) */
  photoUrls?: string[];
  /** PeerTube-specific: channel / token info */
  peertubeTokenAddress?: string;
  peertubeTokenSymbol?: string;
  peertubeCreatorAddress?: string;
  /** Owncast-specific: stream key override */
  owncastStreamKey?: string;
  /** YouTube-specific: API key, privacy */
  youTubePrivacy?: 'public' | 'unlisted' | 'private';
  /** Twitch-specific: game/category */
  twitchGame?: string;
  /** Kick-specific: category */
  kickCategory?: string;
}

export interface CreateSpaceResult {
  id: string;
  platformResults: Array<{
    platform: SpacePlatform;
    nativeId: string;
    url?: string;
    streamUrl?: string;
    chatUrl?: string;
    error?: string;
  }>;
}

/** Announcement content for social platforms */
export interface SpaceAnnouncement {
  text: string;
  spaceUrl: string;
  platform: AnnouncePlatform;
  /** Native-looking card data for rich embeds */
  embed?: {
    title: string;
    description?: string;
    hostName: string;
    imageUrl?: string;
    url: string;
  };
}

export interface PlatformBridge {
  platform: SpacePlatform;
  /** Create a space on this platform */
  create(options: CreateSpaceOptions): Promise<SpacePlatformData>;
  /** Get live spaces from this platform */
  getLiveSpaces(): Promise<SpaceItem[]>;
  /** Get a specific space */
  getSpace(nativeId: string): Promise<SpaceItem | null>;
  /** End a space */
  endSpace(space: SpaceItem): Promise<void>;
  /** Update space status (listener count, speakers) */
  updateSpace(space: SpaceItem): Promise<void>;
}

/** Bridge for announcement-only platforms */
export interface AnnounceBridge {
  platform: AnnouncePlatform;
  /** Post a space announcement */
  announce(
    space: SpaceItem,
    announcement: SpaceAnnouncement,
  ): Promise<{ ok: boolean; nativeId?: string; url?: string; error?: string }>;
}

export interface LiveKitTokenResponse {
  token: string;
  room: string;
  region: string;
}
