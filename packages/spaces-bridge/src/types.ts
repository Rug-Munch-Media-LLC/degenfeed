/**
 * @degenfeed/spaces-bridge — Shared types for cross-platform Spaces
 */

export type SpacePlatform = 'nostr' | 'peertube' | 'owncast' | 'livepeer';
export type SpaceStatus = 'live' | 'scheduled' | 'ended';

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
  /** RTMP/HLS/embed URL for audio */
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
  /** PeerTube-specific: channel / token info */
  peertubeTokenAddress?: string;
  peertubeTokenSymbol?: string;
  peertubeCreatorAddress?: string;
  /** Owncast-specific: stream key override */
  owncastStreamKey?: string;
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

export interface LiveKitTokenResponse {
  token: string;
  room: string;
  region: string;
}
