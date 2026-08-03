/**
 * @degenfeed/degenchat — Redis channel names + chat event envelopes
 *
 * DegenChat relays messages between protocols through a Redis pub/sub hub.
 * Every cross-protocol event type has a dedicated channel so subscribers can
 * filter without inspecting every payload.
 *
 * Channel naming convention: `degenchat:<scope>:<event>`
 */

export const DEGENCHAT_CHANNELS = {
  /** A direct message was sent by a user (relay to all delivery protocols). */
  DM_SENT: 'degenchat:dm:sent',
  /** A direct message was received on a protocol and should fan out to the user. */
  DM_RECEIVED: 'degenchat:dm:received',
  /** A group message was sent to a cross-protocol room. */
  GROUP_SENT: 'degenchat:group:sent',
  /** A group message arrived on a bridged protocol. */
  GROUP_RECEIVED: 'degenchat:group:received',
  /** Read receipt update. */
  READ_RECEIPT: 'degenchat:read:receipt',
  /** Typing indicator. */
  TYPING: 'degenchat:typing',
  /** Presence update (online / offline / away). */
  PRESENCE: 'degenchat:presence',
  /** Protocol bridge health status change. */
  BRIDGE_STATUS: 'degenchat:bridge:status',
  /** Identity link map changed (npub ↔ fid ↔ did ↔ acct ↔ wallet). */
  IDENTITY_UPDATE: 'degenchat:identity:update',
} as const;

export type DegenChatChannel = (typeof DEGENCHAT_CHANNELS)[keyof typeof DEGENCHAT_CHANNELS];

export const DEGENCHAT_CHANNEL_LIST = Object.values(DEGENCHAT_CHANNELS) as DegenChatChannel[];

// ─── Event payloads ─────────────────────────────────────────────────────

export interface DegenChatDmPayload {
  messageId: string;
  conversationId: string;
  fromId: string;
  fromProtocol: string;
  toId: string;
  body: string;
  encrypted: boolean;
  contentType?: 'text' | 'image' | 'link' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  timestamp: number;
  /** Delivery targets chosen by the sender (defaults to all reachable protocols). */
  protocols: string[];
}

export interface DegenChatGroupPayload {
  messageId: string;
  roomId: string;
  fromId: string;
  fromProtocol: string;
  body: string;
  encrypted: boolean;
  contentType?: 'text' | 'image' | 'link' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  timestamp: number;
  /** Protocols the room bridges to. */
  protocols: string[];
}

export interface DegenChatReadReceiptPayload {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  protocol: string;
  timestamp: number;
}

export interface DegenChatTypingPayload {
  conversationId: string;
  userId: string;
  protocol: string;
  isTyping: boolean;
  timestamp: number;
}

export interface DegenChatPresencePayload {
  userId: string;
  status: 'online' | 'away' | 'offline';
  protocol: string;
  timestamp: number;
}

export interface DegenChatBridgeStatusPayload {
  protocol: string;
  healthy: boolean;
  latencyMs: number;
  timestamp: number;
}

export interface DegenChatIdentityPayload {
  walletAddress: string;
  /** Maps protocol name → protocol-specific id (npub, fid, did, acct). */
  links: Record<string, string>;
  timestamp: number;
}

/**
 * Wrapper envelope for messages on the hub. Every payload carries the
 * originating protocol so bridge adapters can echo back accurately.
 */
export interface DegenChatEnvelope<T = unknown> {
  version: 1;
  channel: DegenChatChannel;
  sourceProtocol: string;
  payload: T;
  publishedAt: number;
}
