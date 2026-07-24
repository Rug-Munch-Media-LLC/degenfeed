'use client';

/**
 * @degenfeed/web — YouTubeVideoGrid
 *
 * Responsive grid of YouTube video cards.
 * 4 columns desktop, 2 tablet, 1 mobile.
 * Supports infinite-scroll via IntersectionObserver.
 * All content clearly labeled as YouTube (red badge).
 */

import { memo, useEffect, useRef, useState } from 'react';
import type { EnrichedYouTubeVideo } from './useYouTube';
import { YouTubeVideoCard } from './YouTubeVideoCard';

// === Types ===============================================================

export interface YouTubeVideoGridProps {
  /** Videos to display */
  videos: EnrichedYouTubeVideo[];
  /** Loading state for initial load */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Called when user scrolls to bottom */
  onLoadMore?: () => void;
  /** Whether more items can be loaded */
  hasMore?: boolean;
  /** Columns breakpoint config */
  columns?: { mobile?: number; tablet?: number; desktop?: number };
  /** Called when a video is clicked */
  onPlay?: (video: EnrichedYouTubeVideo) => void;
  /** Called when user clicks tip */
  onTip?: (video: EnrichedYouTubeVideo) => void;
  /** Called when user clicks share */
  onShare?: (video: EnrichedYouTubeVideo) => void;
  /** Called when user clicks save */
  onSave?: (video: EnrichedYouTubeVideo) => void;
  /** Called when user clicks cross-post */
  onCrossPost?: (video: EnrichedYouTubeVideo) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Section title (optional) */
  title?: string;
}

// === Infinite Scroll Hook ===============================================

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

// === Skeleton ============================================================

function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden animate-pulse"
          aria-hidden="true"
        >
          <div className="aspect-video bg-[var(--color-muted)]" />
          <div className="p-3 space-y-2">
            <div className="h-4 w-3/4 rounded bg-[var(--color-muted)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--color-muted)]" />
            <div className="h-3 w-1/3 rounded bg-[var(--color-muted)]" />
          </div>
          <div className="border-t border-[var(--color-glass-border)] flex">
            <div className="flex-1 h-8 bg-[var(--color-muted)]" />
            <div className="flex-1 h-8 bg-[var(--color-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// === Empty State =========================================================

function EmptyState({ message }: { message: string }) {
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
      <p className="mt-1 text-sm text-[var(--color-muted)] max-w-xs">{message}</p>
    </div>
  );
}

// === Component ===========================================================

export const YouTubeVideoGrid = memo(function YouTubeVideoGrid({
  videos,
  loading = false,
  error = null,
  onLoadMore,
  hasMore = false,
  onPlay,
  onTip,
  onShare,
  onSave,
  onCrossPost,
  emptyMessage = 'Try adjusting filters or check back later.',
  title,
}: YouTubeVideoGridProps) {
  const sentinelRef = useInfiniteScroll(onLoadMore, hasMore);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (!loading && videos.length > 0) {
      setInitialLoad(false);
    }
  }, [loading, videos.length]);

  const isEmpty = !loading && videos.length === 0;

  return (
    <div className="w-full">
      {/* Section title */}
      {title && (
        <h2 className="text-lg font-bold text-[var(--color-fg)] mb-4 flex items-center gap-2">
          <span className="text-red-500">{'\u25B6'}</span>
          {title}
          <span className="text-[11px] font-normal text-[var(--color-muted)] ml-1">YouTube</span>
        </h2>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="mb-4 rounded-lg border border-red-900/30 bg-red-950/20 px-4 py-3 text-sm text-red-400"
          role="alert"
        >
          {error}
          <p className="mt-1 text-xs text-red-500/70">
            YouTube content may be temporarily unavailable. Please try again later.
          </p>
        </div>
      )}

      {/* Initial loading skeleton */}
      {initialLoad && loading && <GridSkeleton count={8} />}

      {/* Empty state */}
      {!initialLoad && isEmpty && !loading && <EmptyState message={emptyMessage} />}

      {/* Video grid */}
      {videos.length > 0 && (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <YouTubeVideoCard
                key={`yt-${video.id}`}
                video={video}
                onPlay={onPlay}
                onTip={onTip}
                onShare={onShare}
                onSave={onSave}
                onCrossPost={onCrossPost}
              />
            ))}
          </div>

          {/* Load more sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="mt-6 flex justify-center">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                  <div
                    className="h-4 w-4 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin"
                    role="status"
                    aria-label="Loading more videos"
                  />
                  Loading more videos...
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-6 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-red-500/30 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40"
                >
                  Load more
                </button>
              )}
            </div>
          )}

          {/* Count */}
          {videos.length > 0 && !hasMore && (
            <p className="mt-6 text-center text-[11px] text-[var(--color-muted)]">
              Showing {videos.length} video{videos.length !== 1 ? 's' : ''} from YouTube
            </p>
          )}
        </>
      )}
    </div>
  );
});
