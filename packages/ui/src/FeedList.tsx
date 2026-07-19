'use client';

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
 *
 * ENHANCED: End-of-feed discovery cards, smooth staggered fade-in for new
 * posts, boredom-aware content injection, category breaks every ~12 posts,
 * and optional reading progress tracking for expanded posts.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardSkeleton } from './LoadingSkeleton';
import { type EngageHandler, PostCard } from './PostCard';

export type { UnifiedPost };

export type FeedState = 'loading' | 'loaded' | 'empty' | 'error';

/**
 * Debounce a function — coalesces rapid-fire calls into a single trailing
 * invocation. Prevents layout thrashing from scroll/resize handlers.
 */
// biome-ignore lint/suspicious/noExplicitAny: intentional
function _debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
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

/** A single discoverable topic/category suggestion */
export interface DiscoverSuggestion {
  id: string;
  label: string;
  description: string;
  color: string;
  icon: string;
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
  /** Called when user clicks "Why am I seeing this?" in the three-dot menu */
  onWhyThisPost?: (post: UnifiedPost) => void;
  /** Called when user clicks "Show more like this" — boosts the post's topic. */
  onShowMoreLikeThis?: (topic: string) => void;
  /** Called when user clicks "Show less like this" — demotes the post's topic. */
  onShowLessLikeThis?: (topic: string) => void;
  /**
   * Optional slot replacing the default EmptyState when state is 'empty'.
   * Lets the parent page render tab-specific empty messaging (for-you, following, custom-mix).
   */
  emptySlot?: ReactNode;
  /**
   * End-of-feed discovery suggestions shown when hasMore is false and posts exist.
   * Each suggests a topic/category the user might explore.
   */
  endOfFeedSuggestions?: DiscoverSuggestion[];
  /**
   * Custom end-of-feed slot rendered below the last post when hasMore is false.
   * Overrides the built-in discovery cards if provided.
   */
  endOfFeedSlot?: ReactNode;
  /**
   * Called when a discovery suggestion is clicked.
   * Receives the suggestion id.
   */
  onDiscoveryClick?: (suggestionId: string) => void;
  /**
   * Callback for IntersectionObserver visibility — notifies parent when
   * a post enters/leaves the viewport. Used for dwell-time tracking.
   */
  onPostVisibility?: (postId: string, isVisible: boolean) => void;
  /**
   * Category break component slot. If provided, rendered between groups
   * of posts (every ~12 posts) to break up the infinite scroll.
   * Passes index and batch niches as props.
   */
  categoryBreakSlot?: ReactNode;
  /**
   * If true, shows category breaks every 12 posts using aggregated niches.
   * Default: true
   */
  showCategoryBreaks?: boolean;
  /**
   * The aggregated niches for the next batch, updated by the parent
   * on each render cycle that includes a category break position.
   */
  categoryNiches?: string[];
}

/* ── Sub-components ───────────────────────────────────────────── */

function EmptyState({
  protocolLabel,
  protocolColor,
  onSignIn,
}: {
  protocolLabel?: string;
  protocolColor?: string;
  onSignIn?: () => void;
}) {
  const color = protocolColor || '#00ff41';
  return (
    <div className="border-b border-[var(--color-glass-border)] px-4 py-16 text-center">
      <div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}18` }}
      >
        <span className="text-3xl" style={{ color }}>
          {protocolLabel ? '○' : '◆'}
        </span>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">
        {protocolLabel ? `No ${protocolLabel} posts yet` : 'The feed is warming up'}
      </h3>
      <p className="mx-auto mb-6 max-w-sm text-sm text-[var(--color-muted)]">
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

/** End-of-feed discovery card with topic suggestion */
function DiscoveryCard({
  suggestion,
  onClick,
}: {
  suggestion: DiscoverSuggestion;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 text-left transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
      style={
        {
          borderColor: `${suggestion.color}22`,
          '--card-glow': `${suggestion.color}15`,
        } as React.CSSProperties
      }
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
        style={{ backgroundColor: `${suggestion.color}18` }}
      >
        <span aria-hidden="true">{suggestion.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors">
          Check out {suggestion.label}
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">
          {suggestion.description}
        </p>
      </div>
      <div
        className="mt-1 shrink-0 self-start rounded-full p-1.5 transition-transform group-hover:translate-x-1"
        aria-hidden="true"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

/** Inline boredom-breaker: an explore card shown between posts */
export function BoredomBreakerCard({
  suggestions,
  onDiscoveryClick,
}: {
  suggestions: DiscoverSuggestion[];
  onDiscoveryClick?: (id: string) => void;
}) {
  const [showing, setShowing] = useState(0);
  const s = suggestions[showing % suggestions.length];

  if (!s) return null;

  return (
    <div className="feed-item-enter border-b border-[var(--color-glass-border)] px-4 py-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-degen-500" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
          Explore something new
        </span>
      </div>
      <button
        type="button"
        onClick={() => onDiscoveryClick?.(s.id)}
        className="group flex w-full items-center gap-4 rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-r from-[var(--color-accent-glow)] to-transparent p-4 text-left transition-all hover:border-[var(--color-accent)]/30"
      >
        <span className="text-2xl" aria-hidden="true">
          {s.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors">
            Discover {s.label}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-muted)] line-clamp-1">{s.description}</p>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--color-accent)]"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
      <div className="mt-2 flex justify-center gap-1">
        {suggestions.slice(0, 4).map((s, idx) => (
          <button
            key={`dot-${s.id}`}
            type="button"
            onClick={() => setShowing(idx)}
            className={`h-1.5 rounded-full transition-all ${
              idx === showing % suggestions.length
                ? 'w-4 bg-degen-500'
                : 'w-1.5 bg-[var(--color-muted)]/30'
            }`}
            aria-label={`Show suggestion ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main FeedList component ─────────────────────────────────── */

export const FeedList = memo(function FeedList({
  state,
  posts,
  error,
  protocolLabel,
  protocolColor,
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
  onWhyThisPost,
  emptySlot,
  endOfFeedSuggestions,
  endOfFeedSlot,
  onDiscoveryClick,
  onPostVisibility,
  showCategoryBreaks,
  categoryBreakSlot,
  onShowMoreLikeThis,
  onShowLessLikeThis,
}: FeedListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const SCROLL_KEY = 'df_scroll';

  // Track previously seen post IDs so new loads animate in, existing ones don't re-animate
  const seenIdsRef = useRef(new Set<string>());
  const [_renderTick, setRenderTick] = useState(0);

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

  // Track new posts for animation: mark all current posts as seen after render
  useEffect(() => {
    if (state === 'loaded' && filteredPosts.length > 0) {
      const ids = filteredPosts.map((p) => p.id);
      let hasNew = false;
      for (const id of ids) {
        if (!seenIdsRef.current.has(id)) {
          hasNew = true;
          seenIdsRef.current.add(id);
        }
      }
      if (hasNew) {
        // Trigger a re-render so new posts get the animation class
        setRenderTick((t) => t + 1);
      }
    }
  }, [filteredPosts, state]);

  // ── Scroll position restore ("continue reading") ───────────────
  // Restores the exact Y position the user was at when they clicked
  // a post, so navigating back returns them to the same spot.

  // Save scroll position to sessionStorage
  const saveScrollPos = useCallback(() => {
    const scrollY = window.scrollY;
    if (scrollY <= 0) return;
    // Find the nearest visible post ID for anchor-based restore
    const postEls = document.querySelectorAll<HTMLElement>('[data-post-id]');
    let anchorId = '';
    for (const el of postEls) {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.5) {
        anchorId = el.getAttribute('data-post-id') ?? '';
      } else {
        break;
      }
    }
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ y: scrollY, id: anchorId }));
  }, []);

  // Save on page unload so refresh/back works
  useEffect(() => {
    const handleBeforeUnload = () => saveScrollPos();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveScrollPos]);

  // Restore scroll position when feed loads
  useEffect(() => {
    if (state !== 'loaded' || filteredPosts.length === 0) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      try {
        const { y, id } = JSON.parse(saved) as { y: number; id: string };
        // Clear saved position to prevent stale restore on future visits
        sessionStorage.removeItem(SCROLL_KEY);

        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          if (id) {
            const el = document.getElementById(`post-${id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
              return;
            }
          }
          if (y > 0) {
            window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
          }
        });
      } catch {
        // Ignore parse errors
      }
    }
  }, [state, filteredPosts.length]);

  // Save scroll position on post click
  const handlePostClick = (postId: string) => {
    saveScrollPos();
    onPostClick?.(postId);
  };

  // Keyboard navigation — j/k posts, Enter to open, l/r/t/b for actions
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const postEls = containerRef.current?.querySelectorAll<HTMLElement>('[data-post-id]');
      if (!postEls?.length) return;
      const focused = document.activeElement;
      const idx = Array.from(postEls).indexOf(focused as HTMLElement);

      if ((e.key === 'j' || e.key === 'ArrowDown') && idx < postEls.length - 1) {
        e.preventDefault();
        const next = postEls[idx + 1];
        if (next) {
          next.focus({ preventScroll: false });
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      if ((e.key === 'k' || e.key === 'ArrowUp') && idx > 0) {
        e.preventDefault();
        const prev = postEls[idx - 1];
        if (prev) {
          prev.focus({ preventScroll: false });
          prev.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      if (e.key === 'l' && idx >= 0) {
        const postId = postEls[idx]?.getAttribute('data-post-id');
        if (postId) {
          e.preventDefault();
          onEngage?.('like', postId);
        }
      }
      if (e.key === 'r' && idx >= 0) {
        const postId = postEls[idx]?.getAttribute('data-post-id');
        if (postId) {
          e.preventDefault();
          const target = filteredPosts.find((p) => p.id === postId);
          if (target) onCrossReplyOpen?.(target);
        }
      }
      if (e.key === 't' && idx >= 0) {
        const postId = postEls[idx]?.getAttribute('data-post-id');
        if (postId) {
          e.preventDefault();
          const target = filteredPosts.find((p) => p.id === postId);
          if (target) onTip?.(target);
        }
      }
      if (e.key === 'b' && idx >= 0) {
        const postId = postEls[idx]?.getAttribute('data-post-id');
        if (postId) {
          e.preventDefault();
          onEngage?.('bookmark', postId);
        }
      }
      if (e.key === 'Enter' && idx >= 0) {
        const postId = postEls[idx]?.getAttribute('data-post-id');
        if (postId) {
          e.preventDefault();
          handlePostClick(postId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEngage, onTip, onCrossReplyOpen, filteredPosts, handlePostClick]);

  // Infinite scroll via IntersectionObserver
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

  // Post visibility tracking for dwell-time (boredom detection)
  useEffect(() => {
    if (!onPostVisibility || state !== 'loaded') return;
    const container = containerRef.current;
    if (!container) return;

    const postEls = container.querySelectorAll<HTMLElement>('[data-post-id]');
    if (!postEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const postId = (entry.target as HTMLElement).getAttribute('data-post-id');
          if (postId) {
            onPostVisibility(postId, entry.isIntersecting);
          }
        }
      },
      { threshold: 0.3 },
    );

    for (const el of postEls) observer.observe(el);
    return () => observer.disconnect();
  }, [state, onPostVisibility]);

  if (state === 'loading') {
    return <CardSkeleton count={5} avatar lines={3} />;
  }

  if (state === 'error') {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (state === 'empty' || filteredPosts.length === 0) {
    if (emptySlot) return <>{emptySlot}</>;
    return (
      <EmptyState protocolLabel={protocolLabel} protocolColor={protocolColor} onSignIn={onSignIn} />
    );
  }

  const hasEndOfFeed = !hasMore && filteredPosts.length > 0;
  const suggestions = endOfFeedSuggestions ?? [];

  return (
    <div
      ref={containerRef}
      role="feed"
      aria-label={protocolLabel ? `${protocolLabel} feed` : 'Feed'}
    >
      {(() => {
        const BREAK_INTERVAL = 12;
        const items: ReactNode[] = [];

        for (let i = 0; i < filteredPosts.length; i++) {
          const post = filteredPosts[i];
          if (!post) continue;

          // Category break: insert every BREAK_INTERVAL posts (not at position 0)
          if (
            showCategoryBreaks !== false &&
            i > 0 &&
            i < filteredPosts.length - 1 &&
            i % BREAK_INTERVAL === 0 &&
            categoryBreakSlot
          ) {
            items.push(
              <div key={`category-break-${i}`} className="animate-category-break">
                {categoryBreakSlot}
              </div>,
            );
          }

          const isNew = !seenIdsRef.current.has(post.id);
          items.push(
            <article
              key={post.id}
              id={`post-${post.id}`}
              data-post-id={post.id}
              tabIndex={-1}
              aria-label={`Post by ${post.author.displayName || 'unknown'}`}
              className={isNew ? 'feed-item-enter' : ''}
              style={
                {
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
                onWhyThisPost={onWhyThisPost}
                onShowMoreLikeThis={onShowMoreLikeThis}
                onShowLessLikeThis={onShowLessLikeThis}
              />
            </article>,
          );
        }

        return items;
      })()}

      {/* ── Scroll sentinel for infinite scroll ── */}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="border-b border-[var(--color-glass-border)] px-4 py-6 text-center text-sm text-[var(--color-muted)]"
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-degen-500" />
            Loading more…
          </span>
        </div>
      )}

      {/* ── End-of-feed discovery cards ── */}
      {hasEndOfFeed && !endOfFeedSlot && suggestions.length > 0 && (
        <div className="end-of-feed-section min-h-[280px] border-b border-[var(--color-glass-border)] px-4 py-8">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-transparent">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-degen-400"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">
              You&apos;re all caught up!
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Explore more topics or check back later for new posts.
            </p>
          </div>
          <div className="mx-auto max-w-lg space-y-3">
            {suggestions.map((s) => (
              <DiscoveryCard key={s.id} suggestion={s} onClick={() => onDiscoveryClick?.(s.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Custom end-of-feed slot ── */}
      {hasEndOfFeed && endOfFeedSlot}
    </div>
  );
});
