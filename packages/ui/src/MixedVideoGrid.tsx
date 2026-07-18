'use client';

/**
 * @degenfeed/ui — MixedVideoGrid
 *
 * Interleaved grid of YouTube + PeerTube videos.
 * Videos are distinguishable by source badge color:
 *   - YouTube: red "▶ YouTube" badge
 *   - PeerTube: purple "📹 Federated" badge
 *
 * Layout: 3 columns desktop, 2 tablet, 1 mobile.
 * Supports infinite-scroll via IntersectionObserver.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { YouTubeVideoCard, type YouTubeVideoCardItem } from './YouTubeVideoCard';

// ─── Types ───────────────────────────────────────────────────────────────

export type VideoSort = 'recent' | 'popular' | 'trending';
export type VideoTab = 'all' | 'youtube' | 'peertube' | 'federated' | 'shorts' | 'live';
export type VideoCategory =
  | 'all'
  | 'crypto'
  | 'defi'
  | 'nft'
  | 'tutorial'
  | 'news'
  | 'entertainment';

export interface MixedVideoGridProps {
  /** All videos from all sources */
  videos: YouTubeVideoCardItem[];
  /** Active tab filter */
  activeTab: VideoTab;
  /** Active category filter */
  activeCategory: VideoCategory;
  /** Sort order */
  sort: VideoSort;
  /** Called when a video is clicked to play */
  onPlay?: (video: YouTubeVideoCardItem) => void;
  /** Called when user clicks tip button on a video */
  onTip?: (video: YouTubeVideoCardItem) => void;
  /** Called when user scrolls near bottom (load more) */
  onLoadMore?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Error message to display */
  error?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const TABS: { id: VideoTab; label: string }[] = [
  { id: 'all', label: 'All Videos' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'peertube', label: 'PeerTube' },
  { id: 'federated', label: 'Federated' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'live', label: 'Live' },
];

const CATEGORIES: { id: VideoCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'defi', label: 'DeFi' },
  { id: 'nft', label: 'NFT' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'news', label: 'News' },
  { id: 'entertainment', label: 'Entertainment' },
];

// ─── Scroll Loader ─────────────────────────────────────────────────────

function useInfiniteScroll(onLoadMore?: () => void, hasMore?: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onLoadMore || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasMore) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);

  return sentinelRef;
}

// ─── Skeleton Grid ──────────────────────────────────────────────────────

function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden animate-pulse"
          aria-hidden="true"
        >
          <div className="aspect-video bg-[var(--color-muted)]" />
          <div className="p-3 space-y-2">
            <div className="h-4 w-3/4 rounded bg-[var(--color-muted)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--color-muted)]" />
            <div className="h-3 w-1/3 rounded bg-[var(--color-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────

function EmptyState({ tab, category }: { tab: VideoTab; category: VideoCategory }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-overlay)]">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-[var(--color-muted)]"
        >
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[var(--color-fg)]">No videos found</h3>
      <p className="mt-1 text-sm text-[var(--color-muted)] max-w-xs">
        {tab === 'shorts'
          ? 'No Shorts available in this category yet.'
          : tab === 'live'
            ? 'No live streams right now.'
            : tab === 'peertube'
              ? 'No PeerTube videos match the current filters.'
              : tab === 'federated'
                ? 'No federated videos found. The fediverse might be sleepy — try again later.'
                : 'Try adjusting the filters or check back later.'}
        {category !== 'all' && ` Category: ${category}.`}
      </p>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export const MixedVideoGrid = memo(function MixedVideoGrid({
  videos,
  activeTab,
  activeCategory,
  sort,
  onPlay,
  onTip,
  onLoadMore,
  loading = false,
  hasMore = false,
  error = null,
}: MixedVideoGridProps) {
  const sentinelRef = useInfiniteScroll(onLoadMore, hasMore);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (!loading && videos.length > 0) {
      setInitialLoad(false);
    }
  }, [loading, videos.length]);

  // Tab-filtered videos
  const tabFiltered = videos.filter((v) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'youtube') return v.source === 'youtube' && !/#shorts/.test(v.url);
    if (activeTab === 'peertube') return v.source === 'peertube';
    if (activeTab === 'federated') return v.source === 'peertube';
    if (activeTab === 'shorts') return v.source === 'youtube' && /#shorts/.test(v.url);
    if (activeTab === 'live') return false; // Live detection would need API data
    return true;
  });

  // Category filter
  const categoryFiltered = tabFiltered.filter((v) => {
    if (activeCategory === 'all') return true;
    return v.category === activeCategory;
  });

  // Sort
  const sorted = [...categoryFiltered].sort((a, b) => {
    if (sort === 'recent') return b.publishedMs - a.publishedMs;
    if (sort === 'popular') return (b.views ?? 0) - (a.views ?? 0);
    // Trending = views per hour since publish
    const scoreA = (a.views ?? 0) / Math.max(1, (Date.now() - a.publishedMs) / 3600000);
    const scoreB = (b.views ?? 0) / Math.max(1, (Date.now() - b.publishedMs) / 3600000);
    return scoreB - scoreA;
  });

  const isEmpty = !loading && sorted.length === 0;

  return (
    <div className="w-full">
      {/* ── Error Banner ── */}
      {error && (
        <div
          className="mb-4 rounded-lg border border-red-900/30 bg-red-950/20 px-4 py-3 text-sm text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ── Loading (initial) ── */}
      {initialLoad && loading && <GridSkeleton count={6} />}

      {/* ── Empty State ── */}
      {!initialLoad && isEmpty && !loading && (
        <EmptyState tab={activeTab} category={activeCategory} />
      )}

      {/* ── Video Grid ── */}
      {sorted.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((video) => (
              <YouTubeVideoCard
                key={`${video.source}-${video.id}`}
                video={video}
                showExtended
                onPlay={onPlay}
                onTip={onTip}
              />
            ))}
          </div>

          {/* ── Load more sentinel ── */}
          {hasMore && (
            <div ref={sentinelRef} className="mt-6 flex justify-center">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                  <div
                    className="h-4 w-4 rounded-full border-2 border-degen-500/30 border-t-degen-500 animate-spin"
                    role="status"
                    aria-label="Loading more videos"
                  />
                  Loading more videos...
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-6 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-500/40"
                >
                  Load more
                </button>
              )}
            </div>
          )}

          {/* ── Stats ── */}
          {sorted.length > 0 && !hasMore && (
            <p className="mt-6 text-center text-[11px] text-[var(--color-muted)]">
              Showing {sorted.length} video{sorted.length !== 1 ? 's' : ''}
              {activeCategory !== 'all' && ` in ${activeCategory}`}
            </p>
          )}
        </>
      )}
    </div>
  );
});

// ─── Tab + Category filter bar (reusable) ────────────────────────────────

export interface VideoFilterBarProps {
  activeTab: VideoTab;
  activeCategory: VideoCategory;
  sort: VideoSort;
  onTabChange: (tab: VideoTab) => void;
  onCategoryChange: (category: VideoCategory) => void;
  onSortChange: (sort: VideoSort) => void;
}

export const VideoFilterBar = memo(function VideoFilterBar({
  activeTab,
  activeCategory,
  sort,
  onTabChange,
  onCategoryChange,
  onSortChange,
}: VideoFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* ── Tabs row ── */}
      <nav aria-label="Video source tabs">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-degen-500/40 ${
                activeTab === tab.id
                  ? 'bg-degen-500/15 text-degen-400 border border-degen-500/30'
                  : 'bg-[var(--color-card)] text-[var(--color-muted)] border border-[var(--color-glass-border)] hover:border-degen-500/20 hover:text-[var(--color-fg)]'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Category chips + Sort ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-wrap"
          role="group"
          aria-label="Video categories"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-degen-500/40 ${
                activeCategory === cat.id
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
              }`}
              aria-pressed={activeCategory === cat.id}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--color-muted)]">Sort:</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as VideoSort)}
            className="rounded-md border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-degen-500/40 cursor-pointer"
            aria-label="Sort videos by"
          >
            <option value="recent">Recent</option>
            <option value="popular">Popular</option>
            <option value="trending">Trending</option>
          </select>
        </div>
      </div>
    </div>
  );
});
