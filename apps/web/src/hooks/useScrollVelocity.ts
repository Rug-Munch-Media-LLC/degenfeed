'use client';

import { useEffect, useRef, useState } from 'react';

export type ScrollPace = 'idle' | 'browsing' | 'fast' | 'racing';

export interface ScrollVelocity {
  /** Current scroll pace classification */
  pace: ScrollPace;
  /** Raw velocity in pixels/second (smoothed) */
  velocityPxPerSec: number;
  /** Average dwell time on visible posts in ms */
  avgDwellMs: number;
  /** Reset counters (call when feed resets/explicitly) */
  reset: () => void;
}

/**
 * Tracks scroll velocity and dwell time per post to classify user
 * reading behaviour. Used for boredom detection — fast scrolling
 * triggers more discovery content, slow scrolling surfaces more
 * of the same type.
 *
 * @param thresholdFast — px/s above which is considered "fast" (default 800)
 * @param thresholdRacing — px/s above which is considered "racing" (default 2000)
 */
export function useScrollVelocity(thresholdFast = 800, thresholdRacing = 2000): ScrollVelocity {
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const velocityRef = useRef(0);
  const smoothVelocityRef = useRef(0);
  const frRef = useRef(0);
  const [pace, setPace] = useState<ScrollPace>('idle');
  const [velocityPxPerSec, setVelocityPxPerSec] = useState(0);
  const [avgDwellMs, setAvgDwellMs] = useState(0);

  // Dwell tracking: record timestamps as posts enter/leave viewport
  const visiblePostsRef = useRef<Map<string, number>>(new Map());
  const dwellSamplesRef = useRef<number[]>([]);

  /**
   * Call this when a post enters the viewport.
   * Pass the post id and a unique key for dedup.
   */
  const onPostVisible = (postId: string) => {
    if (!visiblePostsRef.current.has(postId)) {
      visiblePostsRef.current.set(postId, performance.now());
    }
  };

  /**
   * Call this when a post leaves the viewport.
   */
  const onPostHidden = (postId: string) => {
    const entered = visiblePostsRef.current.get(postId);
    if (entered) {
      const dwell = performance.now() - entered;
      if (dwell > 50 && dwell < 60_000) {
        // Sanity: ignore <50ms flickers and >60s AFK
        dwellSamplesRef.current.push(dwell);
        // Keep last 50 samples
        if (dwellSamplesRef.current.length > 50) {
          dwellSamplesRef.current.shift();
        }
      }
      visiblePostsRef.current.delete(postId);
    }
  };

  // Scroll velocity tracking
  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;
      frRef.current = requestAnimationFrame(tick);

      const now = performance.now();
      const dt = now - lastTimeRef.current;
      if (dt < 50) return; // Throttle to ~20fps

      const currentY = window.scrollY;
      const dy = Math.abs(currentY - lastYRef.current);

      // Compute instantaneous velocity
      const v = dt > 0 ? (dy / dt) * 1000 : 0;
      velocityRef.current = v;

      // EMA smoothing (α = 0.25 for responsiveness)
      const alpha = 0.25;
      smoothVelocityRef.current =
        smoothVelocityRef.current === 0 ? v : alpha * v + (1 - alpha) * smoothVelocityRef.current;

      const smoothed = smoothVelocityRef.current;

      // Classify pace
      let newPace: ScrollPace = 'idle';
      if (smoothed > thresholdRacing) {
        newPace = 'racing';
      } else if (smoothed > thresholdFast) {
        newPace = 'fast';
      } else if (smoothed > 50) {
        newPace = 'browsing';
      }

      setPace(newPace);
      setVelocityPxPerSec(Math.round(smoothed));

      // Compute average dwell
      const samples = dwellSamplesRef.current;
      if (samples.length > 0) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        setAvgDwellMs(Math.round(avg));
      }

      lastYRef.current = currentY;
      lastTimeRef.current = now;
    };

    frRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      if (frRef.current) cancelAnimationFrame(frRef.current);
    };
  }, [thresholdFast, thresholdRacing]);

  const reset = () => {
    dwellSamplesRef.current = [];
    visiblePostsRef.current.clear();
    smoothVelocityRef.current = 0;
    setPace('idle');
    setVelocityPxPerSec(0);
    setAvgDwellMs(0);
  };

  return {
    pace,
    velocityPxPerSec,
    avgDwellMs,
    reset,
    // Expose for IntersectionObserver callbacks
    _onPostVisible: onPostVisible,
    _onPostHidden: onPostHidden,
  };
}
