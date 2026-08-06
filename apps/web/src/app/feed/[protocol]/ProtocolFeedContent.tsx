'use client';

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import { getProtocolColor } from '@degenfeed/utils';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { SlowConnectionNotice } from '../../../components/feed/SlowConnectionNotice';
import { useRealtimeFeed } from '../../../hooks/useRealtimeFeed';
import { classifyFeedError } from '../../../lib/feedError';
import { ProtocolEmptyState } from './components/ProtocolEmptyState';
import { ProtocolHeader } from './components/ProtocolHeader';
import { ProtocolHealthBanner } from './components/ProtocolHealthBanner';
import { ProtocolPostMeta } from './components/ProtocolPostMeta';
import { ProtocolStats } from './components/ProtocolStats';
import { ProtocolTrending } from './components/ProtocolTrending';

const TipModal = dynamic(
  () => import('../../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

// ─── Types ──────────────────────────────────────────────────────────

interface FeedMeta {
  protocol?: string;
  total?: number;
  limit?: number;
  page?: number;
  hasMore?: boolean;
  errors?: string[];
  notices?: string[];
  trending?: { topic: string; count: number; score: number }[];
  fetchedAt?: number;
  sort?: string;
  protocolLabel?: string;
  activeUsers24h?: number;
  engagementVelocity?: number;
  source?: string;
  perProtocol?: Record<string, number>;
  providerSources?: Record<string, string>;
}

export type SortMode = 'latest' | 'trending' | 'popular' | 'top';

/** Compact inline boundary for non-critical protocol widgets (header,
 *  stats, health, trending). One broken widget must never take down the
 *  protocol timeline. */
function ProtocolWidgetBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="my-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-center text-xs text-yellow-400">
          This section couldn&apos;t be displayed. The feed below is unaffected.
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

const SORT_TABS: { id: SortMode; label: string; icon: string }[] = [
  { id: 'latest', label: 'Latest', icon: '🕐' },
  { id: 'trending', label: 'Trending', icon: '📈' },
  { id: 'popular', label: 'Popular', icon: '🔥' },
  { id: 'top', label: 'Top', icon: '🏆' },
];

const VALID_SORTS = new Set<SortMode>(['latest', 'trending', 'popular', 'top']);

/** Legacy deep-link sort keys (pre-2026-08 protocol pages) mapped to the
 *  current tabs so old URLs like /feed/nostr/newest keep working. */
const LEGACY_SORT_MAP: Record<string, SortMode> = {
  newest: 'latest',
  videos: 'top',
};

export function normalizeSort(value: string | undefined | null): SortMode {
  if (value && VALID_SORTS.has(value as SortMode)) return value as SortMode;
  if (value && LEGACY_SORT_MAP[value]) return LEGACY_SORT_MAP[value];
  return 'popular';
}

// Protocol colors sourced from the canonical registry (@degenfeed/utils)

// ─── Component ──────────────────────────────────────────────────────

export function ProtocolFeedContent({
  protocol,
  initialSort = 'popular',
}: {
  protocol: string;
  initialSort?: SortMode;
}) {
  const router = useRouter();
  const { engage, openComposeReply } = useAuth();

  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [activeSort, setActiveSort] = useState<SortMode>(initialSort);
  const [isFollowing, setIsFollowing] = useState(false);
  // Infinite scroll pagination: page N is fetched with ?page=N and appended
  // to the timeline (deduped). hasMore comes from the API meta.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const color = getProtocolColor(protocol);

  // Real-time feed updates
  const realtimeFeed = useRealtimeFeed('home', protocol);

  // Handle real-time post insertion
  const handleRealtimeInsert = useCallback(() => {
    const queued = realtimeFeed.insertQueued();
    if (queued.length > 0) {
      setPosts((prev) => {
        const newPosts = queued.map((q) => q.post);
        const existingIds = new Set(prev.map((p) => p.id));
        const trulyNew = newPosts.filter((p) => !existingIds.has(p.id));
        if (trulyNew.length === 0) return prev;
        return [...trulyNew, ...prev];
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [realtimeFeed]);

  // Auto-insert at top
  useEffect(() => {
    if (realtimeFeed.newPostCount > 0) {
      const timer = setTimeout(() => {
        if (window.scrollY < 80) {
          handleRealtimeInsert();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [realtimeFeed.newPostCount, handleRealtimeInsert]);

  /**
   * Commit a fetched page to state.
   * append=false replaces the timeline (initial load / refresh);
   * append=true merges new posts at the end, deduping by id so scrolling
   * never duplicates posts across page boundaries.
   */
  const applyFeed = useCallback((feed: UnifiedPost[], meta: FeedMeta, append: boolean) => {
    setPosts((prev) => {
      if (!append) return feed;
      if (feed.length === 0) return prev;
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...feed.filter((p) => !seen.has(p.id))];
    });
    setFeedMeta(meta);
    // hasMore from the API (bridge/api-server both set it); fall back to a
    // full page implying more when the field is absent (older deployments).
    setHasMore(meta.hasMore ?? feed.length >= 50);
    if (feed.length > 0) setState('loaded');
    else if (!append) setState('empty');
    setLoadingMore(false);
  }, []);

  // Fetch feed. append=true fetches the next page and merges it in.
  const fetchFeed = useCallback(
    async (append = false, pageNum = 1) => {
      if (!append) setState('loading');
      let status: number | undefined;
      try {
        const endpoint = `/api/feed/protocol/${encodeURIComponent(protocol)}/${activeSort}`;
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', '50');
        url.searchParams.set('page', String(pageNum));

        const res = await fetch(url.toString(), {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });
        status = res.status;

        // Auth errors → send the user to sign in instead of showing a feed error
        if (res.status === 401 || res.status === 403) {
          const next = encodeURIComponent(
            `/feed/${encodeURIComponent(protocol)}?sort=${activeSort}`,
          );
          router.push(`/auth?next=${next}`);
          return;
        }

        // Parse the primary response defensively. The bridge does not implement
        // /api/feed/protocol/{p}/{sort}: production can return HTTP 400
        // ("Unknown provider") and localhost returns a {status:"ok"} stub with no
        // posts/data array. Treat both as "not a feed payload".
        let json: { posts?: UnifiedPost[]; data?: UnifiedPost[]; meta?: FeedMeta } | null = null;
        if (res.ok) {
          try {
            json = (await res.json()) as {
              posts?: UnifiedPost[];
              data?: UnifiedPost[];
              meta?: FeedMeta;
            };
          } catch {
            json = null;
          }
        }

        // Fallback to the working bridge endpoint at /api/feed/{protocol} when the
        // protocol+sort endpoint errors OR returns no posts/data.
        if (!res.ok || !json || (!json.posts && !json.data)) {
          const fallbackUrl = new URL(
            `/api/feed/${encodeURIComponent(protocol)}`,
            window.location.origin,
          );
          fallbackUrl.searchParams.set('limit', '50');
          fallbackUrl.searchParams.set('page', String(pageNum));
          const fallbackRes = await fetch(fallbackUrl.toString(), {
            credentials: 'include',
            cache: 'no-store',
          });
          status = fallbackRes.status;
          if (fallbackRes.status === 401 || fallbackRes.status === 403) {
            const next = encodeURIComponent(
              `/feed/${encodeURIComponent(protocol)}?sort=${activeSort}`,
            );
            router.push(`/auth?next=${next}`);
            return;
          }
          if (!fallbackRes.ok) throw new Error(`Feed returned ${fallbackRes.status}`);
          const fallbackJson = (await fallbackRes.json()) as {
            posts?: UnifiedPost[];
            data?: UnifiedPost[];
            meta?: FeedMeta;
          };
          const fallbackFeed = fallbackJson.posts ?? fallbackJson.data ?? [];
          applyFeed(fallbackFeed, fallbackJson.meta ?? {}, append);
          return;
        }

        const feed = json.posts ?? json.data ?? [];
        applyFeed(feed, json.meta ?? {}, append);
      } catch (err) {
        const classified = classifyFeedError(err, status);
        if (classified.kind === 'auth') {
          const next = encodeURIComponent(`/feed/${encodeURIComponent(protocol)}`);
          router.push(`/auth?next=${next}`);
          return;
        }
        setError(classified.message);
        if (!append) setState('error');
        setLoadingMore(false);
      }
    },
    [protocol, activeSort, router, applyFeed],
  );

  useEffect(() => {
    void fetchFeed(false, 1);
  }, [fetchFeed]);

  // Reset local state when switching protocols (client-side nav reuses this
  // component instance between routes).
  useEffect(() => {
    setPosts([]);
    setState('loading');
    setError(undefined);
    setFeedMeta({});
    setActiveSort(initialSort);
    setPage(1);
    setHasMore(true);
    setLoadingMore(false);
  }, [protocol, initialSort]);

  const handleEngage = async (
    action: EngagementAction,
    postId: string,
    content?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'Post not found' };

    return engage(action, postId, post.protocol, { content });
  };

  const handleRetry = useCallback(() => {
    setPage(1);
    setHasMore(true);
    void fetchFeed(false, 1);
  }, [fetchFeed]);

  const handleTabChange = useCallback((sort: SortMode) => {
    setActiveSort(sort);
    setPage(1);
    setHasMore(true);
    setLoadingMore(false);
  }, []);

  /** Fetch the next page and append it (infinite scroll). */
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || state !== 'loaded') return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    void fetchFeed(true, next);
  }, [loadingMore, hasMore, state, page, fetchFeed]);

  if (!protocol) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-[var(--color-fg)]">Protocol not found</h1>
        <p className="text-sm text-[var(--color-muted)]">No protocol specified.</p>
        <Link href="/feed" className="btn-primary mt-4 inline-block text-sm">
          Back to all feeds
        </Link>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl">
        {/* Protocol Header */}
        <ProtocolWidgetBoundary>
          <ProtocolHeader
            protocol={protocol}
            totalPosts={feedMeta.total}
            activeUsers24h={feedMeta.activeUsers24h}
          />
        </ProtocolWidgetBoundary>

        {/* Protocol health banner (green/yellow/red) from live bridge health */}
        <ProtocolWidgetBoundary>
          <ProtocolHealthBanner protocol={protocol} meta={feedMeta} />
        </ProtocolWidgetBoundary>

        {/* Stats Cards */}
        <ProtocolWidgetBoundary>
          <ProtocolStats
            protocol={protocol}
            totalPosts={feedMeta.total}
            activeUsers24h={feedMeta.activeUsers24h}
            engagementVelocity={feedMeta.engagementVelocity}
            trendingTopics={feedMeta.trending}
            color={color}
          />
        </ProtocolWidgetBoundary>

        {/* Trending topics */}
        <ProtocolWidgetBoundary>
          <ProtocolTrending protocol={protocol} topics={feedMeta.trending ?? []} color={color} />
        </ProtocolWidgetBoundary>

        {/* Sort tabs + follow */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div
            className="flex gap-1 overflow-x-auto scrollbar-none"
            role="tablist"
            aria-label="Feed sort order"
          >
            {SORT_TABS.map((tab) => {
              const isActive = activeSort === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all lg:min-h-[36px] ${
                    isActive
                      ? 'text-[var(--color-fg)] shadow-sm'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `${color}18`,
                          color,
                          boxShadow: `0 0 10px ${color}15`,
                        }
                      : undefined
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Follow toggle */}
          <button
            type="button"
            onClick={() => setIsFollowing((p) => !p)}
            className={`flex min-h-[44px] items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all lg:min-h-[36px] ${
              isFollowing
                ? 'border border-degen-500/30 bg-degen-500/10 text-degen-400'
                : 'border text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
            style={
              isFollowing
                ? { borderColor: `${color}30`, backgroundColor: `${color}12`, color }
                : { borderColor: 'var(--color-glass-border)' }
            }
            aria-pressed={isFollowing}
          >
            {isFollowing ? 'Following' : '+ Follow'}
          </button>
        </div>

        {/* Live indicator */}
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all ${
              realtimeFeed.connected
                ? 'bg-degen-500/10 text-degen-400'
                : 'bg-yellow-500/10 text-yellow-400'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                realtimeFeed.connected
                  ? 'animate-pulse bg-degen-400 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                  : 'bg-yellow-400'
              }`}
            />
            {realtimeFeed.connected
              ? 'Live'
              : realtimeFeed.connectionState === 'reconnecting'
                ? 'Reconnecting\u2026'
                : 'Connecting\u2026'}
          </span>

          {/* Link to trending page */}
          <Link
            href={`/feed/${protocol}/trending`}
            prefetch
            className="ml-auto flex min-h-[44px] items-center text-[10px] font-medium transition-colors hover:underline lg:min-h-0"
            style={{ color }}
          >
            Full trending page →
          </Link>
        </div>

        {/* Notices */}
        {feedMeta.notices && feedMeta.notices.length > 0 && (
          <div className="mb-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-400">
            {feedMeta.notices.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
        )}

        {feedMeta.errors && feedMeta.errors.length > 0 && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {feedMeta.errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        {/* Real-time banner */}
        {realtimeFeed.newPostCount > 0 && (
          <div className="mb-4 animate-slideDown">
            <button
              type="button"
              onClick={handleRealtimeInsert}
              className="w-full rounded-lg bg-degen-500/10 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/20"
            >
              {realtimeFeed.newPostCount} new {realtimeFeed.newPostCount === 1 ? 'post' : 'posts'} —
              tap to see
            </button>
          </div>
        )}

        {/* Slow-connection fallback: skeleton + notice after 2s */}
        <SlowConnectionNotice active={state === 'loading'} />

        {/* Feed list (protocol-specific empty state via emptySlot) */}
        <FeedList
          state={state}
          posts={posts}
          error={error}
          protocolLabel={feedMeta.protocolLabel ?? protocol}
          protocolColor={color}
          hasMore={hasMore && !loadingMore}
          onLoadMore={loadMore}
          emptySlot={
            state === 'empty' ? (
              <ProtocolEmptyState protocol={protocol} sort={activeSort} onRetry={handleRetry} />
            ) : undefined
          }
          postMetaSlot={(post) => (
            <ProtocolPostMeta
              post={post}
              onEngage={handleEngage}
              onReply={(p) => {
                const nativeId = p.id.replace(
                  /^(nostr:|farcaster:|lens:|bluesky:|mastodon:|reddit:|rss:|threads:)/,
                  '',
                );
                openComposeReply({
                  parentPostUri: p.dfUri ?? `df://${p.protocol}:${nativeId}`,
                  parentProtocol: p.protocol,
                  parentPreview: (p.text ?? '').slice(0, 120),
                });
              }}
            />
          )}
          onPostClick={(id) => router.push(`/post/${encodeURIComponent(id)}`)}
          onEngage={handleEngage}
          onTip={(post) => setTipPost(post)}
          onRetry={handleRetry}
          onCrossReplyOpen={(post) => {
            const nativeId = post.id.replace(
              /^(nostr:|farcaster:|lens:|bluesky:|mastodon:|reddit:|rss:|threads:)/,
              '',
            );
            openComposeReply({
              parentPostUri: post.dfUri ?? `df://${post.protocol}:${nativeId}`,
              parentProtocol: post.protocol,
              parentPreview: (post.text ?? '').slice(0, 120),
            });
          }}
        />

        {/* Tip modal */}
        {tipPost && (
          <TipModal
            open={!!tipPost}
            onClose={() => setTipPost(null)}
            recipientProtocol={tipPost.protocol}
            recipientAuthorId={tipPost.author.id}
            recipientDisplayName={tipPost.author.displayName}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
