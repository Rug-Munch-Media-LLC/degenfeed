/**
 * @degenfeed/web — Feed API Service
 *
 * Centralized feed-related API calls.
 */

import type { ApiResponse, FeedPreferences } from '../types/api';
import { api } from './api';

// ─── Types ────────────────────────────────────────────────────

export interface FeedParams {
  tab: string;
  cursor?: string;
  limit?: number;
  protocolFilter?: string | null;
  hideLowQuality?: boolean;
  hideThreshold?: number;
  minEngagement?: number;
  freshnessPreference?: number;
  creatorDiversity?: number;
  exploreRatio?: number;
  recencyWeight?: number;
  engagementWeight?: number;
}

export interface FeedResponse<T> {
  data: T[];
  meta: {
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
  };
  cursor?: string;
}

export interface PostEngagementResult {
  success: boolean;
  action: string;
  postId: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

// ─── Feed Data ────────────────────────────────────────────────

/** Fetch feed posts for a given tab with filters */
export async function fetchFeedPosts(
  params: FeedParams,
): Promise<ApiResponse<FeedResponse<unknown>>> {
  const query = new URLSearchParams();
  query.set('tab', params.tab);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.protocolFilter) query.set('protocol', params.protocolFilter);
  if (params.hideLowQuality !== undefined)
    query.set('hideLowQuality', String(params.hideLowQuality));
  if (params.hideThreshold !== undefined) query.set('hideThreshold', String(params.hideThreshold));
  if (params.minEngagement !== undefined) query.set('minEngagement', String(params.minEngagement));
  if (params.freshnessPreference !== undefined)
    query.set('freshness', String(params.freshnessPreference));
  if (params.creatorDiversity !== undefined)
    query.set('diversity', String(params.creatorDiversity));
  if (params.exploreRatio !== undefined) query.set('exploreRatio', String(params.exploreRatio));

  return api.get<FeedResponse<unknown>>(`/api/feed/home?${query.toString()}`);
}

/** Fetch a single post by ID */
export async function fetchPostById(postId: string): Promise<ApiResponse<unknown>> {
  return api.get<unknown>(`/api/feed/post/${encodeURIComponent(postId)}`);
}

/** Fetch thread for a post */
export async function fetchThread(uri: string, limit = 50): Promise<ApiResponse<unknown[]>> {
  return api.get<unknown[]>(`/api/thread/${encodeURIComponent(uri)}?limit=${limit}`);
}

/** Fetch replies for a post */
export async function fetchReplies(postId: string, limit = 20): Promise<ApiResponse<unknown[]>> {
  return api.get<unknown[]>(`/api/feed/post/${encodeURIComponent(postId)}/replies?limit=${limit}`);
}

// ─── Feed Interactions ────────────────────────────────────────

/** Like/unlike a post */
export async function likePost(postId: string): Promise<ApiResponse<PostEngagementResult>> {
  return api.post<PostEngagementResult>(`/api/feed/post/${encodeURIComponent(postId)}/like`);
}

/** Bookmark a post */
export async function bookmarkPost(postId: string): Promise<ApiResponse<PostEngagementResult>> {
  return api.post<PostEngagementResult>(`/api/feed/post/${encodeURIComponent(postId)}/bookmark`);
}

/** Report a post */
export async function reportPost(
  postId: string,
  reason: string,
): Promise<ApiResponse<{ reportId: string }>> {
  return api.post<{ reportId: string }>('/api/moderation/report', { postId, reason });
}

/** Publish new content */
export async function publishContent(
  content: Record<string, unknown>,
): Promise<ApiResponse<PublishResult>> {
  return api.post<PublishResult>('/api/publish', content);
}

// ─── Preferences ──────────────────────────────────────────────

/** Load feed filter preferences */
export async function loadPreferences(): Promise<ApiResponse<FeedPreferences>> {
  return api.get<FeedPreferences>('/api/preferences');
}

/** Save feed filter preferences */
export async function savePreferences(prefs: Partial<FeedPreferences>): Promise<ApiResponse<void>> {
  return api.put<void>('/api/preferences', prefs);
}

// ─── Cross-Platform Actions ───────────────────────────────────

/** Cross-post a reply */
export async function crossReply(
  content: string,
  parentId: string,
  sources: string[],
): Promise<ApiResponse<unknown>> {
  return api.post<unknown>('/api/cross-reply', { content, parentId, sources });
}
