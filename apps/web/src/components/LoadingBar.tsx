'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * LoadingBar — thin animated progress bar at the top of the viewport.
 *
 * Shows on route change start, animates to ~80%, then completes to 100%
 * when the page is ready. Green gradient to match DegenFeed brand.
 *
 * Uses DOM events emitted by `template.tsx` to coordinate start/finish.
 */
export function LoadingBar() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const _pathname = usePathname();
  const _searchParams = useSearchParams();

  // Reset on route change
  useEffect(() => {
    setLoading(false);
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    setLoading(true);
    setProgress(0);

    // Quick ramp to ~30%, then slower to 80%
    let p = 0;
    timerRef.current = setInterval(() => {
      if (p < 30) {
        p += 8; // fast initial burst
      } else if (p < 80) {
        p += 2 + Math.random() * 3; // slow crawl
      } else {
        // hold at 80% until complete
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setProgress(Math.min(p, 80));
    }, 150);
  }, []);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    // Brief pause at 100% then hide
    setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 200);
  }, []);

  // Listen for page-transition events emitted by template.tsx
  useEffect(() => {
    const onStart = () => start();
    const onFinish = () => finish();
    window.addEventListener('df-nav-start', onStart);
    window.addEventListener('df-nav-finish', onFinish);
    return () => {
      window.removeEventListener('df-nav-start', onStart);
      window.removeEventListener('df-nav-finish', onFinish);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [start, finish]);

  if (!loading && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[3px]"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading"
    >
      <div
        className="h-full animate-loading-bar"
        style={{
          width: `${progress}%`,
          boxShadow: '0 0 10px rgba(0, 255, 65, 0.5), 0 0 20px rgba(0, 255, 65, 0.2)',
        }}
      />
    </div>
  );
}
