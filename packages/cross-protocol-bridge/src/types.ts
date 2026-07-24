/**
 * @degenfeed/cross-protocol-bridge — Types
 *
 * Core types for the unified cross-protocol bridge.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

// ─── Bridge Paths ────────────────────────────────────────────────────────

/** A directional bridge from source protocol to target protocol */
export interface BridgePath {
  /** Unique path ID e.g. "activitypub→nostr" */
  id: string;
  /** Source protocol */
  source: Protocol;
  /** Target protocol */
  target: Protocol;
  /** Human-readable label */
  label: string;
  /** Whether this bridge path is enabled */
  enabled: boolean;
  /** Adapter module name implementing this path */
  adapter: string;
}

/** Registry of all known bridge paths */
export const BRIDGE_PATHS: BridgePath[] = [
  {
    id: 'activitypub→atproto',
    source: 'mastodon',
    target: 'bluesky',
    label: 'ActivityPub → AT Protocol (via Bridgy Fed)',
    enabled: true,
    adapter: 'activitypub-to-atproto',
  },
  {
    id: 'activitypub→nostr',
    source: 'mastodon',
    target: 'nostr',
    label: 'ActivityPub → Nostr (via Mostr or custom)',
    enabled: true,
    adapter: 'activitypub-to-nostr',
  },
  {
    id: 'atproto→nostr',
    source: 'bluesky',
    target: 'nostr',
    label: 'AT Protocol → Nostr',
    enabled: true,
    adapter: 'atproto-to-nostr',
  },
  {
    id: 'nostr→farcaster',
    source: 'nostr',
    target: 'farcaster',
    label: 'Nostr → Farcaster',
    enabled: true,
    adapter: 'nostr-to-farcaster',
  },
  {
    id: 'rss→activitypub',
    source: 'rss',
    target: 'mastodon',
    label: 'RSS → ActivityPub',
    enabled: true,
    adapter: 'rss-to-activitypub',
  },
];

// ─── Circuit Breaker ─────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Failure threshold before opening */
  failureThreshold: number;
  /** Timeout (ms) before trying half-open */
  resetTimeoutMs: number;
  /** Half-open max requests before deciding */
  halfOpenMaxRequests: number;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxRequests: 3,
};

export interface CircuitBreakerState {
  pathId: string;
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
  halfOpenAttempts: number;
}

// ─── Bridge Results ──────────────────────────────────────────────────────

export interface BridgeResult {
  /** Whether the bridge operation succeeded */
  success: boolean;
  /** The bridge path used */
  pathId: string;
  /** Source protocol */
  sourceProtocol: Protocol;
  /** Target protocol */
  targetProtocol: Protocol;
  /** Latency in ms */
  latencyMs: number;
  /** Error message if failed */
  error?: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Target-specific result */
  targetResult?: Record<string, unknown>;
}

export interface BridgeBatchResult {
  results: BridgeResult[];
  totalSuccess: number;
  totalFailure: number;
  totalLatencyMs: number;
}

// ─── Health ──────────────────────────────────────────────────────────────

export interface BridgeHealth {
  pathId: string;
  healthy: boolean;
  state: CircuitState;
  uptimeMs: number;
  lastCheckedAt: number;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  successRate: number;
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  avgLatencyMs: number;
}

// ─── Normalization ───────────────────────────────────────────────────────

export interface NormalizedContent {
  /** Plain text content */
  text: string;
  /** Rich HTML if available */
  html?: string;
  /** Extracted hashtags (normalized to lowercase without #) */
  hashtags: string[];
  /** Extracted @mentions (protocol:handle pairs) */
  mentions: NormalizedMention[];
  /** Embedded media */
  media: NormalizedMedia[];
  /** Embedded links */
  links: string[];
  /** Source protocol context */
  sourceProtocol: Protocol;
  /** Original post reference */
  originalPost?: UnifiedPost;
}

export interface NormalizedMention {
  /** Raw mention text (e.g. @user@instance.com, npub1..., did:plc:...) */
  raw: string;
  /** Resolved protocol */
  protocol: Protocol;
  /** Resolved identity ID */
  id: string;
  /** Display handle */
  handle: string;
}

export interface NormalizedMedia {
  kind: 'image' | 'video' | 'audio' | 'gif';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  /** Protocol-specific metadata */
  meta?: Record<string, unknown>;
}

// ─── Identity Linking ────────────────────────────────────────────────────

export interface LinkedIdentity {
  /** The user's canonical DegenFeed ID */
  dfId: string;
  /** Wallet address (primary key) */
  walletAddress: string;
  /** Display name */
  displayName: string;
  /** All linked protocol identities */
  protocols: LinkedProtocolIdentity[];
  /** When the first identity was linked */
  linkedAt: number;
  /** When the linking was last verified */
  lastVerified: number;
}

export interface LinkedProtocolIdentity {
  protocol: Protocol;
  /** Protocol-native ID (pubkey, fid, DID, etc.) */
  id: string;
  /** Display handle on this protocol */
  handle: string;
  /** Display name on this protocol */
  displayName?: string;
  /** Avatar URL on this protocol */
  avatarUrl?: string;
  /** Whether this link is verified */
  verified: boolean;
  /** Verification method */
  verificationMethod: 'signature' | 'biography' | 'nip05' | 'manual' | 'oauth';
  /** When this identity was linked */
  linkedAt: number;
}

export interface CrossPostRecord {
  /** The original post's canonical ID */
  postId: string;
  /** Original protocol */
  sourceProtocol: Protocol;
  /** Author's DegenFeed ID */
  dfId: string;
  /** When the original was posted */
  postedAt: number;
  /** All bridged copies */
  copies: CrossPostCopy[];
  /** Text content (normalized) */
  text: string;
  /** Media attachments */
  media: NormalizedMedia[];
  /** Hashtags used */
  hashtags: string[];
  /** Whether the original has been deleted */
  deleted: boolean;
}

export interface CrossPostCopy {
  protocol: Protocol;
  /** Protocol-native post ID */
  nativeId: string;
  /** URL to the bridged copy */
  url?: string;
  /** When it was bridged */
  bridgedAt: number;
  /** Whether the copy is still live */
  active: boolean;
  /** Engagement metrics on this copy */
  metrics?: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  };
}

// ─── Notifications ───────────────────────────────────────────────────────

export interface UnifiedNotification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention' | 'quote' | 'bridge' | 'zap';
  /** The protocol this notification originates from */
  protocol: Protocol;
  /** The actor who triggered the notification */
  actor: {
    displayName: string;
    handle?: string;
    avatarUrl?: string;
    protocol: Protocol;
    id?: string;
  };
  /** Brief notification text */
  content: string;
  /** When the notification was created (unix ms) */
  createdAt: number;
  /** Whether it has been read */
  read: boolean;
  /** Related post ID, if applicable */
  postId?: string;
  /** Related post text preview */
  postText?: string;
  /** Cross-protocol context: which bridge path triggered this */
  bridgePath?: string;
  /** Tip-specific: amount and currency */
  amount?: string;
  currency?: string;
}

export interface UnifiedNotificationFeed {
  notifications: UnifiedNotification[];
  meta: {
    total: number;
    unread: number;
    protocols: Protocol[];
    fetchedAt: number;
  };
}

// ─── Search ──────────────────────────────────────────────────────────────

export interface CrossProtocolSearchResult {
  /** Canonical post ID */
  id: string;
  /** Protocol this result was found on */
  protocol: Protocol;
  /** Post content */
  text: string;
  /** Author info */
  author: {
    displayName: string;
    handle?: string;
    avatarUrl?: string;
    id: string;
    /** All linked handles for cross-protocol identity */
    linkedHandles?: Partial<Record<Protocol, string>>;
  };
  /** When it was created */
  createdAt: number;
  /** Engagement metrics */
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  };
  /** Content niches */
  niches: string[];
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** URL to original post */
  url?: string;
  /** Media attachments */
  media?: NormalizedMedia[];
  /** Cross-post markers */
  crossPostedTo?: Protocol[];
}

export interface CrossProtocolSearchResponse {
  results: CrossProtocolSearchResult[];
  meta: {
    query: string;
    totalResults: number;
    byProtocol: Partial<Record<Protocol, number>>;
    page: number;
    limit: number;
    latencyMs: number;
    sources: Protocol[];
  };
  /** Identity matches (people matching the query) */
  identityResults?: CrossProtocolSearchResult[];
}

// ─── Configuration ───────────────────────────────────────────────────────

export interface BridgeConfig {
  /** Enable/disable all bridging */
  enabled: boolean;
  /** Circuit breaker configuration by path ID */
  circuitBreakers: Partial<Record<string, CircuitBreakerConfig>>;
  /** Per-path enable/disable overrides */
  enabledPaths: Partial<Record<string, boolean>>;
  /** Health check interval in ms (default: 30_000) */
  healthCheckIntervalMs: number;
  /** Max retries per bridge operation */
  maxRetries: number;
  /** Timeout per bridge operation in ms */
  operationTimeoutMs: number;
}

export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  enabled: true,
  circuitBreakers: {},
  enabledPaths: {},
  healthCheckIntervalMs: 30_000,
  maxRetries: 3,
  operationTimeoutMs: 15_000,
};

// ─── Adapter Interface ───────────────────────────────────────────────────

/**
 * Every bridge adapter must implement this interface.
 * Adapters handle protocol-specific serialization/deserialization.
 */
export interface BridgeAdapter {
  /** Unique adapter ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Source protocol */
  source: Protocol;
  /** Target protocol */
  target: Protocol;
  /** Transform content from source to target format */
  transform(
    content: NormalizedContent,
  ): Promise<{ success: true; payload: unknown } | { success: false; error: string }>;
  /** Publish transformed content to target protocol */
  publish(payload: unknown, config?: Record<string, string>): Promise<{
    success: true;
    nativeId: string;
    url?: string;
  } | { success: false; error: string; retryable: boolean }>;
  /** Verify that the target connection is healthy */
  healthCheck(): Promise<boolean>;
}
