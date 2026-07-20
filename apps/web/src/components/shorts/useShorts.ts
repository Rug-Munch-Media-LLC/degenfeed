'use client';

/**
 * useShorts — SWR-like hook for fetching shorts feed with infinite scroll.
 *
 * Returns videos, loading/error states, loadMore, refresh, and source counts.
 * Supports topic filtering and cursor-based pagination.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

interface ShortVideoItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  authorName: string;
  authorAvatar?: string;
  views: number;
  likes: number;
  source: 'peertube' | 'youtube' | 'tiktok_rss' | 'instagram' | 'twitter' | 'direct';
  sourceUrl: string;
  sourceColor?: string;
  sourceLabel: string;
  canTip: boolean;
  creatorCoinSymbol?: string;
  creatorCoinAddress?: string;
  topics: string[];
  publishedAt: number;
  vertical: boolean;
  qualityScore: number;
}

export interface ShortsResponse {
  videos: ShortVideoItem[];
  sources: Record<string, number>;
  cursor: string | null;
  hasMore: boolean;
  aggregatedAt: number;
}

export interface UseShortsOptions {
  endpoint?: string;
  limit?: number;
  topics?: string[];
  seenIds?: string[];
  loadMoreLimit?: number;
  initialLimit?: number;
  loadMoreBuffer?: number;
}

export interface UseShortsResult {
  videos: ShortVideoItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  sourceCounts: Record<string, number>;
  loadMore: () => void;
  refresh: () => void;
}

const INITIAL_LIMIT = 20;
const LOAD_MORE_LIMIT = 10;
const LOAD_MORE_BUFFER = 3;

export function useShorts(opts: UseShortsOptions = {}): UseShortsResult {
  const {
    endpoint = '/api/shorts/feed',
    topics,
    limit: _limit,
    loadMoreLimit = LOAD_MORE_LIMIT,
    initialLimit = INITIAL_LIMIT,
    loadMoreBuffer = LOAD_MORE_BUFFER,
  } = opts;

  const [state, setState] = useState<{
    videos: ShortVideoItem[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    sourceCounts: Record<string, number>;
  }>({
    videos: [],
    loading: true,
    loadingMore: false,
    error: null,
    hasMore: true,
    sourceCounts: {},
  });

  const cursorRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchVideos = useCallback(
    async (append = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((s) => ({
        ...s,
        ...(append ? { loadingMore: true } : { loading: true, error: null }),
      }));

      try {
        const params = new URLSearchParams({
          limit: String(append ? loadMoreLimit : initialLimit),
        });
        if (append && cursorRef.current) params.set('cursor', cursorRef.current);
        if (topics && topics.length > 0) params.set('topics', topics.join(','));

        const res = await fetch(`${endpoint}?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });

        if (!res.ok) throw new Error(`Shorts feed returned ${res.status}`);
        const data = (await res.json()) as ShortsResponse;
        const fetched = data.videos ?? [];
        cursorRef.current = data.cursor;

        setState((prev) => ({
          videos: append ? [...prev.videos, ...fetched] : fetched,
          loading: false,
          loadingMore: false,
          error: null,
          hasMore: data.hasMore,
          sourceCounts: data.sources,
        }));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: err instanceof Error ? err.message : 'Failed to load shorts',
        }));
      }
    },
    [endpoint, topics, initialLimit, loadMoreLimit],
  );

  const loadMore = useCallback(() => {
    if (state.loadingMore || !state.hasMore) return;
    void fetchVideos(true);
  }, [state.loadingMore, state.hasMore, fetchVideos]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    void fetchVideos(false);
  }, [fetchVideos]);

  useEffect(() => {
    void fetchVideos(false);
    return () => abortRef.current?.abort();
  }, [fetchVideos]);

  return { ...state, loadMore, refresh };
}
