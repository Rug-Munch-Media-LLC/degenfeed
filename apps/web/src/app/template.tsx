'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LoadingBar } from '../components/LoadingBar';

/**
 * template.tsx — Provides page transition animations and the LoadingBar.
 *
 * Next.js re-mounts the template on every navigation, which makes it the
 * perfect place for:
 *  - Per-page crossfade transitions
 *  - LoadingBar coordination (emits df-nav-start / df-nav-finish events)
 *  - Network-bound progress estimation
 *
 * Crossfade approach: The previous page content is preserved via a pending
 * render while the new page fades in, preventing jarring white flashes.
 */

// ── Transition timing ───────────────────────────────────────────
const FADE_IN_DURATION = 350; // ms — matching CSS crossfade duration
const MIN_LOADING_MS = 300; // ms — minimum loading bar display

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}${searchParams?.toString() ?? ''}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const [prevChildren, setPrevChildren] = useState<React.ReactNode>(null);
  const [exiting, setExiting] = useState(false);

  // ── Crossfade: keep previous content visible while new one enters ──
  const childrenRef = useRef(children);
  useEffect(() => {
    // When key changes, capture current children to show during exit
    setPrevChildren(childrenRef.current);
    childrenRef.current = children;
    setExiting(true);

    const timer = setTimeout(() => {
      setExiting(false);
      setPrevChildren(null);
    }, 250); // exit animation duration

    return () => clearTimeout(timer);
    // Only run on key change to prevent re-render loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

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
    // Re-run on key changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <LoadingBar />
      <div style={{ position: 'relative' }}>
        {/* Exiting page — fades out */}
        {exiting && prevChildren && (
          <div className="page-crossfade-exit" aria-hidden="true">
            {prevChildren}
          </div>
        )}
        {/* Entering page — fades in */}
        <div
          key={key}
          ref={containerRef}
          className="page-crossfade-enter"
          style={{
            animation: `page-crossfade-in ${FADE_IN_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
