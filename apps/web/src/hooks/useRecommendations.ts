'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { fetchWithSwr } from '../lib/fetchWithCache';
import { getCsrfToken } from '../lib/csrf';

// ─── Types ────────────────────────────────────────────────────────────────

export type ContentSource = 'youtube' | 'peertube' | 'tiktok' | 'instagram' | 'twitch' | 'kick' | 'rumble' | 'odysee';

export type InteractionAction = 'watch' | 'like' | 'share' | 'skip' | 'complete' | 'tip';

export interface RecommendationContent {
  id: string;
  source: ContentSource;
  title: string;
  description?: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  thumbnailUrl?: string;
  url: string;
  duration: number;
  categories: string[];
  tags: string[];
  publishedAt: number;
  metrics: { views: number; likes: number; shares?: number; comments?: number };
  creatorQuality: number;
  isShort: boolean;
  isLive: boolean;
}

export interface RankedContent extends RecommendationContent {
  score: number;
  signals: {
    total: number;
    reasons: string[];
    [key: string]: number | string[];
  };
}

export interface RecommendationsResponse {
  data: RankedContent[];
  meta: {
    total: number;
    fetchedAt: number;
    wallet?: string;
    source?: string;
    contentId?: string;
    category?: string;
  };
}

interface InteractionPayload {
  contentId: string;
  action: InteractionAction;
  category?: string;
  tags?: string[];
  creatorId?: string;
  source?: ContentSource;
  dwellMs?: number;
  completionRate?: number;
  duration?: number;
}

// ─── SWR fetcher ──────────────────────────────────────────────────────────

async function recommendationsFetcher(url: string): Promise<RankedContent[]> {
  const result = await fetchWithSwr<RecommendationsResponse>(url, url);
  return result.data.data ?? [];
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Personalized video recommendations for the current user.
 */
export function useVideoRecommendations(opts?: {
  limit?: number;
  sources?: ContentSource[];
  categories?: string[];
  freshness?: 'day' | 'week' | 'month' | 'all';
}) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.sources?.length) params.set('sources', opts.sources.join(','));
  if (opts?.categories?.length) params.set('categories', opts.categories.join(','));
  if (opts?.freshness) params.set('freshness', opts.freshness);
  const qs = params.toString();

  return useSWR<RankedContent[]>(
    `/api/recommendations/videos${qs ? `?${qs}` : ''}`,
    recommendationsFetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 },
  );
}

/**
 * Personalized shorts recommendations.
 */
export function useShortsRecommendations(opts?: {
  limit?: number;
  categories?: string[];
}) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.categories?.length) params.set('categories', opts.categories.join(','));
  const qs = params.toString();

  return useSWR<RankedContent[]>(
    `/api/recommendations/shorts${qs ? `?${qs}` : ''}`,
    recommendationsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
}

/**
 * Live stream recommendations.
 */
export function useStreamRecommendations() {
  return useSWR<RankedContent[]>(
    '/api/recommendations/streams',
    recommendationsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
}

/**
 * "Because you watched" — related content to a specific video/short.
 */
export function useRelatedContent(source: ContentSource | null, contentId: string | null) {
  const shouldFetch = source && contentId;
  return useSWR<RankedContent[]>(
    shouldFetch ? `/api/recommendations/related?source=${source}&id=${contentId}` : null,
    recommendationsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );
}

/**
 * Personalized trending content.
 */
export function usePersonalizedTrending(category?: string) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  const qs = params.toString();

  return useSWR<RankedContent[]>(
    `/api/recommendations/trending${qs ? `?${qs}` : ''}`,
    recommendationsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );
}

/**
 * Discover new creators outside user's bubble.
 */
export function useDiscoverNew() {
  return useSWR<RankedContent[]>(
    '/api/recommendations/discover',
    recommendationsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );
}

// ─── Interaction recording ─────────────────────────────────────────────────

/**
 * Record a user interaction for future recommendation improvement.
 * Returns a callback that can be called directly.
 */
export function useRecordInteraction() {
  return useCallback(async (payload: InteractionPayload): Promise<boolean> => {
    try {
      const res = await fetch('/api/recommendations/interaction', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': getCsrfToken() ?? '',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);
}
