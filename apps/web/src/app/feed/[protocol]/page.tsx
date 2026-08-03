'use client';

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useRealtimeFeed } from '../../../hooks/useRealtimeFeed';
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

interface Props {
  params: Promise<{ protocol: string }>;
}

interface FeedMeta {
  protocol?: string;
  total?: number;
  limit?: number;
  errors?: string[];
  notices?: string[];
  trending?: { topic: string; count: number; score: number }[];
  fetchedAt?: number;
  sort?: string;
  protocolLabel?: string;
  activeUsers24h?: number;
  engagementVelocity?: number;
  source?: string;
  isDemo?: boolean;
  perProtocol?: Record<string, number>;
  providerSources?: Record<string, string>;
}

type SortMode = 'popular' | 'trending' | 'newest' | 'videos';

const SORT_TABS: { id: SortMode; label: string; icon: string }[] = [
  { id: 'popular', label: 'Popular', icon: '🔥' },
  { id: 'trending', label: 'Trending', icon: '📈' },
  { id: 'newest', label: 'Newest', icon: '🕐' },
  { id: 'videos', label: 'Videos', icon: '🎬' },
];

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  reddit: '#ff4500',
  rss: '#ffa500',
  threads: '#888',
  lemmy: '#2d9cdb',
  pixelfed: '#f9a825',
  peertube: '#f1680d',
  zora: '#6b21a8',
  audius: '#cc0fe0',
  rarible: '#feda02',
  github: '#6e40c9',
  youtube: '#ff0000',
  telegram: '#26a5e4',
  discord: '#5865f2',
  hive: '#e31337',
  misskey: '#86b300',
  pleroma: '#fba740',
  mirror: '#222',
  paragraph: '#6c5ce7',
  ethereum: '#627eea',
  solana: '#14f195',
};

function getProtocolColor(protocol: string): string {
  return PROTOCOL_COLORS[protocol] ?? '#666';
}

// ─── Component ──────────────────────────────────────────────────────

function ProtocolFeedContent({ protocol }: { protocol: string }) {
  const router = useRouter();
  const { engage, openComposeReply } = useAuth();

  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [activeSort, setActiveSort] = useState<SortMode>('popular');
  const [isFollowing, setIsFollowing] = useState(false);

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

  // Fetch feed
  const fetchFeed = useCallback(async () => {
    setState('loading');
    try {
      const endpoint = `/api/feed/protocol/${encodeURIComponent(protocol)}/${activeSort}`;
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('limit', '50');

      const res = await fetch(url.toString(), {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });

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
        const fallbackRes = await fetch(fallbackUrl.toString(), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!fallbackRes.ok) throw new Error(`Feed returned ${fallbackRes.status}`);
        const fallbackJson = (await fallbackRes.json()) as {
          posts?: UnifiedPost[];
          data?: UnifiedPost[];
          meta?: FeedMeta;
        };
        const feed = fallbackJson.posts ?? fallbackJson.data ?? [];
        setPosts(feed);
        setFeedMeta(fallbackJson.meta ?? {});
        setState(feed.length ? 'loaded' : 'empty');
        return;
      }

      const feed = json.posts ?? json.data ?? [];
      setPosts(feed);
      setFeedMeta(json.meta ?? {});
      setState(feed.length ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setState('error');
    }
  }, [protocol, activeSort]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

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
    void fetchFeed();
  }, [fetchFeed]);

  const handleTabChange = useCallback((sort: SortMode) => {
    setActiveSort(sort);
  }, []);

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
        <ProtocolHeader
          protocol={protocol}
          totalPosts={feedMeta.total}
          activeUsers24h={feedMeta.activeUsers24h}
        />

        {/* Protocol health banner (green/yellow/red) from live bridge health */}
        <ProtocolHealthBanner protocol={protocol} meta={feedMeta} />

        {/* Stats Cards */}
        <ProtocolStats
          protocol={protocol}
          totalPosts={feedMeta.total}
          activeUsers24h={feedMeta.activeUsers24h}
          engagementVelocity={feedMeta.engagementVelocity}
          trendingTopics={feedMeta.trending}
          color={color}
        />

        {/* Trending topics */}
        <ProtocolTrending protocol={protocol} topics={feedMeta.trending ?? []} color={color} />

        {/* Sort tabs + follow */}
        <div className="mb-4 flex items-center justify-between">
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
                  className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
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
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
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
            className="ml-auto text-[10px] font-medium transition-colors hover:underline"
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

        {/* Feed list (protocol-specific empty state via emptySlot) */}
        <FeedList
          state={state}
          posts={posts}
          error={error}
          protocolLabel={feedMeta.protocolLabel ?? protocol}
          protocolColor={color}
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
                  parentPreview: p.text.slice(0, 120),
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
              parentPreview: post.text.slice(0, 120),
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

// ─── Page Export ────────────────────────────────────────────────────

export default async function ProtocolFeedPage({ params }: Props) {
  const { protocol } = await params;
  return <ProtocolFeedContent protocol={protocol} />;
}
