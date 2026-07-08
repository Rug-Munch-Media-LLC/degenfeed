/**
 * @degenfeed/ui — FeedList
 *
 * Renders a flat, scrollable list of PostCards. The previous implementation
 * tried to virtualize a fixed-CARD_HEIGHT layout, which clipped real content
 * because PostCard heights vary widely. Real scrolling + JSX lists perform
 * fine for the 50–100 posts we load per page, so we render them all.
 *
 * States: loading (skeleton cards), loaded (real cards), empty (CTA), error
 * (retry). `hasMore` + `onLoadMore` enables future infinite scroll without
 * forcing virtualization today.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { useEffect, useRef } from 'react';
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

function SkeletonCard() {
  return (
    <div className="border-b border-white/5 px-4 py-3">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-gray-800" />
        <div className="flex-1">
          <div className="mb-1.5 h-3 w-32 animate-pulse rounded bg-gray-800" />
          <div className="h-2.5 w-20 animate-pulse rounded bg-gray-800" />
        </div>
      </div>
      <div className="mb-2 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-gray-800" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-gray-800" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-800" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-12 animate-pulse rounded bg-gray-800" />
        <div className="h-3 w-12 animate-pulse rounded bg-gray-800" />
        <div className="h-3 w-12 animate-pulse rounded bg-gray-800" />
      </div>
    </div>
  );
}

function EmptyState({
  protocolLabel,
  onSignIn,
}: {
  protocolLabel?: string;
  onSignIn?: () => void;
}) {
  return (
    <div className="border-b border-white/5 px-4 py-16 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/10">
        <span className="text-3xl text-degen-400">{protocolLabel ? '○' : '◆'}</span>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">
        {protocolLabel ? `No ${protocolLabel} posts yet` : 'The feed is warming up'}
      </h3>
      <p className="mx-auto mb-6 max-w-sm text-sm text-gray-500">
        {protocolLabel
          ? 'This network is quiet right now. Try another tab or sign in to compose.'
          : 'Pulling the first posts from every network. This usually takes a few seconds.'}
      </p>
      {onSignIn && (
        <button type="button" onClick={onSignIn} className="btn-primary text-sm">
          Sign in to compose
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="border-b border-white/5 px-4 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
        <span className="text-2xl text-red-400">!</span>
      </div>
      <p className="mb-1 text-sm font-medium text-red-300">
        {message || 'Could not load the feed'}
      </p>
      <p className="mb-5 text-xs text-gray-600">
        The worker may be cold-starting or a source provider is down.
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-primary text-sm">
          Try again
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
  onSignIn,
}: FeedListProps & { onSignIn?: () => void }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const SCROLL_KEY = 'df_scroll';

  // Scroll position restore
  useEffect(() => {
    if (state !== 'loaded' || posts.length === 0) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      const { y, id } = JSON.parse(saved) as { y: number; id: string };
      const el = document.getElementById(`post-${id}`);
      if (el) { el.scrollIntoView(); return; }
      window.scrollTo(0, y);
    }
  }, [state, posts.length]);

  // Save scroll position on post click
  const handlePostClick = (postId: string) => {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ y: window.scrollY, id: postId }));
    onPostClick?.(postId);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const articles = containerRef.current?.querySelectorAll('article');
      if (!articles?.length) return;
      const focused = document.activeElement;
      const idx = Array.from(articles).indexOf(focused as Element);

      if (e.key === 'j' && idx < articles.length - 1) {
        e.preventDefault();
        (articles[idx + 1] as HTMLElement)?.focus({ preventScroll: false });
      }
      if (e.key === 'k' && idx > 0) {
        e.preventDefault();
        (articles[idx - 1] as HTMLElement)?.focus({ preventScroll: false });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [posts.length]);

  // Pull-to-refresh
  useEffect(() => {
    let startY = 0;
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0]?.clientY ?? 0; };
    const onTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      if (endY - startY > 80 && window.scrollY < 10 && onRetry) onRetry();
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRetry]);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (state === 'loading') {
    return (
      <output className="block" aria-label="Loading feed">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </output>
    );
  }

  if (state === 'error') {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (state === 'empty' || posts.length === 0) {
    return <EmptyState protocolLabel={protocolLabel} onSignIn={onSignIn} />;
  }

  return (
    <div ref={containerRef} role="feed" aria-label={protocolLabel ? `${protocolLabel} feed` : 'Feed'}>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onClick={() => handlePostClick(post.id)}
          onTip={onTip}
          onEngage={onEngage}
        />
      ))}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="border-b border-white/5 px-4 py-6 text-center text-sm text-gray-500"
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-degen-500" />
            Loading more…
          </span>
        </div>
      )}
    </div>
  );
}
