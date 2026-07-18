/**
 * @degenfeed/source-discovery — Shared types for discovered content sources.
 */

export type Platform = 'reddit' | 'youtube' | 'rss' | 'lemmy' | 'peertube' | 'newsletter';

export type DiscoveryStatus = 'pending' | 'approved' | 'rejected';

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
