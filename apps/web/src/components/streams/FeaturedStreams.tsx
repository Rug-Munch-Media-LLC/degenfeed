'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveStreamCard } from './LiveStreamCard';
import type { LiveStream } from './useLiveStreams';

/* === Types ==================================================== */

interface FeaturedStreamsProps {
  streams: LiveStream[];
  isLoading?: boolean;
  onPlay?: (stream: LiveStream) => void;
}

/* === Scroll arrow button ====================================== */

function ScrollArrow({
  direction,
  onClick,
  hidden,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
  hidden: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-2 text-[var(--color-muted)] shadow-lg backdrop-blur-xl transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-fg)] ${
        direction === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
      } ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      aria-label={`Scroll ${direction}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={direction === 'right' ? '' : ''}
      >
        <polyline points={direction === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
      </svg>
    </button>
  );
}

/* === Featured section skeleton ================================ */

function FeaturedSkeleton() {
  return (
    <div className="flex gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="w-80 shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]"
        >
          <div className="aspect-video skeleton" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-3/4 skeleton rounded" />
            <div className="h-3 w-1/2 skeleton rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* === Component ================================================ */

export function FeaturedStreams({ streams, isLoading = false, onPlay }: FeaturedStreamsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollButtons);
  }, [updateScrollButtons, streams]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <section aria-label="Featured streams" className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            ⭐
          </span>
          <h2 className="text-base font-bold text-[var(--color-fg)]">Featured Streams</h2>
        </div>
        <FeaturedSkeleton />
      </section>
    );
  }

  if (streams.length === 0) return null;

  return (
    <section aria-label="Featured streams" className="mb-8">
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/10 text-sm">
            ⭐
          </span>
          <div>
            <h2 className="text-base font-bold text-[var(--color-fg)]">Featured Streams</h2>
            <p className="text-[10px] text-[var(--color-muted)]">
              Top streams picked by the community
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal scrollable carousel */}
      <div className="relative">
        <ScrollArrow direction="left" onClick={() => scroll('left')} hidden={!canScrollLeft} />

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none scroll-smooth"
          onScroll={updateScrollButtons}
        >
          {streams.map((stream, index) => (
            <div
              key={stream.id}
              className="w-72 shrink-0 sm:w-80"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <LiveStreamCard stream={stream} featured onPlay={onPlay} />
            </div>
          ))}
        </div>

        <ScrollArrow direction="right" onClick={() => scroll('right')} hidden={!canScrollRight} />
      </div>
    </section>
  );
}
