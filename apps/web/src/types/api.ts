/**
 * @degenfeed/web — Shared API response types
 *
 * Standard wrapper for every API endpoint response.
 * All services use these as base types.
 */

/** Standard API envelope returned by every endpoint */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
  notices?: string[];
  meta?: Record<string, unknown>;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Standard loading state for any async operation */
export type LoadingState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

/** Standard async state container */
export interface AsyncState<T> {
  data: T | null;
  state: LoadingState;
  error: string | null;
}

/** Feed Tab type - shared between feed components */
export type FeedTab = 'for-you' | 'following' | 'trending' | 'news' | 'custom-mix';

/** Feed response metadata */
export interface FeedMeta {
  total?: number;
  limit?: number;
  perProtocol?: Record<string, number>;
  errors?: string[];
  notices?: string[];
  trending?: { topic: string; count: number; score: number }[];
  topOfHour?: string | null;
  fetchedAt?: number;
  personalization?: {
    hasProfile: boolean;
    boostApplied: boolean;
    isOnboarding: boolean;
    reasons?: string[];
  };
}

/** Protocol metadata for UI display */
export interface ProtocolMeta {
  label: string;
  color: string;
  emoji: string;
}

/** Protocol summary in feed */
export interface ProtocolSummary {
  id: string;
  label: string;
  color: string;
  count: number;
}

/** Feed filter preferences (persisted) */
export interface FeedPreferences {
  hideLowQuality: boolean;
  hideThreshold: number;
  allowNonCrypto: boolean;
  recencyWeight: number;
  engagementWeight: number;
  showOriginalContent: boolean;
  minEngagement: number;
  maxPerNiche: number;
  protocolFilter: string | null;
  freshnessPreference: number;
  creatorDiversity: number;
  exploreRatio: number;
}

/** Post interaction action */
export type PostAction = 'like' | 'recast' | 'reply' | 'bookmark' | 'share' | 'report';
