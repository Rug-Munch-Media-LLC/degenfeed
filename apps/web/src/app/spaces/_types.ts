// === Spaces Types ===
// Extended for cross-platform support

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
  platform: 'nostr' | 'peertube' | 'owncast' | 'livepeer';
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
}
