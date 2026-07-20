'use client';

/**
 * @degenfeed/web — /video (Video Hub)
 *
 * Netflix-style video browsing experience:
 * - Hero banner: featured video with play/watch later/details
 * - Category tabs at top (horizontal scrollable pills)
 * - Source filter: [All] [YouTube] [PeerTube] [Shorts] [Live]
 * - Themed rows: Trending Now, per-category rows, New Releases
 * - Continue Watching from localStorage
 * - Unified search with source filter
 *
 * Every video is labeled with its source (color-coded).
 */

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VideoHubLayout } from '../../components/video/VideoHubLayout';
import {
  type UnifiedVideo,
  type CategoryTrend,
  type UnifiedVideoFeed,
  useVideoHub,
  useVideoCategories,
  useTrendingVideos,
} from '../../components/video/useVideoHub';

// ─── Page ────────────────────────────────────────────────────────────────

export default function VideoHubPage() {
  // URL params
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState('trending');
  const [cursor, setCursor] = useState<string | undefined>();
  const [allVideos, setAllVideos] = useState<UnifiedVideo[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [trendingCategories, setTrendingCategories] = useState<CategoryTrend[]>([]);

  // Fetch initial feed
  const { data, loading, error, refetch } = useVideoHub({
    category,
    source,
    sort,
    limit: 60,
  });

  // Fetch trending categories separately
  const { data: catData } = useVideoCategories();

  // Load more state
  const [loadingMore, setLoadingMore] = useState(false);

  // Sync data to local state (allows appending)
  useEffect(() => {
    if (data) {
      if (cursor) {
        // Append mode
        setAllVideos((prev) => {
          const existingIds = new Set(prev.map((v) => v.id));
          const newVids = data.videos.filter((v) => !existingIds.has(v.id));
          return [...prev, ...newVids];
        });
      } else {
        setAllVideos(data.videos);
      }
      setHasMore(data.hasMore);
      if (data.trendingCategories.length > 0) {
        setTrendingCategories(data.trendingCategories);
      }
    }
  }, [data, cursor]);

  // Also populate trending from categories endpoint
  useEffect(() => {
    if (catData?.trending && catData.trending.length > 0) {
      setTrendingCategories(catData.trending);
    }
  }, [catData]);

  // Reset when category/source/sort changes
  useEffect(() => {
    setCursor(undefined);
    setAllVideos([]);
    setHasMore(true);
  }, [category, source, sort]);

  const handleCategoryChange = useCallback((newCategory: string) => {
    setCategory(newCategory);
  }, []);

  const handleSourceChange = useCallback((newSource: string) => {
    setSource(newSource);
  }, []);

  const handlePlay = useCallback((video: UnifiedVideo) => {
    if (video.videoUrl) {
      window.open(video.videoUrl, '_blank', 'noopener noreferrer');
    } else if (video.embedUrl) {
      window.open(video.embedUrl, '_blank', 'noopener noreferrer');
    }
  }, []);

  const handleSave = useCallback((video: UnifiedVideo) => {
    try {
      const saved = JSON.parse(localStorage.getItem('df:saved-videos') ?? '[]') as string[];
      if (!saved.includes(video.id)) {
        saved.push(video.id);
        localStorage.setItem('df:saved-videos', JSON.stringify(saved));
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'success', message: 'Video saved!' },
          }),
        );
      }
    } catch {
      // Storage unavailable
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    // Simulate load more by refetching with cursor
    setCursor(String((allVideos.length / 60) + 1));
    setLoadingMore(false);
  }, [loadingMore, hasMore, allVideos.length]);

  const handleSearch = useCallback((query: string, searchSource: string) => {
    const params = new URLSearchParams({ q: query });
    if (searchSource !== 'all') params.set('source', searchSource);
    window.location.href = `/video?search=${encodeURIComponent(query)}${searchSource !== 'all' ? `&source=${searchSource}` : ''}`;
  }, []);

  // Build the feed object from accumulated data
  const feed: UnifiedVideoFeed = useMemo(
    () => ({
      videos: allVideos,
      categories: data?.categories ?? [],
      trendingCategories,
      total: allVideos.length,
      cursor: data?.cursor ?? null,
      hasMore,
    }),
    [allVideos, data?.categories, trendingCategories, hasMore],
  );

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb / return links */}
        <div className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <Link href="/feed" className="hover:text-[var(--color-fg)] transition-colors">
            Feed
          </Link>
          <span>/</span>
          <span className="text-[var(--color-fg)]">Video Hub</span>
          <span className="ml-auto text-[10px]">
            {allVideos.length > 0 && `${allVideos.length} videos`}
          </span>
        </div>

        <VideoHubLayout
          feed={feed}
          loading={loading}
          error={error}
          activeCategory={category}
          activeSource={source}
          onCategoryChange={handleCategoryChange}
          onSourceChange={handleSourceChange}
          onPlay={handlePlay}
          onSave={handleSave}
          onLoadMore={handleLoadMore}
          onSearch={handleSearch}
          trendingCategories={trendingCategories}
        />
      </div>
    </ErrorBoundary>
  );
}
