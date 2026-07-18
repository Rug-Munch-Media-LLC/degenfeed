'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tracks scroll progress through a specific element (e.g. a long post).
 * Returns a value 0–1 representing how much of the target has been scrolled.
 *
 * @param targetId - The `id` of the element to track.
 * @param enabled - Whether tracking is active (e.g. post is expanded).
 */
export function useReadingProgress(targetId: string | null, enabled = true): number {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!targetId || !enabled) {
      setProgress(0);
      return;
    }

    const target = document.getElementById(targetId);
    if (!target) return;

    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const totalHeight = rect.height;
        const viewportHeight = window.innerHeight;
        const scrolled = -rect.top;

        // Calculate progress: 0 when top of post enters viewport, 1 when bottom leaves
        const totalScrollable = totalHeight + viewportHeight;
        const currentProgress = Math.min(
          Math.max((scrolled + viewportHeight * 0.3) / totalScrollable, 0),
          1,
        );
        setProgress(currentProgress);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetId, enabled]);

  return progress;
}
