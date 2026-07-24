'use client';

/**
 * PullToRefresh — Mobile pull-to-refresh wrapper.
 *
 * Detects pull-down gesture at the top of the feed and triggers onRefresh.
 * Shows a visual indicator during the pull.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PullToRefreshProps {
  onRefresh: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 80; // px

export function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

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
        // Apply damping
        setPullDistance(Math.min(diff * 0.5, 120));
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
        setPullDistance(0);
        onRefresh();
      } else {
        setPullDistance(0);
      }
    },
    [isRefreshing, onRefresh],
  );

  // Reset refresh state after 2s
  useEffect(() => {
    if (!isRefreshing) return;
    const timeout = setTimeout(() => setIsRefreshing(false), 2000);
    return () => clearTimeout(timeout);
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
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center transition-all"
          style={{
            height: isRefreshing ? 40 : pullDistance,
            opacity: Math.min(pullDistance / THRESHOLD, 1),
          }}
        >
          {isRefreshing ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          ) : (
            <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
              {pullDistance > THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
