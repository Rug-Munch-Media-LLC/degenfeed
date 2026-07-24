/**
 * @degenfeed/web — MediaMasonryGrid
 *
 * Pinterest/Instagram-style masonry grid using CSS columns.
 * Handles variable aspect ratios, loading skeletons, and empty states.
 * Fully responsive: 1 col mobile, 2 cols tablet, 3-4 cols desktop.
 */

'use client';

import type { VisualPost } from '@degenfeed/types';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { MediaFilter } from './MediaTypes';
import { MEDIA_TABS } from './MediaTypes';

// ─── Props ───────────────────────────────────────────────────────

interface MediaMasonryGridProps {
  posts: VisualPost[];
  state: 'loading' | 'loaded' | 'empty' | 'error';
  error?: string;
  filter: MediaFilter;
  onPostClick: (post: VisualPost) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  /** Override number of skeleton cards */
  skeletonCount?: number;
  /** Render function for each card */
  renderCard: (post: VisualPost) => ReactNode;
}

// ─── Helpers ─────────────────────────────────────────────────────

function _clampAspectRatio(ar: number): number {
  'use client';
  return Math.min(Math.max(ar, 0.4), 3);
}

// ─── Masonry Grid ────────────────────────────────────────────────

export function MediaMasonryGrid({
  posts,
  state,
  error,
  filter,
  onPostClick,
  onRetry,
  onLoadMore,
  hasMore,
  loadingMore,
  skeletonCount = 12,
  renderCard,
}: MediaMasonryGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Infinite scroll with intersection observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || state !== 'loaded') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '600px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, state, onLoadMore]);

  // ── Loading state ──
  if (state === 'loading' && posts.length === 0) {
    return (
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
        {Array.from({ length: skeletonCount }).map((_, i) => {
          const heights = [200, 280, 240, 320, 260, 220, 300, 260, 240, 280, 200, 320];
          const height = heights[i % heights.length] ?? 240;
          return (
            <div
              key={`skeleton-${i}`}
              className="mb-3 animate-pulse break-inside-avoid overflow-hidden rounded-xl"
              style={{ height, backgroundColor: 'var(--color-card)' }}
            >
              <div className="skeleton-shimmer absolute inset-0" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-white/10" />
                  <div className="h-3 w-20 rounded bg-white/10" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Empty state ──
  if (state === 'empty') {
    const tab = MEDIA_TABS.find((t) => t.id === filter);
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl"
          style={{
            backgroundColor: 'var(--color-overlay)',
            color: 'var(--color-muted)',
          }}
        >
          {tab?.icon ?? '◆'}
        </div>
        <p className="mb-1 text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
          No {tab?.label.toLowerCase() ?? 'media'} yet
        </p>
        <p className="mb-4 max-w-xs text-center text-xs" style={{ color: 'var(--color-muted)' }}>
          Media content from all protocols will appear here. Sources include Bluesky, Pixelfed,
          Zora, Nostr, PeerTube, and more.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Error state ──
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="mb-2 text-sm font-medium text-red-400">Failed to load media</p>
        <p className="mb-4 max-w-xs text-center text-xs" style={{ color: 'var(--color-muted)' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Loaded state ──
  return (
    <div className="space-y-6">
      <div
        className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4"
        style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.3s ease' }}
      >
        {posts.map((post) => (
          <div
            key={post.id}
            className="mb-3 break-inside-avoid"
            style={{ animation: `fadeSlideUp 0.4s ease both` }}
          >
            {renderCard(post)}
          </div>
        ))}
      </div>

      {/* Loading more spinner */}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-accent)' }}>
            <svg
              aria-hidden="true"
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
              <path
                d="M12 2a10 10 0 0110 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            Loading more...
          </div>
        </div>
      )}

      {/* End-of-feed message */}
      {!hasMore && posts.length > 0 && (
        <p className="py-6 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
          You&apos;ve reached the end
        </p>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />
    </div>
  );
}
