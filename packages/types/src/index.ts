/**
 * Unified types for the DegenFeed open social graph client.
 * Every post, identity, and engagement action from any protocol
 * normalizes to these shapes. UI components consume only these.
 */

export type Protocol = 'nostr' | 'farcaster' | 'lens' | 'bluesky';

export interface UnifiedIdentity {
  /** Stable canonical identifier: `${protocol}:${id}` */
  id: string;
  /** Primary protocol+id (user's chosen canonical) */
  primary: { protocol: Protocol; id: string };
  /** Handles per protocol (null if not linked) */
  handles: Record<Protocol, string | null>;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  verified: { protocol: Protocol; badge: string }[];
  followerCount: number;
  followingCount: number;
  links: { label: string; url: string }[];
  /** Raw protocol-specific identifiers */
  keys: {
    nostrPubkey?: string;
    fid?: number;
    lensProfileId?: string;
    did?: string;
    evmAddress?: string;
    solanaAddress?: string;
  };
}

export interface Embed {
  kind: 'image' | 'video' | 'link' | 'frame' | 'quote' | 'code';
  url: string;
  /** Protocol-specific extra data */
  meta?: Record<string, unknown>;
}

export interface EngagementMetrics {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  views?: number;
}

export interface EngagementVector {
  /** Per-protocol reaction ids from the current viewer (for UI state) */
  viewerLiked: boolean;
  viewerReposted: boolean;
  /** Raw engagement counts at fetch time (for ranking delta calculation) */
  raw: EngagementMetrics;
}

export interface UnifiedPost {
  /** Canonical id: `${protocol}:${nativeId}` */
  id: string;
  protocol: Protocol;
  /** Stable author reference */
  author: UnifiedIdentity;
  /** Plain text content */
  text: string;
  /** Protocol-specific rich HTML if present */
  html?: string;
  embeds: Embed[];
  /** Parent post id for replies */
  parentId?: string;
  /** Root post id for thread tracking */
  rootId?: string;
  /** Unix ms */
  createdAt: number;
  metrics: EngagementMetrics;
  engagement: EngagementVector;
  /** Protocol-native raw object for round-trips (signing, fetching replies) */
  raw: unknown;
  /** Niche tags derived from content (crypto, ai, oss, security, art, music) */
  niches: string[];
}

export interface NewPost {
  text: string;
  embeds?: Embed[];
  parentProtocol?: Protocol;
  parentNativeId?: string;
  /** Slash-command hints from compose */
  commands?: ('poll' | 'thread' | 'image' | 'link' | 'code')[];
}

export interface PublishResult {
  protocol: Protocol;
  ok: boolean;
  nativeId?: string;
  error?: string;
}

export interface FeedRequest {
  viewer?: UnifiedIdentity | null;
  cursor?: string;
  limit?: number;
  filter?: 'all' | 'following' | 'foryou' | 'trending';
  niches?: string[];
}

export interface FeedResponse {
  posts: UnifiedPost[];
  nextCursor?: string;
}

export interface IdentityLink {
  from: { protocol: Protocol; id: string };
  to: { protocol: Protocol; id: string };
  /** Source of the link (NIP-05, profile bio, manual, etc.) */
  source: string;
  /** Confidence score 0-1 */
  confidence: number;
}