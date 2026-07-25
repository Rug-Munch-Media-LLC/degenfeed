'use client';

/**
 * @degenfeed/web — /video (Video Hub)
 *
 * Netflix-style video browsing experience powered by the video aggregator backend:
 * - Aggregated content from YouTube (via Invidious), Twitch, Rumble, PeerTube, Zora
 * - Hero banner: featured video with play/watch later/details
 * - Category tabs at top (horizontal scrollable pills)
 * - Source filter bar with per-platform video counts
 * - Themed rows: Trending Now, per-category rows, New Releases
 * - Continue Watching from localStorage
 * - Creator presence indicators across all platforms
 *
 * Every video is labeled with its source (color-coded).
 * No pretense — YouTube is labeled "YouTube (via Invidious)", Twitch is Twitch, etc.
 * The value is in aggregation, cross-platform actions, and creator monetization.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type UnifiedVideo,
  type UnifiedVideoFeed,
  useAggregatorFeed,
  useVideoCategories,
} from '../../components/video/useVideoHub';
import { VideoHubLayout } from '../../components/video/VideoHubLayout';
import type { AggregatorSourceCount } from '../../components/video/VideoSourceFilter';
import { VideoSourceFilter } from '../../components/video/VideoSourceFilter';

// === Platform color mapping (matches VideoSourceBadge) ===================

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  twitch: '#9146FF',
  rumble: '#00A651',
  peertube: '#F1680D',
  zora: '#0052FF',
  creator: '#00FF41',
};

// === Page ================================================================

export default function VideoHubPage() {
  // URL params
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState('all');
  const [_sort] = useState('trending');
  const [cursor, setCursor] = useState<string | undefined>();
  const [allVideos, setAllVideos] = useState<UnifiedVideo[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [sourceCounts, setSourceCounts] = useState<AggregatorSourceCount[]>([]);

  // Fetch aggregated feed from /api/video/aggregator/feed
  const feedCategory = category !== 'all' ? category : undefined;
  const { data, loading, error } = useAggregatorFeed(feedCategory);

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

      // Update source counts from aggregator response
      if (data.sourceCounts && data.sourceCounts.length > 0) {
        setSourceCounts(data.sourceCounts);
      }
    }
  }, [data, cursor]);

  // Reset when category/source/sort changes
  useEffect(() => {
    setCursor(undefined);
    setAllVideos([]);
    setHasMore(true);
  }, []);

  // Filter videos client-side by source when a source is selected
  const filteredVideos = useMemo(() => {
    if (source === 'all') return allVideos;
    return allVideos.filter((v) => v.source === source);
  }, [allVideos, source]);

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
    setCursor(String(allVideos.length / 60 + 1));
    setLoadingMore(false);
  }, [loadingMore, hasMore, allVideos.length]);

  const handleSearch = useCallback((query: string, searchSource: string) => {
    const params = new URLSearchParams({ q: query });
    if (searchSource !== 'all') params.set('source', searchSource);
    window.location.href = `/video?search=${encodeURIComponent(query)}${searchSource !== 'all' ? `&source=${searchSource}` : ''}`;
  }, []);

  // Map source counts to filter options with colors
  const filterSources = useMemo(() => {
    const mapped = sourceCounts.map((sc) => ({
      id: sc.id,
      label: sc.label,
      count: sc.count,
      color: PLATFORM_COLORS[sc.id] ?? '#888',
    }));
    // Ensure standard platforms always appear (even at 0) when we have data
    const standardPlatforms = ['youtube', 'twitch', 'rumble', 'peertube', 'zora'];
    for (const pid of standardPlatforms) {
      if (!mapped.find((m) => m.id === pid) && allVideos.length > 0) {
        mapped.push({
          id: pid,
          label: pid.charAt(0).toUpperCase() + pid.slice(1),
          count: 0,
          color: PLATFORM_COLORS[pid] ?? '#888',
        });
      }
    }
    return mapped;
  }, [sourceCounts, allVideos.length]);

  // Build the feed object from accumulated + filtered data
  const feed: UnifiedVideoFeed = useMemo(
    () => ({
      videos: filteredVideos,
      categories: data?.categories?.map((c: string) => ({ id: c, label: c, icon: '▶' })) ?? [],
      trendingCategories: catData?.trending ?? [],
      total: filteredVideos.length,
      cursor: data?.cursor ?? null,
      hasMore,
    }),
    [filteredVideos, data?.categories, data?.cursor, catData?.trending, hasMore],
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
          <Link
            href="/video/all"
            className="ml-2 rounded-full border border-current/20 px-2.5 py-0.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            🌐 All Platforms
          </Link>
          <span className="ml-auto text-[10px]">
            {filteredVideos.length > 0 && `${filteredVideos.length} videos`}
          </span>
        </div>

        {/* Source filter bar with platform counts */}
        {!loading && (
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-medium tracking-wider text-[var(--color-muted)] uppercase">
              Content Sources
            </p>
            <VideoSourceFilter
              sources={filterSources}
              activeSource={source}
              onSourceChange={handleSourceChange}
              loading={loading}
            />
          </div>
        )}

        {/* Zero-cost hosting indicator */}
        <div className="mb-4 rounded-lg border border-green-500/10 bg-green-500/[0.03] px-3 py-1.5 text-[11px] text-green-400/70">
          All external video content is served directly from source platforms — DegenFeed pays{' '}
          <strong className="text-green-300">$0 hosting costs</strong> for embedded content.
        </div>

        <VideoHubLayout
          feed={feed}
          loading={loading}
          error={error}
          activeCategory={category}
          onCategoryChange={handleCategoryChange}
          onPlay={handlePlay}
          onSave={handleSave}
          onLoadMore={handleLoadMore}
          onSearch={handleSearch}
          trendingCategories={catData?.trending ?? []}
        />
      </div>
    </ErrorBoundary>
  );
}
