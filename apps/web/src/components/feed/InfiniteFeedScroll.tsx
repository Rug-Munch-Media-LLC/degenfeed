'use client';

/**
 * InfiniteFeedScroll — auto-loads the next page of the feed when the
 * sentinel scrolls into view. Shows a compact loading indicator while
 * fetching, and falls back to an explicit "Load more" button when the
 * IntersectionObserver API is unavailable (e.g. very old browsers).
 */

import { useEffect, useRef, useState } from 'react';

export interface InfiniteFeedScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  loading?: boolean;
  /** Called once the sentinel first becomes visible — useful to gate observers. */
  onIntersect?: () => void;
  children?: React.ReactNode;
}

export function InfiniteFeedScroll({
  onLoadMore,
  hasMore,
  loading = false,
  onIntersect,
  children,
}: InfiniteFeedScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(loading);
  const onLoadMoreRef = useRef(onLoadMore);
  const onIntersectRef = useRef(onIntersect);
  const [supportsObserver, setSupportsObserver] = useState(true);

  loadingRef.current = loading;
  onLoadMoreRef.current = onLoadMore;
  onIntersectRef.current = onIntersect;

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setSupportsObserver(false);
      return;
    }
    const el = sentinelRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) return;
          onIntersectRef.current?.();
          if (!loadingRef.current && hasMore) {
            onLoadMoreRef.current();
          }
        }
      },
      { rootMargin: '600px 0px', threshold: 0.01 },
    );
    observerRef.current.observe(el);
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [hasMore]);

  // Stop observing once there is nothing left to load.
  useEffect(() => {
    if (!hasMore) {
      observerRef.current?.disconnect();
    }
  }, [hasMore]);

  return (
    <div>
      {children}
      {hasMore && (
        <div ref={sentinelRef} aria-hidden="true" className="infinite-scroll-sentinel">
          {loading || !supportsObserver ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-xs text-[var(--color-muted)]">
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-ptr-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" strokeDasharray="30 70" />
                </svg>
                <span>Loading more posts…</span>
              </div>
              {!supportsObserver && (
                <button type="button" onClick={onLoadMore} className="btn-secondary text-sm">
                  Load more
                </button>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-[11px] text-[var(--color-muted)]" role="status">
              <span className="opacity-60">Scroll for more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InfiniteFeedScroll;
