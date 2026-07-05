/**
 * @degenfeed/ui — FeedList
 *
 * Scrollable list of PostCards with loading, empty, and error states.
 * Supports infinite scroll, pull-to-refresh, and protocol filtering.
 *
 * States:
 *   loading  → Skeleton cards (animated pulses)
 *   loaded   → PostCard list
 *   empty    → Illustration + message + CTA
 *   error    → Error message + retry button
 */

import { PostCard } from './PostCard';
import { ProtocolBadge } from './ProtocolBadge';
import type { UnifiedPost } from '@degenfeed/types';
import { useEffect, useRef } from 'react';

export type { UnifiedPost };

export type FeedState = 'loading' | 'loaded' | 'empty' | 'error';

export interface FeedListProps {
  /** Current feed state. */
  state: FeedState;
  /** Posts to render (only used when state === 'loaded'). */
  posts: UnifiedPost[];
  /** Error message (only used when state === 'error'). */
  error?: string;
  /** Protocol filter label displayed in the header. */
  protocolLabel?: string;
  /** Protocol color for accent. */
  protocolColor?: string;
  /** Called when the user triggers a retry. */
  onRetry?: () => void;
  /** Called when a post is clicked. */
  onPostClick?: (postId: string) => void;
  /** Called when user engages with a post. */
  onEngage?: (action: 'like' | 'repost' | 'reply', postId: string) => void;
  /** If true, enables infinite scroll callback. */
  hasMore?: boolean;
  /** Called when user scrolls near the bottom (for infinite scroll). */
  onLoadMore?: () => void;
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
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
        {protocolLabel ? 'No ' + protocolLabel + ' posts yet' : 'No posts yet'}
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

export function FeedList({ state, posts, error, protocolLabel, protocolColor, onRetry, onPostClick, onEngage, hasMore, onLoadMore }: FeedListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // Loading state
  if (state === 'loading') {
    return (
      <div className="space-y-4" role="status" aria-label="Loading feed">
        {[1,2,3,4,5].map((i) => <SkeletonCard key={i} />)}
      </div>
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

  // Loaded state
  return (
    <div className="space-y-4" role="feed" aria-label={protocolLabel ? protocolLabel + ' feed' : 'Feed'}>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onClick={onPostClick}
          onEngage={onEngage}
        />
      ))}
      {hasMore && (
        <div ref={sentinelRef} className="py-4 text-center text-sm text-gray-600">
          Loading more...
        </div>
      )}
    </div>
  );
}
