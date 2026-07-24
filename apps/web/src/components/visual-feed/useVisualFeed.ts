'use client';

/**
 * useVisualFeed — SWR hook with cursor pagination for the visual feed.
 */

import type { VisualFeedResponse, VisualPost, VisualSource } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVisualFeedOptions {
  sources?: VisualSource[] | 'all';
  filter?: 'all' | 'photos' | 'nfts' | 'video' | 'bluesky';
  sort?: 'newest' | 'trending' | 'top';
  limit?: number;
  followingOnly?: boolean;
  endpoint?: 'visual' | 'visual/trending' | 'visual/for-you';
}

interface UseVisualFeedReturn {
  posts: VisualPost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  meta: VisualFeedResponse['meta'] | null;
}

export function useVisualFeed(opts: UseVisualFeedOptions = {}): UseVisualFeedReturn {
  const {
    sources = 'all',
    filter = 'all',
    sort = 'newest',
    limit = 30,
    followingOnly = false,
    endpoint = 'visual',
  } = opts;

  const [posts, setPosts] = useState<VisualPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<VisualFeedResponse['meta'] | null>(null);
  const [cursor, setCursor] = useState<number>(0);
  const [hasMore, setHasMore] = useState(true);
  const [_refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchFeed = useCallback(
    async (cursorOffset: number, append = false) => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!append) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (sources !== 'all') params.set('sources', (sources as VisualSource[]).join(','));
        if (filter !== 'all') params.set('filter', filter);
        if (sort !== 'newest') params.set('sort', sort);
        params.set('limit', String(limit));
        if (cursorOffset > 0) params.set('cursor', String(cursorOffset));
        if (followingOnly) params.set('following', 'true');

        const url = `/api/feed/${endpoint}?${params.toString()}`;
        const res = await fetch(url, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const data = (await res.json()) as VisualFeedResponse;

        if (append) {
          setPosts((prev) => [...prev, ...data.data]);
        } else {
          setPosts(data.data);
        }

        setMeta(data.meta);
        setHasMore(!!data.nextCursor);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load visual feed');
      } finally {
        setLoading(false);
      }
    },
    [sources, filter, sort, limit, followingOnly, endpoint],
  );

  // Initial load
  useEffect(() => {
    setCursor(0);
    setPosts([]);
    fetchFeed(0, false);
  }, [fetchFeed]);

  const loadMore = useCallback(() => {
    const newCursor = cursor + limit;
    setCursor(newCursor);
    fetchFeed(newCursor, true);
  }, [cursor, limit, fetchFeed]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { posts, loading, error, hasMore, loadMore, refresh, meta };
}
