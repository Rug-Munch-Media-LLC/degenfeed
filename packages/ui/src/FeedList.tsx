/**
 * @degenfeed/ui — FeedList
 *
 * Scrollable list of PostCards with loading, empty, and error states.
 * Supports infinite scroll, pull-to-refresh, protocol filtering, and
 * virtualized rendering (only visible posts are in the DOM).
 *
 * States:
 *   loading  → Skeleton cards (animated pulses)
 *   loaded   → PostCard list (virtualized)
 *   empty    → Illustration + message + CTA
 *   error    → Error message + retry button
 */

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type EngageHandler, PostCard } from './PostCard';

export type { UnifiedPost };

export type FeedState = 'loading' | 'loaded' | 'empty' | 'error';

export interface FeedListProps {
  state: FeedState;
  posts: UnifiedPost[];
  error?: string;
  protocolLabel?: string;
  protocolColor?: string;
  onRetry?: () => void;
  onPostClick?: (postId: string) => void;
  onTip?: (post: UnifiedPost) => void;
  onEngage?: EngageHandler;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const CARD_HEIGHT = 200;
const OVERSCAN = 4;

function SkeletonCard() {
  return (
    <div className="card animate-pulse" style={{ height: CARD_HEIGHT }}>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-gray-800" />
        <div className="flex-1">
          <div className="mb-1 h-3 w-32 rounded bg-gray-800" />
          <div className="h-2 w-20 rounded bg-gray-800" />
        </div>
      </div>
      <div className="mb-2 space-y-1.5">
        <div className="h-3 w-full rounded bg-gray-800" />
        <div className="h-3 w-4/5 rounded bg-gray-800" />
        <div className="h-3 w-3/5 rounded bg-gray-800" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-12 rounded bg-gray-800" />
        <div className="h-3 w-12 rounded bg-gray-800" />
        <div className="h-3 w-12 rounded bg-gray-800" />
      </div>
    </div>
  );
}

function EmptyState({ protocolLabel }: { protocolLabel?: string }) {
  return (
    <div className="card py-16 text-center">
      <div className="mb-4 text-5xl opacity-30">{protocolLabel ? '○' : '◆'}</div>
      <p className="mb-2 text-gray-500">
        {protocolLabel ? `No ${protocolLabel} posts yet` : 'No posts yet'}
      </p>
      <p className="text-sm text-gray-600">
        Posts will appear here as they are published across connected networks.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="card border-red-900/50 bg-red-900/10 py-12 text-center">
      <div className="mb-4 text-4xl text-red-400">!</div>
      <p className="mb-2 text-red-300">{message || 'Failed to load feed'}</p>
      {onRetry && (
        <button type="button" className="btn-primary text-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function FeedList({
  state,
  posts,
  error,
  protocolLabel,
  onTip,
  onRetry,
  onPostClick,
  onEngage,
  hasMore,
  onLoadMore,
}: FeedListProps) {
  const sentinelRef = useRef<HTMLLIElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  // Track scroll position and container height for virtualization
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
      setContainerHeight(containerRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Loading state
  if (state === 'loading') {
    return (
      <output className="space-y-4" aria-label="Loading feed">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </output>
    );
  }

  // Error state
  if (state === 'error') {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  // Empty state
  if (state === 'empty' || posts.length === 0) {
    return <EmptyState protocolLabel={protocolLabel} />;
  }

  // Virtualized rendering
  const totalHeight = posts.length * CARD_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / CARD_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    posts.length,
    Math.ceil((scrollTop + containerHeight) / CARD_HEIGHT) + OVERSCAN,
  );
  const visiblePosts = posts.slice(startIndex, endIndex);
  const offsetY = startIndex * CARD_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto"
      style={{ height: '100%', maxHeight: 'calc(100vh - 200px)' }}
      aria-label={protocolLabel ? `${protocolLabel} feed` : 'Feed'}
    >
      <ul className="relative list-none" style={{ height: totalHeight }}>
        <li style={{ height: offsetY }} aria-hidden="true" />
        {visiblePosts.map((post) => (
          <li key={post.id} style={{ height: CARD_HEIGHT }}>
            <PostCard post={post} onClick={onPostClick} onTip={onTip} onEngage={onEngage} />
          </li>
        ))}
        {hasMore && (
          <li ref={sentinelRef} className="py-4 text-center text-sm text-gray-600">
            Loading more...
          </li>
        )}
      </ul>
    </div>
  );
}
