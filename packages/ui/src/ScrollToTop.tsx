'use client';

import { memo, useEffect, useState } from 'react';

/**
 * Floating scroll-to-top button with circular progress indicator.
 * Appears after scrolling down past the threshold.
 *
 * @param thresholdPages — Number of viewport-heights to scroll before showing (default 3)
 */
export const ScrollToTop = memo(function ScrollToTop({
  thresholdPages = 3,
}: {
  thresholdPages?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
      setProgress(pct);
      setVisible(scrollTop > window.innerHeight * thresholdPages);
    };
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, [thresholdPages]);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const circumference = 2 * Math.PI * 16; // r=16
  const dashOffset = circumference * (1 - progress);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`scroll-to-top ${visible ? 'visible' : ''}`}
      aria-label="Scroll to top"
      title={`${Math.round(progress * 100)}% read — back to top`}
    >
      <svg className="progress-ring" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r="16"
          stroke="var(--color-glass-border)"
          strokeWidth="2.5"
          fill="none"
        />
        <circle
          cx="22"
          cy="22"
          r="16"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
      </svg>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="absolute"
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
});
