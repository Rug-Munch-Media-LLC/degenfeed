'use client';

/**
 * @degenfeed/web — useVideoHub hook
 *
 * SWR-style hooks for the video hub API.
 * Provides typed data fetching for the Netflix-style video browsing experience.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types matching the API responses ────────────────────────────────────

export interface UnifiedVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  embedUrl?: string;
  duration: number;
  durationLabel: string;
  source: 'youtube' | 'peertube' | 'shorts' | 'livestream';
  sourceLabel: string;
  sourceColor: string;
  channelName: string;
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

// ─── Base fetch hook ─────────────────────────────────────────────────────

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

// ─── Video Hub Hook ──────────────────────────────────────────────────────

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

// ─── Video Categories Hook ───────────────────────────────────────────────

export function useVideoCategories() {
  return useApiFetch<{
    categories: VideoCategory[];
    trending: CategoryTrend[];
  }>('/api/video/categories');
}

// ─── Category Page Hook ──────────────────────────────────────────────────

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

// ─── Video Search Hook ───────────────────────────────────────────────────

export function useVideoSearch(query: string, params?: { source?: string; limit?: number }) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return { data: null, loading: false, error: null, refetch: () => {} } as const;
  }

  const qs = new URLSearchParams({ q: trimmed });
  if (params?.source) qs.set('source', params.source);
  if (params?.limit) qs.set('limit', String(params.limit));

  const url = `/api/video/search?${qs.toString()}`;
  return useApiFetch<SearchResults>(url);
}

// ─── Video Sources Hook ──────────────────────────────────────────────────

export function useVideoSources() {
  return useApiFetch<SourcesResponse>('/api/video/sources');
}

// ─── Trending Videos Hook ────────────────────────────────────────────────

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

// ─── Continue Watching Hook ──────────────────────────────────────────────

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
