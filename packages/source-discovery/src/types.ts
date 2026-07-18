/**
 * @degenfeed/source-discovery — Shared types for discovered content sources.
 */

export type Platform = 'reddit' | 'youtube' | 'rss' | 'lemmy' | 'peertube' | 'newsletter' | 'kbin' | 'tildes';

export type DiscoveryStatus = 'pending' | 'approved' | 'rejected';
export type SourceLifecycle = 'active' | 'stale' | 'dormant' | 'culled';

export interface DiscoveredSource {
  /** Unique identifier (platform + external ID) */
  id: string;
  /** Platform the source belongs to */
  platform: Platform;
  /** Human-readable name */
  name: string;
  /** URL to access the source */
  url: string;
  /** Icon/image URL if available */
  iconUrl?: string;
  /** Short description */
  description?: string;
  /** Quality score 0.0–1.0 */
  score: number;
  /** Subscriber/follower/member count (for ranking) */
  subscriberCount: number;
  /** Posts per week estimate */
  weeklyActivity: number;
  /** When the source was first seen */
  discoveredAt: number;
  /** Whether it was auto-approved by quality heuristics */
  autoApproved: boolean;
  /** Current review status */
  status: DiscoveryStatus;
  /** Estimated content relevance to crypto/tech (0.0–1.0) */
  relevanceScore: number;
  /** When the source was created on its platform (if known) */
  sourceCreatedAt?: number;
  /** Platform-specific metadata */
  metadata?: Record<string, unknown>;
  /** Current lifecycle state (default: active) */
  lifecycle?: SourceLifecycle;
  /** When lifecycle was last evaluated */
  lifecycleCheckedAt?: number;
}

/**
 * Source health tracking — per-source metrics for quality scoring.
 * Stored per source to monitor engagement, frequency, and spam risk.
 */
export interface SourceHealth {
  sourceId: string;
  platform: Platform;
  lastPostAt: number;
  /** Average posts per week over the trailing window */
  postFrequency: number;
  /** Engagement score 0.0–1.0 (likes, comments, shares) */
  engagementScore: number;
  /** Content relevance score 0.0–1.0 */
  relevanceScore: number;
  /** Spam score 0.0–1.0 (higher = more spam signals) */
  spamScore: number;
  /** Composite health score 0.0–1.0 */
  compositeScore: number;
  /** When health was last evaluated */
  lastCheckedAt: number;
  /** Number of times spam has been flagged */
  spamFlagCount: number;
  /** Running 30-day engagement total */
  engagement30d: number;
  /** Running 30-day post count */
  postCount30d: number;
}

/**
 * Trending source — sources with surging engagement.
 */
export interface TrendingSource {
  sourceId: string;
  name: string;
  platform: Platform;
  /** Engagement velocity (engagement/day in window) */
  engagementVelocity: number;
  /** Posting velocity (posts/day in window) */
  postVelocity: number;
  /** Trending score 0.0–1.0 */
  trendingScore: number;
  /** Baseline engagement rate for comparison */
  baselineRate: number;
  /** Time window start */
  windowStart: number;
  /** Time window end */
  windowEnd: number;
}

/**
 * Record of a single discovery run.
 */
export interface DiscoveryRun {
  runId: string;
  startedAt: number;
  completedAt: number;
  platform: Platform | 'all';
  sourcesDiscovered: number;
  autoApproved: number;
  pendingReview: number;
  /** IDs of all sources found */
  sourceIds: string[];
  /** If the run errored */
  error?: string;
}

/**
 * Discovery engine stats.
 */
export interface DiscoveryStats {
  totalRuns: number;
  totalDiscovered: number;
  totalApproved: number;
  totalRejected: number;
  totalCulled: number;
  pendingCount: number;
  activeSources: number;
  staleSources: number;
  newThisWeek: number;
  lastRunAt: number | null;
  lastRunDuration: number | null;
  perPlatform: Record<string, {
    discovered: number;
    approved: number;
    pending: number;
  }>;
}

export interface DiscoveryConfig {
  /** Minimum quality score for auto-approval (default 0.7) */
  autoApproveThreshold: number;
  /** Min subscriber count to consider (default 100) */
  minSubscribers: number;
  /** Min weekly posts to consider active (default 1) */
  minWeeklyActivity: number;
  /** Source must be older than this many days (default 30) */
  minAgeDays: number;
  /** Minimum crypto/tech relevance score (default 0.6) */
  minRelevanceScore: number;
  /** Known spam/scam patterns to reject */
  blocklistPatterns: RegExp[];
}

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  autoApproveThreshold: 0.7,
  minSubscribers: 100,
  minWeeklyActivity: 1,
  minAgeDays: 30,
  minRelevanceScore: 0.6,
  blocklistPatterns: [
    /(^|[^a-z])spam/i,
    /(^|[^a-z])scam/i,
    /(^|[^a-z])pump.?and.?dump/i,
    /(^|[^a-z])ponzi/i,
    /(^|[^a-z])mlm/i,
    /(^|[^a-z])pyramid/i,
  ],
};

export const CRYPTO_KEYWORDS = [
  'crypto',
  'cryptocurrency',
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'solana',
  'sol',
  'defi',
  'web3',
  'nft',
  'blockchain',
  'trading',
  'token',
  'altcoin',
  'mining',
  'staking',
  'layer2',
  'l2',
  'dex',
  'dao',
  'metaverse',
  'wallet',
  'airdrop',
  'yield',
];

export const SEARCH_KEYWORDS = [
  'crypto',
  'defi',
  'web3',
  'bitcoin',
  'ethereum',
  'solana',
  'blockchain',
  'nft',
  'trading',
  'cryptocurrency',
];
