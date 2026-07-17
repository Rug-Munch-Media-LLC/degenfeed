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
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type EngageHandler, PostCard } from './PostCard';
import { CardSkeleton } from './LoadingSkeleton';

export type { UnifiedPost };

export type FeedState = 'loading' | 'loaded' | 'empty' | 'error';

/**
 * Debounce a function — coalesces rapid-fire calls into a single trailing
 * invocation. Prevents layout thrashing from scroll/resize handlers.
 */
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  };
  return debounced as T;
}

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
  /** Called when a report is successfully submitted */
  onReport?: (postId: string) => void;
  /** Called when user clicks sign-in */
  onSignIn?: () => void;
  /** Called when the user wants to reply to a post from another protocol */
  onCrossReplyOpen?: (post: UnifiedPost) => void;
  /** If true, the viewer is an admin and sees moderation actions in the menu */
  isAdmin?: boolean;
  /** Called when an admin removes a post from the feed */
  onAdminRemove?: (postId: string) => void;
  /** Called when an admin bans a user */
  onAdminBan?: (userId: string, protocol: string, handle?: string) => void;
}

/* Replaced inline SkeletonCard with shared CardSkeleton from LoadingSkeleton */

function EmptyState({
  protocolLabel,
  onSignIn,
}: {
  protocolLabel?: string;
  onSignIn?: () => void;
}) {
  return (
    <div className="border-b border-[var(--color-glass-border)] px-4 py-16 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/10">
        <span className="text-3xl text-degen-400">{protocolLabel ? '○' : '◆'}</span>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">
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
    <div className="border-b border-[var(--color-glass-border)] px-4 py-12 text-center">
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

export const FeedList = memo(function FeedList({
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
  onReport,
  onCrossReplyOpen,
  isAdmin,
  onAdminRemove,
  onAdminBan,
}: FeedListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const SCROLL_KEY = 'df_scroll';

  // Filter out blocked/muted users from the feed
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    Promise.all([
      import('@degenfeed/storage').then((m) => m.getBlockedUsers('self')),
      import('@degenfeed/storage').then((m) => m.getMutedIdentities('self')),
    ])
      .then(([blocked, muted]) => {
        if (!cancelled) {
          setBlockedIds(new Set(blocked.map((b) => b.targetId)));
          setMutedIds(new Set(muted.map((m) => m.targetId)));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPosts = useMemo(
    () => posts.filter((p) => !blockedIds.has(p.author.id) && !mutedIds.has(p.author.id)),
    [posts, blockedIds, mutedIds],
  );

  // Scroll position restore
  useEffect(() => {
    if (state !== 'loaded' || filteredPosts.length === 0) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      const { y, id } = JSON.parse(saved) as { y: number; id: string };
      const el = document.getElementById(`post-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [state, filteredPosts.length]);

  // Save scroll position on post click (debounced to avoid layout thrash)
  const saveScrollPos = useRef(
    debounce((y: number, id: string) => {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ y, id }));
    }, 150),
  ).current;

  const handlePostClick = (postId: string) => {
    saveScrollPos(window.scrollY, postId);
    onPostClick?.(postId);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const articles = containerRef.current?.querySelectorAll('article');
      if (!articles?.length) return;
      const focused = document.activeElement;
      const idx = Array.from(articles).indexOf(focused as HTMLElement);

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
  }, []);

  // Pull-to-refresh
  useEffect(() => {
    let startY = 0;
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };
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
    return <CardSkeleton count={5} avatar lines={3} />;
  }

  if (state === 'error') {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (state === 'empty' || filteredPosts.length === 0) {
    return <EmptyState protocolLabel={protocolLabel} onSignIn={onSignIn} />;
  }

  return (
    <div
      ref={containerRef}
      role="feed"
      aria-label={protocolLabel ? `${protocolLabel} feed` : 'Feed'}
    >
      <div className="stagger-enter" style={{ '--stagger-delay': '50ms' } as React.CSSProperties}>
        {filteredPosts.map((post, i) => (
          <div
            key={post.id}
            style={
              {
                contentVisibility: 'auto',
                containIntrinsicSize: '0 200px',
                '--stagger-i': i,
              } as React.CSSProperties
            }
          >
            <PostCard
              post={post}
              onClick={() => handlePostClick(post.id)}
              onTip={onTip}
              onEngage={onEngage}
              onReport={onReport}
              onCrossReplyOpen={onCrossReplyOpen}
              isAdmin={isAdmin}
              onAdminRemove={onAdminRemove}
              onAdminBan={onAdminBan}
            />
          </div>
        ))}
      </div>
      {hasMore && (
        <div
          ref={sentinelRef}
          className="border-b border-[var(--color-glass-border)] px-4 py-6 text-center text-sm text-gray-500"
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-degen-500" />
            Loading more…
          </span>
        </div>
      )}
    </div>
  );
});
