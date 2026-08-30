'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * LoadingBar — thin animated progress bar at the top of the viewport.
 *
 * Shows on route change start, animates to ~80%, then completes to 100%
 * when the page is ready. Green gradient to match DegenFeed brand.
 *
 * Uses DOM events emitted by `template.tsx` to coordinate start/finish.
 *
 * Bounded: an absolute cap (MAX_LOADING_MS) forces the bar to complete
 * even if `df-nav-finish` is never dispatched (e.g. a route whose fetch
 * hangs) — the bar can never crawl forever.
 */
const MAX_LOADING_MS = 6000; // absolute cap — force complete if no finish event

export function LoadingBar() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on route change
  useEffect(() => {
    setLoading(false);
    setProgress(0);
  }, []);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (capRef.current) clearTimeout(capRef.current);
    setProgress(100);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 200);
  }, []);

  const start = useCallback(() => {
    setLoading(true);
    setProgress(0);

    // Hard cap: never leave the bar crawling if finish never arrives
    if (capRef.current) clearTimeout(capRef.current);
    capRef.current = setTimeout(finish, MAX_LOADING_MS);

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
  }, [finish]);

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
      if (capRef.current) clearTimeout(capRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
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
