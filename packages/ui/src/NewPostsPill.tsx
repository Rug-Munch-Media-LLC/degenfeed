'use client';

/**
 * @degenfeed/ui — NewPostsPill
 *
 * "N new posts" floating pill that appears when new content is available.
 * Click to scroll to top and load new posts.
 * Auto-hides after scrolling or timeout.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';

export interface NewPostsPillProps {
  /** Number of new posts available */
  count: number;
  /** Called when user clicks the pill */
  onRefresh: () => void;
  /** Auto-hide timeout in ms (default: 8000) */
  timeout?: number;
  /** Label prefix (default: "New posts") */
  label?: string;
}

export const NewPostsPill = memo(function NewPostsPill({
  count,
  onRefresh,
  timeout = 8000,
  label = 'New posts',
}: NewPostsPillProps) {
  const [visible, setVisible] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevCountRef = useRef(0);

  // Show when count increases and we're not at the top
  useEffect(() => {
    if (count > prevCountRef.current && !isAtTop) {
      setVisible(true);
      // Auto-hide after timeout
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), timeout);
    }
    prevCountRef.current = count;
    return () => clearTimeout(timerRef.current);
  }, [count, isAtTop, timeout]);

  // Track scroll position
  useEffect(() => {
    const handler = () => {
      const atTop = window.scrollY < 100;
      setIsAtTop(atTop);
      if (atTop) setVisible(false);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onRefresh();
    setVisible(false);
    clearTimeout(timerRef.current);
  }, [onRefresh]);

  if (!visible || count === 0) return null;

  return (
    <div className="new-posts-pill-container">
      <button
        type="button"
        onClick={handleClick}
        className="new-posts-pill"
        aria-label={`${count} ${label}. Click to refresh.`}
      >
        <span className="new-posts-pill-arrow" aria-hidden="true">
          ↑
        </span>
        <span className="new-posts-pill-count">{count}</span>
        <span className="new-posts-pill-label">{label}</span>
      </button>
    </div>
  );
});
