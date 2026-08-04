'use client';

/**
 * CollectButton — Creator coin buy button for visual posts.
 * Opens the creator coin purchase flow.
 */

import type { VisualPost } from '@degenfeed/types';
import { useCallback } from 'react';

interface CollectButtonProps {
  post: VisualPost;
  size?: 'sm' | 'md';
}

export function CollectButton({ post, size = 'sm' }: CollectButtonProps) {
  const handleCollect = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (post.collectUrl) {
        window.open(post.collectUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [post.collectUrl],
  );

  if (!post.collectUrl) return null;

  return (
    <button
      type="button"
      onClick={handleCollect}
      className={`inline-flex items-center justify-center gap-1 rounded-full font-medium transition-all hover:scale-105 active:scale-95 ${
        size === 'sm'
          ? ''
          : 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
      }`}
      aria-label="Collect creator coin"
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
        <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16l-6.4 5.2L8 14l-6-4.8h7.6z" />
      </svg>
      {size === 'md' && <span>Collect</span>}
    </button>
  );
}
