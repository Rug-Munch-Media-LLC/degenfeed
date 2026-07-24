'use client';

/**
 * TipButton — Cross-platform tip button for visual posts.
 * Opens the unified tip modal for tipping in SOL, ETH, or USDC.
 */

import type { VisualPost } from '@degenfeed/types';
import { useCallback } from 'react';

interface TipButtonProps {
  post: VisualPost;
  onTip?: (post: VisualPost) => void;
  size?: 'sm' | 'md';
}

export function TipButton({ post, onTip, size = 'sm' }: TipButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onTip?.(post);
    },
    [post, onTip],
  );

  const _sizeClasses = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 rounded-full px-3 text-sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-1 rounded-full font-medium transition-all hover:scale-105 active:scale-95 ${
        size === 'sm'
          ? ''
          : 'border border-[var(--color-border)] bg-[var(--color-overlay)] hover:bg-[var(--color-card-hover)]'
      }`}
      style={{ color: 'var(--color-fg)' }}
      aria-label={`Tip ${post.author.displayName || 'creator'}`}
    >
      <svg
        width={size === 'sm' ? '12' : '16'}
        height={size === 'sm' ? '12' : '16'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      {size === 'md' && <span>Tip</span>}
    </button>
  );
}
