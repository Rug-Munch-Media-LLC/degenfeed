/**
 * Unified types for the DegenFeed open social graph client.
 * Every post, identity, and engagement action from any protocol
 * normalizes to these shapes. UI components consume only these.
 */

export type Protocol =
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'threads'
  | 'rss'
  | 'mastodon'
  | 'lemmy'
  | 'reddit'
  | 'ethereum'
  | 'ponder'
  | 'solana'
  | 'peertube'
  | 'youtube';

export interface UnifiedIdentity {
  /** Stable canonical identifier: `${protocol}:${id}` */
  id: string;
  /** Primary protocol+id (user's chosen canonical) */
  primary: { protocol: Protocol; id: string };
  /** Handles per protocol (null if not linked) */
  handles: Partial<Record<Protocol, string | null>>;
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
    threadsDid?: string;
    /** RSS source URL (e.g. blog feed URL) */
    rssUrl?: string;
  };
}

export interface Embed {
  kind: 'image' | 'video' | 'link' | 'frame' | 'quote' | 'code';
  url: string;
  /** Protocol-specific extra data */
  meta?: Record<string, unknown>;
}

export type EngagementAction =
  | 'like'
  | 'unlike'
  | 'repost'
  | 'unrepost'
  | 'bookmark'
  | 'unbookmark'
  | 'reply'
  | 'react';

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
  viewerBookmarked: boolean;
  /** Raw engagement counts at fetch time (for ranking delta calculation) */
  raw: EngagementMetrics;
}

/** Per-post ranking score breakdown exposed to the UI. */
export interface PostScore {
  total: number;
  recency: number;
  engagement: number;
  relevance: number;
  quality: number;
  diversity: number;
  source: number;
  velocity: number;
  /** Human-readable signals ("fresh", "viral", "on-topic", etc.) */
  reasons: string[];
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
  /** Optional ranking breakdown for transparency / hover signals. */
  /** Protocols this post was also found on (cross-post dedup). */
  crossPostedTo?: Protocol[];
  score?: PostScore;
  /** Optional paywall requirement for paid content */
  paywall?: { amount: string; recipient: string };
  /** Token gate for restricted content — only holders can view */
  tokenGate?: {
    type: 'erc20' | 'erc721' | 'erc1155';
    chain: 'ethereum' | 'base' | 'polygon' | 'solana' | 'arbitrum' | 'optimism';
    contractAddress: string;
    tokenId?: string;
    minBalance?: number;
    minBalanceDecimals?: number;
    /** Resolved symbol (set server-side when creating the post) */
    displaySymbol?: string;
    /** Resolved NFT name (set server-side when creating) */
    displayName?: string;
  };
  /** Number of tips received on this post */
  tipCount?: number;
  /** Content type: article, video, image, thread, link */
  contentType?: 'article' | 'video' | 'image' | 'thread' | 'link' | 'text';
  /** Freshness flags set server-side */
  isNew?: boolean;
  isHot?: boolean;
  isTrending?: boolean;
  /** Community context (lemmy, reddit, etc.) */
  community?: {
    name: string;
    title?: string;
    actorId?: string;
    icon?: string;
    instance?: string;
  };
  /** Universal df:// URI for cross-protocol addressing, sharing, and bookmarking */
  dfUri?: string;
  /** On-chain content permanence proof (Arweave/IPFS) */
  contentProof?: ContentProof;
}

export interface ContentProof {
  /** Arweave transaction ID (from Bundlr/Irys upload) */
  arweaveTxId?: string;
  /** IPFS content hash (CID) */
  ipfsCid?: string;
  /** SHA-256 hash of the content */
  contentHash: string;
  /** Unix timestamp of when the content was stored */
  timestamp: number;
  /** Whether the content is stored permanently */
  permanent: boolean;
  /** EVM transaction hash if anchored on-chain via contract */
  onChainTxHash?: string;
  /** Chain ID where the anchor tx was submitted (e.g. 8453 for Base) */
  onChainChainId?: number;
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

// ─── Audio Spaces ────────────────────────────────────────────────

export type SpaceStatus = 'live' | 'scheduled' | 'ended';

export interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  /** Whether the speaker's mic is currently live */
  speaking: boolean;
}

export interface SpaceReaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface Space {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  /** Protocol badge IDs: 'nostr', 'farcaster', 'lens', 'mastodon' */
  protocols: string[];
  status: SpaceStatus;
  /** Unix timestamp (ms) */
  createdAt: number;
  /** For scheduled spaces — ISO string */
  scheduledAt?: string;
  listeners: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  /** Token address for tipping (optional) */
  tipTokenAddress?: string;
  /** Whether the space supports tipping */
  tippingEnabled: boolean;
}
