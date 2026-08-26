/**
 * @degenfeed/api-worker — Video Aggregator Types
 */

import type { VideoPlatform } from '../lib/creator-resolver';

export interface UnifiedVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  /** Embeddable player URL (if distinct from url) */
  embedUrl?: string;
  duration: number;
  platform: VideoPlatform;
  platformLabel: string;
  platformColor: string;
  creatorName: string;
  creatorId: string;
  creatorAvatar: string;
  creatorUrl: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  publishedMs: number;
  category: string;
  tags: string[];
  isShort: boolean;
  isLive: boolean;
  qualityScore: number;
}

export interface VideoAggregatorOptions {
  limit?: number;
  offset?: number;
  categories?: string[];
  platforms?: VideoPlatform[];
  minViews?: number;
  maxAgeDays?: number;
  sort?: 'recent' | 'trending' | 'popular';
}

export interface AggregatedFeed {
  videos: UnifiedVideo[];
  total: number;
  hasMore: boolean;
  sourceBreakdown: Record<string, number>;
  fetchedAt: number;
}

// ─── Instance Lists ──────────────────────────────────────

export const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://invidious.privacydev.net',
  'https://yewtu.be',
];

export const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';
