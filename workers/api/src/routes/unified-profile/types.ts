/**
 * @degenfeed/api-worker — Unified Profile Types
 */

import type { AggregatedProfile } from './badges';

export interface ProfileSearchResult {
  wallet?: string;
  protocol: string;
  id: string;
  handle: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  verified: boolean;
  verificationLevel?: string;
}

export interface ActivityResponse {
  events: Array<{
    type:
      | 'post'
      | 'tip'
      | 'follow'
      | 'coin_milestone'
      | 'repost'
      | 'mention'
      | 'dao_proposal'
      | 'stream_start'
      | 'badge_earned';
    protocol: string;
    description: string;
    target?: string;
    timestamp: number;
    highlight?: boolean;
  }>;
}

export interface ContentPerformanceResponse {
  topPosts: Array<{
    id: string;
    protocol: string;
    content: string;
    likes: number;
    reposts: number;
    replies: number;
    impressions: number;
    postedAt: string;
  }>;
  totalImpressions: number;
  totalEngagements: number;
}

export interface RevenueResponse {
  totalEarnings: number;
  tipsAmount: number;
  coinRevenue: number;
  subscriptionRevenue: number;
  perProtocol: Array<{
    protocol: string;
    amount: number;
  }>;
}

export type { AggregatedProfile };
