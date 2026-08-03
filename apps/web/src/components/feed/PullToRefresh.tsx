'use client';

/**
 * PullToRefresh — Premium pull-to-refresh with spring animation,
 * haptic-like visual feedback, and glowing refresh indicator.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PullToRefreshProps {
  onRefresh: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 80;
const MAX_PULL = 140;

export function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || containerRef.current === null) return;
      if (containerRef.current.scrollTop > 0) return;
      startYRef.current = e.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
    },
    [disabled],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pullingRef.current || isRefreshing) return;
      const currentY = e.touches[0]?.clientY ?? 0;
      const diff = currentY - startYRef.current;
      if (diff > 0) {
        // Apply damping — feels more natural
        const damped = Math.min(diff * 0.4, MAX_PULL);
        setPullDistance(damped);
        setPhase(damped > THRESHOLD ? 'ready' : 'pulling');
      }
    },
    [isRefreshing],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const diff = (e.changedTouches[0]?.clientY ?? 0) - startYRef.current;
      if (diff > THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        setPhase('refreshing');
        setPullDistance(48); // Show spinner
        onRefresh();
      } else {
        setPhase('idle');
        setPullDistance(0);
      }
    },
    [isRefreshing, onRefresh],
  );

  useEffect(() => {
    if (!isRefreshing) return;
    refreshTimeoutRef.current = setTimeout(() => {
      setIsRefreshing(false);
      setPhase('idle');
      setPullDistance(0);
    }, 2000);
    return () => clearTimeout(refreshTimeoutRef.current);
  }, [isRefreshing]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing || phase === 'refreshing') && (
        <div
          className="ptr-indicator"
          style={{
            height: isRefreshing ? 48 : pullDistance,
            opacity: phase === 'refreshing' ? 1 : Math.min(pullDistance / THRESHOLD, 1),
            transform: `scale(${1 + (pullDistance / MAX_PULL) * 0.05})`,
          }}
        >
          {phase === 'refreshing' ? (
            <div className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="ptr-arrow animate-ptr-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="30 70" />
              </svg>
              <span>Refreshing feed...</span>
            </div>
          ) : phase === 'ready' ? (
            <div className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="ptr-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <span>Release to refresh</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="ptr-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              <span>Pull to refresh</span>
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
