'use client';

/**
 * @degenfeed/web — YouTubeShortsFeed
 *
 * Horizontal scrollable feed of YouTube Shorts cards.
 * Clearly labeled as YouTube content — not PeerTube.
 * Touch/swipe friendly for mobile.
 */

import { memo, useRef, useState } from 'react';
import type { YouTubeShort } from './useYouTube';
import { YouTubeShortsCard } from './YouTubeShortsCard';

// === Types ===============================================================

export interface YouTubeShortsFeedProps {
  /** Array of YouTube Shorts */
  shorts: YouTubeShort[];
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Section title */
  title?: string;
  /** Called when a short is clicked */
  onPlay?: (short: YouTubeShort) => void;
}

// === Category selector ===================================================

const SHORTS_CATEGORIES = [
  { id: 'crypto', label: 'Crypto', emoji: '\uD83E\uDE99' },
  { id: 'trending', label: 'Trending', emoji: '\uD83D\uDD25' },
  { id: 'gaming', label: 'Gaming', emoji: '\uD83C\uDFAE' },
  { id: 'music', label: 'Music', emoji: '\uD83C\uDFB5' },
  { id: 'comedy', label: 'Comedy', emoji: '\uD83D\uDE02' },
  { id: 'education', label: 'Education', emoji: '\uD83D\uDCDA' },
];

// === Component ===========================================================

export const YouTubeShortsFeed = memo(function YouTubeShortsFeed({
  shorts,
  loading = false,
  error = null,
  title = 'YouTube Shorts',
  onPlay,
}: YouTubeShortsFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -400 : 400;
    el.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScroll, 300);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-[var(--color-fg)] flex items-center gap-2">
          <span className="text-pink-500">{'\uD83D\uDCBF'}</span>
          {title}
          <span className="text-[11px] font-normal text-[var(--color-muted)] ml-1">YouTube</span>
        </h2>
        {/* Scroll buttons (desktop) */}
        <div className="hidden md:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="rounded-full p-1.5 border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-30 transition-colors focus:outline-none"
            aria-label="Scroll left"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18L9 12L15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="rounded-full p-1.5 border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-30 transition-colors focus:outline-none"
            aria-label="Scroll right"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18L15 12L9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-3 rounded-lg border border-red-900/30 bg-red-950/20 px-4 py-2 text-xs text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-44 md:w-52 aspect-[9/16] rounded-xl bg-[var(--color-card)] border border-[var(--color-glass-border)] animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Shorts scrollable row */}
      {!loading && shorts.length > 0 && (
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
            onScroll={checkScroll}
          >
            {shorts.map((short) => (
              <div key={`short-${short.id}`} className="snap-start flex-shrink-0">
                <YouTubeShortsCard short={short} onPlay={onPlay} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && shorts.length === 0 && !error && (
        <div className="flex items-center justify-center py-8 text-sm text-[var(--color-muted)]">
          No Shorts available right now.
        </div>
      )}
    </div>
  );
});

export { SHORTS_CATEGORIES };
