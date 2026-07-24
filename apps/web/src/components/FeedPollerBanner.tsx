'use client';

import { useEffect, useRef, useState } from 'react';

export interface FeedPollerBannerProps {
  /** Number of new posts to display */
  count: number;
  /** Called when the user clicks the banner to refresh */
  onRefresh: () => void;
}

/**
 * A premium floating banner fixed at the top of the feed area.
 * Slides in with a spring-like animation when new posts are available,
 * slides out when dismissed. Respects `prefers-reduced-motion`.
 */
export function FeedPollerBanner({ count, onRefresh }: FeedPollerBannerProps) {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'exiting'>('hidden');
  const prevCountRef = useRef(0);
  const prefersReducedMotion = useRef(false);

  // Read the prefers-reduced-motion media query once on mount
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (count > 0 && prevCountRef.current === 0) {
      // New posts arrived — animate in
      setPhase('visible');
    } else if (count === 0 && prevCountRef.current > 0) {
      // Reset — animate out
      setPhase('exiting');
    }
    prevCountRef.current = count;
  }, [count]);

  // After exit animation completes, stay hidden
  useEffect(() => {
    if (phase !== 'exiting') return;
    const timer = setTimeout(() => setPhase('hidden'), 350);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'hidden') return null;

  const reducedMotion = prefersReducedMotion.current;

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="feed-poller-banner">
      <button
        type="button"
        onClick={onRefresh}
        className={`
          feed-poller-banner-btn
          ${reducedMotion ? '' : phase === 'visible' ? 'banner-enter' : 'banner-exit'}
        `}
      >
        <span className="banner-content">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="banner-icon"
          >
            <path
              d="M8 3v10M4 9l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="banner-text">
            {count} new {count === 1 ? 'post' : 'posts'}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="banner-chevron"
          >
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    </div>
  );
}
