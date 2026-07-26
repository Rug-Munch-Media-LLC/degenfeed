/**
 * @degenfeed/api-worker — Universal Inbox Types
 *
 * Type definitions for the unified cross-protocol inbox system.
 */

import type { Protocol } from '@degenfeed/types';

export type InboxItemKind =
  | 'dm'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'like'
  | 'repost'
  | 'follow'
  | 'tip';

export interface InboxActor {
  id: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  protocol: Protocol;
}

export interface InboxItem {
  /** Canonical ID: `${protocol}:${kind}:${nativeId}` */
  id: string;
  kind: InboxItemKind;
  protocol: Protocol;
  actor: InboxActor;
  /** Plain text content of the message/comment/notification */
  content: string;
  /** Rich HTML if available */
  html?: string;
  /** Unix ms timestamp */
  createdAt: number;
  /** Whether the item has been read */
  read: boolean;
  /** Whether the item has been seen (viewed in feed) */
  seen: boolean;
  /** For replies/comments: the parent post/comment reference */
  parentId?: string;
  /** For replies/comments: the parent protocol */
  parentProtocol?: Protocol;
  /** For replies/comments: the root post reference */
  rootId?: string;
  /** For DMs: the conversation ID */
  conversationId?: string;
  /** For DMs: list of participants (wallet addresses) */
  participants?: string[];
  /** For DMs: the recipient protocol-native ID */
  recipientId?: string;
  /** For tips: amount and currency */
  amount?: string;
  currency?: string;
  /** URL to the original post/comment */
  url?: string;
  /** Protocol-specific native ID for round-trip operations */
  nativeId?: string;
  /** Per-protocol auth/identity needed for reply operations */
  replyAuth?: Record<string, string>;
}

export interface InboxFeed {
  items: InboxItem[];
  meta: {
    total: number;
    unread: number;
    byKind: Partial<Record<InboxItemKind, number>>;
    byProtocol: Partial<Record<Protocol, number>>;
    nextCursor?: string;
    fetchedAt: number;
  };
}

export interface InboxReplyRequest {
  /** The inbox item ID to reply to (e.g. "mastodon:reply:12345") */
  parentInboxId: string;
  /** The reply text content */
  content: string;
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
  /** Pre-signed event for client-side signing protocols (Nostr, Farcaster, Lens) */
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
}

export interface InboxShareRequest {
  /** Content source URI (df:// or raw) */
  sourceUri: string;
  /** Source protocol */
  sourceProtocol: Protocol;
  /** Target protocols to share to */
  targetProtocols: Protocol[];
  /** Optional custom text override */
  text?: string;
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
}

export interface NetworkStatus {
  connected: boolean;
  handle?: string;
  displayName?: string;
  avatarUrl?: string;
  capabilities: NetworkCapability[];
  lastVerified: number;
  error?: string;
}

export type NetworkCapability =
  | 'post'
  | 'dm'
  | 'reply'
  | 'comment'
  | 'like'
  | 'repost'
  | 'follow'
  | 'upload-media'
  | 'live-stream'
  | 'tip';

export interface UserNetworkStatus {
  protocols: Partial<Record<Protocol, NetworkStatus>>;
  totalConnected: number;
  totalAvailable: number;
  checkedAt: number;
}

export interface InboxReadRequest {
  /** Array of item IDs to mark as read */
  itemIds: string[];
}

export interface CrossNetworkShareResult {
  protocol: Protocol;
  ok: boolean;
  nativeId?: string;
  url?: string;
  error?: string;
}

export interface ActivityFeedItem {
  id: string;
  /** Human-readable activity description */
  summary: string;
  /** The kind of activity */
  kind: InboxItemKind;
  /** Source protocol */
  sourceProtocol: Protocol;
  /** Target/destination protocol (for cross-protocol activity) */
  targetProtocol?: Protocol;
  actor: InboxActor;
  /** Target actor (the user being interacted with) */
  targetActor?: InboxActor;
  content: string;
  /** URL to the original content */
  url?: string;
  createdAt: number;
}
