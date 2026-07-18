'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LoadingBar } from '../components/LoadingBar';

/**
 * template.tsx — Provides page transition animations and the LoadingBar.
 *
 * Next.js re-mounts the template on every navigation, which makes it the
 * perfect place for:
 *  - Per-page fade-in transitions
 *  - LoadingBar coordination (emits df-nav-start / df-nav-finish events)
 *  - Network-bound progress estimation
 */

// ── Transition timing ───────────────────────────────────────────
const FADE_IN_DURATION = 200;   // ms — matching CSS
const MIN_LOADING_MS = 300;      // ms — minimum loading bar display

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}${searchParams?.toString() ?? ''}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);

  // ── Coordinate LoadingBar with page transitions ────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Emit nav-start for LoadingBar
    window.dispatchEvent(new CustomEvent('df-nav-start'));

    // The loading is "done" when the fade-in animation completes or when
    // content signals it's ready, whichever is later.
    const minTimer = setTimeout(() => {
      if (readyRef.current) {
        window.dispatchEvent(new CustomEvent('df-nav-finish'));
      }
    }, MIN_LOADING_MS);

    // Listen for content-ready events (emitted by pages after data fetch)
    const onContentReady = () => {
      readyRef.current = true;
      // Still wait for minimum loading time
    };
    window.addEventListener('df-content-ready', onContentReady);

    // Fade-in timeout — if content hasn't signaled ready by now, finish anyway
    const fadeTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('df-nav-finish'));
    }, FADE_IN_DURATION + 100);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(fadeTimer);
      window.removeEventListener('df-content-ready', onContentReady);
    };
  }, [key]);

  return (
    <>
      <LoadingBar />
      <div
        key={key}
        ref={containerRef}
        className="page-template-enter"
        style={{
          animation: `page-enter ${FADE_IN_DURATION}ms ease-out`,
        }}
      >
        {children}
      </div>
    </>
  );
}
