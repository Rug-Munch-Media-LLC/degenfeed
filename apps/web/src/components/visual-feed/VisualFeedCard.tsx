'use client';

/**
 * VisualFeedCard — Single card in the visual feed masonry grid.
 * Shows media with hover overlay actions, protocol badge, and creator info.
 */

import type { VisualPost } from '@degenfeed/types';
import { useCallback, useRef } from 'react';
import { CardOverlay } from './CardOverlay';
import { MediaRenderer } from './MediaRenderer';

interface VisualFeedCardProps {
  post: VisualPost;
  onTip?: (post: VisualPost) => void;
  onMint?: (post: VisualPost) => void;
  onCollect?: (post: VisualPost) => void;
  onLike?: (post: VisualPost) => void;
  onComment?: (post: VisualPost) => void;
  onRepost?: (post: VisualPost) => void;
  onImageLoad?: () => void;
  priority?: boolean;
}

export function VisualFeedCard({
  post,
  onTip,
  onMint,
  onCollect,
  onLike,
  onComment,
  onRepost,
  onImageLoad,
}: VisualFeedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    // Open the post in the appropriate viewer
    if (post.url) {
      window.open(post.url, '_blank', 'noopener,noreferrer');
    }
  }, [post.url]);

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-xl bg-[var(--color-card-bg)] transition-all duration-200 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
      style={{
        border: '1px solid var(--color-glass-border)',
        breakInside: 'avoid',
        marginBottom: '16px',
      }}
    >
      {/* Click to open original */}
      <button
        type="button"
        onClick={handleClick}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-degen-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card-bg)] rounded-xl"
        aria-label={`View post by ${post.author.displayName || 'creator'}`}
      >
        {/* Media */}
        <MediaRenderer
          imageUrl={post.imageUrl}
          videoUrl={post.videoUrl}
          alt={post.text || `Visual post from ${post.author.displayName || post.sourceLabel}`}
          aspectRatio={post.aspectRatio || 4 / 3}
          mediaType={post.mediaType}
          blurHash={post.blurHash}
          isNFT={post.isNFT}
          onLoad={onImageLoad}
        />

        {/* Overlay with actions (desktop hover, mobile tap) */}
        <CardOverlay
          post={post}
          onTip={onTip}
          onMint={onMint}
          onCollect={onCollect}
          onLike={onLike}
          onComment={onComment}
          onRepost={onRepost}
        />
      </button>

      {/* Bottom info bar (always visible on mobile, visible on hover desktop) */}
      <div className="flex items-center justify-between px-3 py-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 min-w-0">
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt=""
              className="h-5 w-5 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-overlay)] text-[8px] font-bold text-[var(--color-muted)]">
              {post.author.displayName?.[0] ?? '?'}
            </div>
          )}
          <span className="truncate text-[11px] font-medium text-[var(--color-fg)]">
            {post.author.displayName || 'Anonymous'}
          </span>
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{
              backgroundColor: `${post.sourceColor}18`,
              color: post.sourceColor,
              border: `1px solid ${post.sourceColor}30`,
            }}
          >
            <span aria-hidden="true">{post.sourceBadge}</span>
            <span className="sr-only">{post.sourceLabel}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Compact action buttons */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLike?.(post);
            }}
            className="text-[var(--color-muted)] hover:text-red-400 transition-colors"
            aria-label="Like"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTip?.(post);
            }}
            className="text-[var(--color-muted)] hover:text-yellow-400 transition-colors"
            aria-label="Tip"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
