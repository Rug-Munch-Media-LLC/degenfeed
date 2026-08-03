'use client';

/**
 * MintButton — Zora mint button for NFT visual posts.
 * Opens the Zora mint flow in a new tab or modal.
 */

import type { VisualPost } from '@degenfeed/types';
import { useCallback } from 'react';

interface MintButtonProps {
  post: VisualPost;
  size?: 'sm' | 'md';
}

export function MintButton({ post, size = 'sm' }: MintButtonProps) {
  const handleMint = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (post.mintUrl) {
        window.open(post.mintUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [post.mintUrl],
  );

  if (!post.isNFT || !post.mintUrl) return null;


  return (
    <button
      type="button"
      onClick={handleMint}
      className={`inline-flex items-center justify-center gap-1 rounded-full font-medium transition-all hover:scale-105 active:scale-95 ${
        size === 'sm'
          ? ''
          : 'border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
      }`}
      aria-label={`Mint ${post.collectionName || 'NFT'}`}
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
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 8v8M8 12h8" />
      </svg>
      {size === 'md' && <span>Mint</span>}
    </button>
  );
}
