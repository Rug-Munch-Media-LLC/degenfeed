/**
 * @degenfeed/web — Bluesky Media View Hooks
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Pull-to-Refresh ─────────────────────────────────────────────

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [state, setState] = useState<PullState>('idle');
  const pullStartY = useRef(0);
  const pullDist = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 10) return;
    const touch = e.touches[0];
    if (!touch) return;
    pullStartY.current = touch.clientY;
    pullDist.current = 0;
    setState('pulling');
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (state === 'idle' || state === 'refreshing') return;
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - pullStartY.current;
      if (dy < 0) {
        setState('idle');
        return;
      }
      pullDist.current = dy;
      setState(dy > 80 ? 'ready' : 'pulling');
    },
    [state],
  );

  const handleTouchEnd = useCallback(async () => {
    if (state === 'ready') {
      setState('refreshing');
      try {
        await onRefresh();
      } finally {
        setState('idle');
      }
    } else {
      setState('idle');
    }
    pullDist.current = 0;
  }, [state, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, pullState: state, pullDistance: pullDist.current };
}

export type { PullState };
