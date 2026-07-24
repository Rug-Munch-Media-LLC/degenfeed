'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* === Breakpoints ======================================= */

export const BREAKPOINTS = {
  xs: 320,
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1440,
} as const;

/* === Mobile Detection ================================== */

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < BREAKPOINTS.md);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

/* === Safe Area Insets ================================== */

export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

  useEffect(() => {
    const update = () => {
      const style = getComputedStyle(document.documentElement);
      setSafeArea({
        top: Number.parseFloat(style.getPropertyValue('--sat') || '0'),
        bottom: Number.parseFloat(style.getPropertyValue('--sab') || '0'),
        left: Number.parseFloat(style.getPropertyValue('--sal') || '0'),
        right: Number.parseFloat(style.getPropertyValue('--sar') || '0'),
      });
    };
    update();
    // Also listen for orientation changes
    window.addEventListener('orientationchange', () => setTimeout(update, 100));
    return () => window.removeEventListener('orientationchange', update);
  }, []);

  return safeArea;
}

/* === Keyboard Avoidance ================================ */

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  const initialViewport = useRef(typeof window !== 'undefined' ? window.innerHeight : 0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const diff = initialViewport.current - window.innerHeight;
      // Only count significant differences as keyboard
      if (diff > 100) {
        setHeight(diff);
      } else {
        setHeight(0);
      }
    };

    // Use visualViewport API when available (more accurate)
    if (window.visualViewport) {
      const onViewport = () => {
        const diff = initialViewport.current - window.visualViewport?.height;
        setHeight(diff > 100 ? diff : 0);
      };
      window.visualViewport.addEventListener('resize', onViewport);
      return () => window.visualViewport?.removeEventListener('resize', onViewport);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return height;
}

/* === Pull-to-Refresh =================================== */

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || refreshing) return;
      // Only enable at top of scroll
      if (containerRef.current && containerRef.current.scrollTop > 0) return;
      startY.current = e.touches[0]?.clientY;
      pulling.current = true;
    },
    [disabled, refreshing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling.current || disabled || refreshing) return;
      const diff = e.touches[0]?.clientY - startY.current;
      if (diff > 0) {
        // Apply resistance
        setPullDistance(Math.min(diff * 0.4, threshold * 1.5));
      }
    },
    [disabled, refreshing, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold && !disabled) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, disabled, onRefresh]);

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

  return {
    containerRef,
    pullDistance,
    refreshing,
    pullProgress: Math.min(pullDistance / threshold, 1),
  };
}

/* === Swipe to Dismiss ================================== */

interface SwipeDismissOptions {
  onDismiss: () => void;
  threshold?: number;
  disabled?: boolean;
}

export function useSwipeDismiss({
  onDismiss,
  threshold = 100,
  disabled = false,
}: SwipeDismissOptions) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;
      startX.current = e.touches[0]?.clientX;
      startY.current = e.touches[0]?.clientY;
      swiping.current = true;
    },
    [disabled],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!swiping.current || disabled) return;
      const dx = e.touches[0]?.clientX - startX.current;
      const dy = e.touches[0]?.clientY - startY.current;
      // Only horizontal swipes
      if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
        setSwipeOffset(dx);
      }
    },
    [disabled],
  );

  const handleTouchEnd = useCallback(() => {
    if (!swiping.current) return;
    swiping.current = false;
    if (swipeOffset > threshold) {
      onDismiss();
    }
    setSwipeOffset(0);
  }, [swipeOffset, threshold, onDismiss]);

  useEffect(() => {
    const el = elementRef.current;
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

  return { elementRef, swipeOffset };
}

/* === Responsive Font Size ============================== */

export function responsiveFont(base: number, min: number, max: number): string {
  return `clamp(${min}px, ${base}px + 0.5vw, ${max}px)`;
}

/* === Virtual Keyboard Input Focus ====================== */

export function useKeyboardAwareInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (keyboardHeight > 0 && inputRef.current) {
      // Scroll input into view
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [keyboardHeight]);

  return inputRef;
}

/* === Intersection Observer for Lazy Loading ============ */

export function useLazyLoad(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', ...options },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isVisible };
}
