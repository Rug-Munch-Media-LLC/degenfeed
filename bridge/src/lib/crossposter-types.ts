/**
 * Cross-poster shared types
 */

export type ProtocolName =
  | 'mastodon'
  | 'nostr'
  | 'bluesky'
  | 'peertube'
  | 'lemmy'
  | 'farcaster'
  | 'lens'
  | 'pixelfed'
  | 'writefreely';

export interface CrossPairConfig {
  /** Unique pair ID */
  id: string;
  /** Source protocol */
  source: ProtocolName;
  /** Target protocols */
  targets: ProtocolName[];
  /** Whether this pair is enabled */
  enabled: boolean;
  /** Polling interval in ms (default: 60000) */
  pollIntervalMs?: number;
  /** Rate limit: max posts per window */
  rateLimit?: {
    maxPosts: number;
    windowMs: number;
  };
  /** Source-specific connection info */
  sourceConfig: Record<string, string>;
  /** Per-target configuration */
  targetConfigs: Record<string, Record<string, string>>;
  /** Content filter (return false to skip) */
  contentFilter?: (post: import('../server/types').UnifiedPost) => boolean;
}

export interface TransformResult {
  /** Whether the transform succeeded */
  success: boolean;
  /** The content to publish (protocol-specific format) */
  payload?: unknown;
  /** Error message if failed */
  error?: string;
}

export interface PublishResult {
  success: boolean;
  target: ProtocolName;
  latencyMs: number;
  error?: string;
  retryable: boolean;
}

export interface PairStats {
  id: string;
  source: string;
  targets: string;
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  circuitState: 'closed' | 'open' | 'half-open';
  rateLimitRemaining: number;
  enabled: boolean;
}
