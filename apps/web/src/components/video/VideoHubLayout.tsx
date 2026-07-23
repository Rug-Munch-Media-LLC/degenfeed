'use client';

/**
 * @degenfeed/web — VideoHubLayout
 *
 * Netflix-style video browsing layout.
 * Organizes videos into themed horizontal rows with:
 * - Hero banner at top
 * - Category pills filter
 * - Source filter tabs
 * - Themed content rows
 * - Trending sidebar
 */

import { useCallback, useMemo, useState } from 'react';
import type { CategoryTrend, UnifiedVideo, UnifiedVideoFeed } from './useVideoHub';
import { VideoCategoryPills } from './VideoCategoryPills';
import { VideoContinueWatching } from './VideoContinueWatching';
import { VideoHero } from './VideoHero';
import { VideoRow } from './VideoRow';
import { VideoSearchBar } from './VideoSearchBar';

// === Source filter options ===============================================

const SOURCE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000' },
  { id: 'peertube', label: 'PeerTube', color: '#F1680D' },
  { id: 'shorts', label: 'Shorts', color: '#FF0050' },
  { id: 'livestream', label: 'Live', color: '#9146FF' },
] as const;

// === Category-to-color mapping for row accents ===========================

const CATEGORY_ROW_COLORS: Record<string, string> = {
  crypto: '#0052FF',
  gaming: '#9146FF',
  music: '#FF4081',
  tech: '#00BCD4',
  art: '#FF6B35',
  education: '#2196F3',
  entertainment: '#E91E63',
  sports: '#F44336',
  news: '#607D8B',
  science: '#4CAF50',
  comedy: '#FFC107',
  irl: '#00C853',
  talk: '#FFD600',
  trading: '#FF5722',
};

interface VideoHubLayoutProps {
  feed: UnifiedVideoFeed;
  loading: boolean;
  error: string | null;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  onPlay: (video: UnifiedVideo) => void;
  onSave: (video: UnifiedVideo) => void;
  onLoadMore: () => void;
  onSearch: (query: string, source: string) => void;
  trendingCategories: CategoryTrend[];
  className?: string;
}

export function VideoHubLayout({
  feed,
  loading,
  error,
  activeCategory,
  onCategoryChange,
  onPlay,
  onSave,
  onLoadMore,
  onSearch,
  trendingCategories,
  className = '',
}: VideoHubLayoutProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [activeSource, setActiveSource] = useState<string>('all');
  const onSourceChange = useCallback((id: string) => setActiveSource(id), []);

  // Featured hero video — first video from the feed
  const heroVideo = useMemo(() => (feed.videos.length > 0 ? feed.videos[0] : null), [feed.videos]);

  // Distribute videos into themed rows
  const rows = useMemo(() => {
    const rowData: Array<{
      id: string;
      title: string;
      videos: UnifiedVideo[];
      href?: string;
      accent?: string;
    }> = [];

    const remaining = feed.videos.slice(1); // Skip hero video

    if (remaining.length === 0) return rowData;

    // Row 1: Trending Now (first batch, highest trending score)
    rowData.push({
      id: 'trending',
      title: 'Trending Now',
      videos: remaining.slice(0, 12),
      href: '/video?sort=trending',
    });

    // Extract videos by category for category rows
    const byCategory = new Map<string, UnifiedVideo[]>();
    for (const v of remaining.slice(12)) {
      const cat = v.category || 'entertainment';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)?.push(v);
    }

    // Sort categories by video count (descending)
    const sortedCats = [...byCategory.entries()]
      .filter(([, videos]) => videos.length >= 4)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8);

    for (const [catId, videos] of sortedCats) {
      const catMeta = feed.categories.find((c) => c.id === catId);
      if (!catMeta) continue;
      rowData.push({
        id: `category-${catId}`,
        title: catMeta.label,
        videos: videos.slice(0, 14),
        href: `/video?category=${catId}`,
        accent: CATEGORY_ROW_COLORS[catId] ?? undefined,
      });
    }

    // Add "New Releases" row if there are enough recent videos
    const recent = [...remaining].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 10);
    if (recent.length >= 4) {
      rowData.push({
        id: 'new-releases',
        title: 'New Releases',
        videos: recent,
      });
    }

    return rowData;
  }, [feed.videos, feed.categories]);

  // Loading skeleton
  if (loading && feed.videos.length === 0) {
    return (
      <div className={`space-y-8 ${className}`}>
        {/* Hero skeleton */}
        <div className="h-[360px] animate-pulse rounded-2xl bg-[var(--color-card)]" />
        {/* Row skeletons */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-5 w-48 animate-pulse rounded bg-[var(--color-card)]" />
            <div className="flex gap-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="w-64 shrink-0">
                  <div className="aspect-video mb-2 animate-pulse rounded-xl bg-[var(--color-card)]" />
                  <div className="flex gap-2">
                    <div className="h-7 w-7 animate-pulse rounded-full bg-[var(--color-card)]" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-card)]" />
                      <div className="h-2 w-1/2 animate-pulse rounded bg-[var(--color-card)]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-20 ${className}`}>
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-red-400"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="mb-2 text-sm font-medium text-[var(--color-fg)]">
          Couldn&apos;t load video hub
        </p>
        <p className="mb-4 max-w-sm text-center text-xs text-[var(--color-muted)]">{error}</p>
        <button
          type="button"
          onClick={onLoadMore}
          className="rounded-lg bg-degen-500 px-4 py-2 text-xs font-semibold text-black hover:bg-degen-400 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header: Title + Search toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">Video Hub</p>
          <h1 className="text-2xl font-bold text-[var(--color-fg)] sm:text-3xl">Discover</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowSearch((prev) => !prev)}
          className="flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Search
        </button>
      </div>

      {/* Search bar (toggled) */}
      {showSearch && <VideoSearchBar onSearch={onSearch} />}

      {/* Category pills */}
      <VideoCategoryPills activeCategory={activeCategory} onCategoryChange={onCategoryChange} />

      {/* Source filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {SOURCE_FILTERS.map((sf) => {
          const isActive = activeSource === sf.id;
          return (
            <button
              key={sf.id}
              type="button"
              onClick={() => onSourceChange(sf.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[var(--color-card)] text-[var(--color-fg)] border border-[var(--color-border)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
              style={
                isActive && 'color' in sf && sf.color
                  ? { borderColor: `${sf.color}40`, backgroundColor: `${sf.color}10` as string }
                  : undefined
              }
            >
              {'color' in sf && sf.color && (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sf.color }} />
              )}
              {sf.label}
            </button>
          );
        })}

        {/* Trending categories indicator */}
        {trendingCategories.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-degen-500" />
            <span className="text-[10px] text-[var(--color-muted)]">
              {trendingCategories.filter((t) => t.trending).length} trending
            </span>
          </div>
        )}
      </div>

      {/* Hero video */}
      {heroVideo && activeCategory === 'all' && activeSource === 'all' && (
        <VideoHero video={heroVideo} onPlay={onPlay} />
      )}

      {/* Continue watching */}
      {activeCategory === 'all' && activeSource === 'all' && (
        <VideoContinueWatching onPlay={onPlay} />
      )}

      {/* Themed video rows */}
      <div className="space-y-8">
        {rows.map((row) => (
          <VideoRow
            key={row.id}
            title={row.title}
            videos={row.videos}
            href={row.href}
            size="md"
            onPlay={onPlay}
            onSave={onSave}
          />
        ))}
      </div>

      {/* Empty state */}
      {!loading && feed.videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)]">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-[var(--color-muted)]"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M10 9l5 3-5 3V9z" />
            </svg>
          </div>
          <p className="mb-1 text-sm font-medium text-[var(--color-fg)]">No videos found</p>
          <p className="text-xs text-[var(--color-muted)]">
            Try a different category or source filter
          </p>
        </div>
      )}

      {/* Load more */}
      {feed.hasMore && feed.videos.length > 0 && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-6 py-3 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-500" />
                Loading...
              </>
            ) : (
              'Load More Videos'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
