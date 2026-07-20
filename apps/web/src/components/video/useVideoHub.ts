'use client';

/**
 * @degenfeed/web — useVideoHub hook
 *
 * SWR-style hooks for the video hub API.
 * Provides typed data fetching for the Netflix-style video browsing experience.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// === Types matching the API responses ====================================

export interface CreatorPlatform {
  platform: 'youtube' | 'twitch' | 'rumble' | 'peertube' | 'zora';
  handle: string;
  url: string;
  followerCount: number;
  subscriberCount?: number;
  videoCount?: number;
  nftCount?: number;
  lastActive?: string;
}

export interface UnifiedVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  embedUrl?: string;
  duration: number;
  durationLabel: string;
  source: 'youtube' | 'twitch' | 'rumble' | 'peertube' | 'zora' | 'shorts' | 'livestream' | 'creator';
  sourceLabel: string;
  sourceColor: string;
  channelName: string;
  channelId: string;
  channelUrl?: string;
  channelAvatar?: string;
  publishedAt: number;
  publishedLabel: string;
  views: number;
  category: string;
  subCategory?: string;
  tags: string[];
  isLive: boolean;
  language?: string;
  /** Aggregator: which platforms this creator is active on */
  creatorPlatforms?: CreatorPlatform[];
  /** Aggregator: raw engagement breakdown */
  aggregatorEngagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface VideoCategory {
  id: string;
  label: string;
  icon: string;
  color?: string;
  subCategories?: string[];
}

export interface CategoryTrend {
  categoryId: string;
  label: string;
  videoCount: number;
  viewerCount: number;
  trending: boolean;
  growth: number;
}

export interface UnifiedVideoFeed {
  videos: UnifiedVideo[];
  categories: VideoCategory[];
  trendingCategories: CategoryTrend[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface CategoryPage {
  category: string;
  label: string;
  videos: UnifiedVideo[];
  subCategories: string[];
  topCreators: Array<{ name: string; channelUrl: string; videoCount: number }>;
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface SearchResults {
  videos: UnifiedVideo[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
  query: string;
}

export interface VideoSource {
  id: string;
  label: string;
  color: string;
  available: boolean;
  healthy: boolean;
  lastChecked: string;
}

export interface SourcesResponse {
  sources: VideoSource[];
}

// === Base fetch hook =====================================================

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useApiFetch<T>(url: string | null): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !!url,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));

    fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = (await res.json()) as T;
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
        }
      });
  }, [url]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

// === Video Hub Hook ======================================================

export function useVideoHub(params: {
  category?: string;
  source?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.category && params.category !== 'all') qs.set('category', params.category);
  if (params.source && params.source !== 'all') qs.set('source', params.source);
  if (params.sort) qs.set('sort', params.sort);
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));

  const url = `/api/video/hub?${qs.toString()}`;
  return useApiFetch<UnifiedVideoFeed>(url);
}

// === Video Categories Hook ===============================================

export function useVideoCategories() {
  return useApiFetch<{
    categories: VideoCategory[];
    trending: CategoryTrend[];
  }>('/api/video/categories');
}

// === Category Page Hook ==================================================

export function useCategoryPage(
  categoryId: string,
  params?: { source?: string; sort?: string; cursor?: string; limit?: number },
) {
  const qs = new URLSearchParams();
  if (params?.source) qs.set('source', params.source);
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit) qs.set('limit', String(params.limit));

  const url = `/api/video/category/${categoryId}?${qs.toString()}`;
  return useApiFetch<CategoryPage>(url);
}

// === Video Search Hook ===================================================

export function useVideoSearch(query: string, params?: { source?: string; limit?: number }) {
  const trimmed = query.trim();
  const qs = trimmed.length >= 2 ? new URLSearchParams({ q: trimmed }) : null;
  if (qs) {
    if (params?.source) qs.set('source', params.source);
    if (params?.limit) qs.set('limit', String(params.limit));
  }
  const url = qs ? `/api/video/search?${qs.toString()}` : null;
  return useApiFetch<SearchResults>(url);
}

// === Video Sources Hook ==================================================

export function useVideoSources() {
  return useApiFetch<SourcesResponse>('/api/video/sources');
}

// === Trending Videos Hook ================================================

export function useTrendingVideos(params?: { source?: string; cursor?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.source) qs.set('source', params.source);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit) qs.set('limit', String(params.limit));

  const url = `/api/video/trending?${qs.toString()}`;
  return useApiFetch<{
    videos: UnifiedVideo[];
    trendingCategories: CategoryTrend[];
    total: number;
    cursor: string | null;
    hasMore: boolean;
  }>(url);
}

// === Continue Watching Hook ==============================================

export interface ContinueWatchingItem {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  source: string;
  channelName: string;
  progress: number; // 0-100
  duration: number;
  watchedAt: number;
}

export function useContinueWatching() {
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('df:continue-watching');
      if (raw) {
        const parsed = JSON.parse(raw) as ContinueWatchingItem[];
        // Sort by most recent
        parsed.sort((a, b) => b.watchedAt - a.watchedAt);
        setItems(parsed.slice(0, 20));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const addItem = useCallback((item: ContinueWatchingItem) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.videoId !== item.videoId);
      const updated = [item, ...filtered].slice(0, 20);
      try {
        localStorage.setItem('df:continue-watching', JSON.stringify(updated));
      } catch {
        // Storage full or unavailable
      }
      return updated;
    });
  }, []);

  const removeItem = useCallback((videoId: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.videoId !== videoId);
      try {
        localStorage.setItem('df:continue-watching', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  return { items, addItem, removeItem };
}

// === Aggregator Types ====================================================

export interface AggregatorSourceCount {
  id: string;
  label: string;
  color: string;
  count: number;
}

export interface AggregatorFeedResponse {
  videos: UnifiedVideo[];
  categories: string[];
  sourceCounts: AggregatorSourceCount[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface AggregatorCreatorResponse {
  creator: CreatorProfile;
  videos: UnifiedVideo[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface CreatorProfile {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  platforms: CreatorPlatform[];
  totalFollowers: number;
  joinedAt?: string;
}

export interface AggregatorResolveResponse {
  creator?: CreatorProfile;
  video?: UnifiedVideo;
  matched: boolean;
}

// === Aggregator Hooks ====================================================

/**
 * Fetch aggregated trending / personalized feed.
 * Omitting category returns the general feed; pass a category for scoped trending.
 */
export function useAggregatorFeed(category?: string) {
  const qs = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
  return useApiFetch<AggregatorFeedResponse>(`/api/video/aggregator/feed${qs}`);
}

/**
 * Fetch a creator's profile + their videos across all platforms.
 */
export function useAggregatorCreator(creatorId: string) {
  const url = creatorId ? `/api/video/aggregator/creator/${encodeURIComponent(creatorId)}` : null;
  return useApiFetch<AggregatorCreatorResponse>(url);
}

/**
 * Resolve an identifier (handle, channel URL, or mint address) to a creator or video.
 * Pass null or empty to skip fetching.
 */
export function useAggregatorResolve(identifier: string | null) {
  const trimmed = identifier?.trim() ?? '';
  const url =
    trimmed.length >= 2
      ? `/api/video/aggregator/resolve?${new URLSearchParams({ identifier: trimmed }).toString()}`
      : null;
  return useApiFetch<AggregatorResolveResponse>(url);
}

/**
 * Mutation hook to follow a creator across all their platforms.
 * Returns { follow, unfollow, loading, error }.
 */
export function useAggregatorFollow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const follow = useCallback(async (creatorId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/video/aggregator/creator/${encodeURIComponent(creatorId)}/follow`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Follow failed: ${res.status}`);
      return (await res.json()) as { success: boolean; followed: number };
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const unfollow = useCallback(async (creatorId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/video/aggregator/creator/${encodeURIComponent(creatorId)}/follow`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Unfollow failed: ${res.status}`);
      return (await res.json()) as { success: boolean };
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { follow, unfollow, loading, error };
}
