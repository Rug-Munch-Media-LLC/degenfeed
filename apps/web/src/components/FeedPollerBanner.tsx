'use client';

import { useEffect, useRef, useState } from 'react';

export interface FeedPollerBannerProps {
  /** Number of new posts to display */
  count: number;
  /** Called when the user clicks the banner to refresh */
  onRefresh: () => void;
}

/**
 * A subtle floating banner fixed at the top of the feed area.
 * Slides in when new posts are available, slides out on click or reset.
 * Respects `prefers-reduced-motion`.
 */
export function FeedPollerBanner({ count, onRefresh }: FeedPollerBannerProps) {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'exiting'>('hidden');
  const prevCountRef = useRef(0);
  const prefersReducedMotion = useRef(true);

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
    const timer = setTimeout(() => setPhase('hidden'), 300);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'hidden') return null;

  const reducedMotion = prefersReducedMotion.current;

  const slideInStyle: React.CSSProperties = reducedMotion
    ? {}
    : {
        animation: `${phase === 'visible' ? 'feedPollerSlideDown' : 'feedPollerSlideUp'} 0.3s ease-out forwards`,
      };

  return (
    <>
      {/* Inject keyframes once */}
      <style>{`
        @keyframes feedPollerSlideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes feedPollerSlideUp {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-100%); }
        }
      `}</style>

      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 z-50"
        style={{ top: `calc(4rem + 8px)`, ...slideInStyle }}
      >
        <button
          type="button"
          onClick={onRefresh}
          className="-translate-x-1/2 rounded-full border border-degen-500/40 bg-degen-500 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_24px_rgba(0,255,65,0.35)] transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-degen-300 focus:ring-offset-2 focus:ring-offset-black"
        >
          <span className="inline-flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <path
                d="M8 3v10M4 9l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {count} new {count === 1 ? 'post' : 'posts'}
          </span>
        </button>
      </div>
    </>
  );
}
