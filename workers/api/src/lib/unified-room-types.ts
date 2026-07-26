/**
 * @degenfeed/api-worker — Unified Room Types
 *
 * Shared types for the cross-protocol unified room system.
 */

export type RoomTransport = 'nostr' | 'matrix' | 'farcaster' | 'bluesky' | 'telegram' | 'web';

export interface RoomMember {
  id: string;
  displayName?: string;
  transport: RoomTransport;
  identity: {
    nostr?: { npub: string; pubkey: string; relays?: string[] };
    matrix?: { userId: string; homeserver: string };
    farcaster?: { fid: number; username?: string };
    bluesky?: { did: string; handle?: string };
    telegram?: { chatId: string; userId?: string };
  };
  role: 'admin' | 'member';
  joinedAt: number;
  lastActive: number;
}

export interface RoomTransportState {
  nostr: boolean;
  matrix: boolean;
  farcaster: boolean;
  bluesky: boolean;
  telegram: boolean;
}

export interface UnifiedRoom {
  id: string;
  name: string;
  description: string;
  creator: string;
  members: RoomMember[];
  transports: RoomTransportState;
  encryptedKey: string;
  keyVersion: number;
  createdAt: number;
  lastActivity: number;
  iconUrl?: string;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  fromId: string;
  fromName: string;
  content: string;
  encryptedContent: string;
  iv: string;
  keyVersion: number;
  createdAt: number;
  deliveryStatus: Record<string, MemberDeliveryStatus>;
  replyTo?: string;
  mentions?: string[];
  sourceTransport: RoomTransport;
}

export interface MemberDeliveryStatus {
  transport: RoomTransport;
  ok: boolean;
  nativeId?: string;
  error?: string;
  attemptedAt: number;
  deliveredAt?: number;
}

export interface MentionResolution {
  raw: string;
  memberId: string | null;
  displayName: string | null;
  resolvedVia: 'member-name' | 'npub' | 'fid' | 'bsky-handle' | 'wallet' | 'unknown';
}

export interface RoomInvite {
  id: string;
  roomId: string;
  fromId: string;
  target: string;
  resolvedMemberId?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  expiresAt: number;
}

export interface UnreadCount {
  roomId: string;
  count: number;
  lastMessagePreview?: string;
  lastMessageAt?: number;
}
