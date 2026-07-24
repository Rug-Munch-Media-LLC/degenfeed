/**
 * @degenfeed/ui — Lemmy Thread View Hooks
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { SwipeHandlers } from './lemmy-types';

// ─── IntersectionObserver hook for lazy loading ─────────────────────

export function useInView(
  ref: React.RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { rootMargin: '200px', threshold: 0, ...options },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, options]);

  return inView;
}

// ─── Swipe gesture detection hook ───────────────────────────────────

export function useSwipeGestures(
  ref: React.RefObject<HTMLElement | null>,
  handlers: SwipeHandlers,
  threshold = 60,
): void {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (t) touchStart.current = { x: t.clientX, y: t.clientY };
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      touchStart.current = null;

      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;

      if (dx < 0) handlers.onSwipeLeft?.();
      else handlers.onSwipeRight?.();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref, handlers, threshold]);
}
