'use client';

/**
 * VisualFeedGrid — CSS columns masonry grid for visual feed cards.
 * Uses CSS columns for natural masonry layout with staggered card heights.
 */

import { useCallback, useRef } from 'react';
import type { VisualPost } from '@degenfeed/types';
import { VisualFeedCard } from './VisualFeedCard';

interface VisualFeedGridProps {
  posts: VisualPost[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onTip?: (post: VisualPost) => void;
  onMint?: (post: VisualPost) => void;
  onCollect?: (post: VisualPost) => void;
  onLike?: (post: VisualPost) => void;
  onComment?: (post: VisualPost) => void;
  onRepost?: (post: VisualPost) => void;
}

export function VisualFeedGrid({
  posts,
  loading,
  hasMore,
  onLoadMore,
  onTip,
  onMint,
  onCollect,
  onLike,
  onComment,
  onRepost,
}: VisualFeedGridProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleImageLoad = useCallback(() => {
    // As images load, the masonry reflows naturally via CSS columns
  }, []);

  // Intersection observer for infinite scroll
  const sentinelCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore || loading) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            onLoadMore();
          }
        },
        { rootMargin: '200px' },
      );
      observerRef.current.observe(node);
    },
    [hasMore, loading, onLoadMore],
  );

  if (posts.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-4 opacity-30">📷</div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
          No visual content yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted)', opacity: 0.7 }}>
          Posts with photos and videos from connected platforms will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* CSS columns masonry — 2 cols mobile, 3 cols tablet, 4 cols desktop */}
      <div
        className="columns-2 gap-0 sm:columns-3 lg:columns-4 xl:columns-5"
        style={{ columnGap: '16px' }}
      >
        {posts.map((post, index) => (
          <div key={post.id} style={{ breakInside: 'avoid' }}>
            <VisualFeedCard
              post={post}
              onTip={onTip}
              onMint={onMint}
              onCollect={onCollect}
              onLike={onLike}
              onComment={onComment}
              onRepost={onRepost}
              onImageLoad={handleImageLoad}
              priority={index < 6}
            />
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-muted)' }}>
            <svg
              className="animate-spin"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <span>Loading visual content...</span>
          </div>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && !loading && (
        <div ref={sentinelCallback} className="h-4" />
      )}

      {/* End of feed */}
      {!hasMore && posts.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <p className="text-xs" style={{ color: 'var(--color-muted)', opacity: 0.6 }}>
            You&apos;ve reached the end
          </p>
        </div>
      )}
    </div>
  );
}
