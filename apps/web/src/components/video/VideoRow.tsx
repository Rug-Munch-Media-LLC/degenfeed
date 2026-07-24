'use client';

/**
 * @degenfeed/web — VideoRow
 *
 * Netflix-style horizontal scrollable row of video cards.
 * Features: title + optional "See all" link, left/right scroll buttons,
 * smooth scrolling, card snap alignment.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnifiedVideo } from './useVideoHub';
import { VideoCard } from './VideoCard';

interface VideoRowProps {
  title: string;
  videos: UnifiedVideo[];
  href?: string; // "See all" link target
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingCount?: number;
  onPlay?: (video: UnifiedVideo) => void;
  onSave?: (video: UnifiedVideo) => void;
  showChannel?: boolean;
  className?: string;
}

export function VideoRow({
  title,
  videos,
  href,
  size = 'md',
  loading = false,
  loadingCount = 8,
  onPlay,
  onSave,
  showChannel = true,
  className = '',
}: VideoRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  const scrollBy = useCallback(
    (direction: 'left' | 'right') => {
      const el = scrollRef.current;
      if (!el) return;
      const cardWidth = size === 'sm' ? 200 : size === 'md' ? 272 : 336;
      const gap = 16;
      const scrollAmount = (cardWidth + gap) * 2;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    },
    [size],
  );

  return (
    <section className={`relative ${className}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-[var(--color-fg)]">{title}</h2>
        {href && videos.length > 0 && (
          <Link
            href={href}
            className="text-xs font-medium text-degen-500 hover:text-degen-400 transition-colors"
          >
            See all &rarr;
          </Link>
        )}
      </div>

      {/* Scroll container */}
      <div className="group relative">
        {/* Left fade + button */}
        {canScrollLeft && (
          <>
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-[var(--color-bg)] to-transparent" />
            <button
              type="button"
              onClick={() => scrollBy('left')}
              className="absolute left-1 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-card)]/90 text-[var(--color-fg)] shadow-lg backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-card)]"
              aria-label="Scroll left"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </>
        )}

        {/* Videos row */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-none pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory' }}
        >
          {loading
            ? Array.from({ length: loadingCount }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className={`shrink-0 animate-pulse ${size === 'sm' ? 'w-48' : size === 'md' ? 'w-64' : 'w-80'}`}
                >
                  <div className="aspect-video mb-2 rounded-xl bg-[var(--color-card)]" />
                  <div className="flex gap-2">
                    <div className="h-7 w-7 shrink-0 rounded-full bg-[var(--color-card)]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-[var(--color-card)]" />
                      <div className="h-2 w-1/2 rounded bg-[var(--color-card)]" />
                    </div>
                  </div>
                </div>
              ))
            : videos.map((video) => (
                <div key={video.id} className="shrink-0" style={{ scrollSnapAlign: 'start' }}>
                  <VideoCard
                    video={video}
                    size={size}
                    onPlay={onPlay}
                    onSave={onSave}
                    showChannel={showChannel}
                  />
                </div>
              ))}
        </div>

        {/* Right fade + button */}
        {canScrollRight && (
          <>
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-[var(--color-bg)] to-transparent" />
            <button
              type="button"
              onClick={() => scrollBy('right')}
              className="absolute right-1 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-card)]/90 text-[var(--color-fg)] shadow-lg backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-card)]"
              aria-label="Scroll right"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}
      </div>
    </section>
  );
}
