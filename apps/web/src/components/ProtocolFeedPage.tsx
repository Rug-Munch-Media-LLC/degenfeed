'use client';

import { addBookmark, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { FeedPollerBanner } from './FeedPollerBanner';
import { ProtocolSections } from './ProtocolSections';

const TipModal = dynamic(() => import('./TipModal').then((m) => ({ default: m.TipModal })), {
  ssr: false,
  loading: () => null,
});

// ─── Protocol configuration ────────────────────────────────────────────────

export interface ProtocolFeedConfig {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  /** Shown in the identity bar */
  stats: { label: string; value: string }[];
  /** Tab definitions */
  tabs: { id: string; label: string; description?: string }[];
  /** Feed endpoint query param value for this protocol */
  feedParam: string;
  /** Post type noun for empty states */
  postNoun: string;
  /** API endpoint for protocol-specific feed */
  endpoint: string;
}

/**
 * Ranking tabs shared by every protocol page. `quality` uses the
 * per-protocol quality scoring rules on the worker (?sort=quality).
 */
function buildRankingTabs(qualityDescription: string) {
  return [
    { id: 'hot', label: '🔥 Hot', description: 'High engagement in the last 24 hours' },
    { id: 'quality', label: '⭐ Quality', description: qualityDescription },
    { id: 'new', label: 'New', description: 'Chronological — latest first' },
    { id: 'trending', label: '📈 Trending', description: 'Rising engagement velocity right now' },
  ];
}

export const PROTOCOL_CONFIGS: Record<string, ProtocolFeedConfig> = {
  farcaster: {
    id: 'farcaster',
    name: 'Farcaster',
    color: '#8a63d2',
    icon: '◈',
    description: 'On-chain social network built on the Farcaster protocol',
    stats: [
      { label: 'casts today', value: '45,231' },
      { label: 'channels', value: '1,203' },
      { label: 'hub', value: 'nemes.farcaster.xyz' },
    ],
    tabs: buildRankingTabs('Verified casters, conversation starters, frames — no $DEGEN tip spam'),
    feedParam: 'farcaster',
    postNoun: 'cast',
    endpoint: '/api/feed/home',
  },
  lens: {
    id: 'lens',
    name: 'Lens',
    color: '#abfe2c',
    icon: '◎',
    description: 'Decentralized social graph on the Polygon network',
    stats: [
      { label: 'publications today', value: '8,492' },
      { label: 'profiles online', value: '22' },
      { label: 'network', value: 'Polygon' },
    ],
    tabs: [
      ...buildRankingTabs('Original publications from known creators, collected and discussed'),
      { id: 'mirrors', label: 'Mirrors', description: 'Mirrored publications' },
    ],
    feedParam: 'lens',
    postNoun: 'publication',
    endpoint: '/api/feed/home',
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    color: '#1185fe',
    icon: '☁',
    description: 'Open social network built on the AT Protocol',
    stats: [
      { label: 'skeets today', value: '23,419' },
      { label: 'custom feeds', value: '1,845' },
      { label: 'PDS', value: 'bsky.social' },
    ],
    tabs: buildRankingTabs('Custom-domain handles, original skeets with media — no reply spam'),
    feedParam: 'bluesky',
    postNoun: 'skeet',
    endpoint: '/api/feed/home',
  },
  nostr: {
    id: 'nostr',
    name: 'Nostr',
    color: '#8e30eb',
    icon: '☰',
    description: 'Notes and Other Stuff Transmitted by Relays',
    stats: [
      { label: 'notes today', value: '12,847' },
      { label: 'relays active', value: '342' },
      { label: 'top relay', value: 'wss://relay.damus.io' },
    ],
    tabs: buildRankingTabs('NIP-05 verified authors, long-form notes seen on multiple relays'),
    feedParam: 'nostr',
    postNoun: 'note',
    endpoint: '/api/feed/home',
  },
  mastodon: {
    id: 'mastodon',
    name: 'Mastodon',
    color: '#6364ff',
    icon: 'M',
    description: 'Federated social network on the ActivityPub protocol',
    stats: [
      { label: 'toots on social.degenfeed.xyz', value: '3,210' },
      { label: 'fediverse instances', value: '892' },
      { label: 'active users', value: '1,847' },
    ],
    tabs: [
      ...buildRankingTabs('Alt-texted media, proper CWs, real accounts on known instances'),
      { id: 'local', label: 'Local', description: 'From social.degenfeed.xyz' },
    ],
    feedParam: 'mastodon',
    postNoun: 'toot',
    endpoint: '/api/feed/home',
  },
};

/** Tabs whose id maps 1:1 onto the worker's ?sort= parameter. */
const SORT_TAB_IDS = new Set(['hot', 'quality', 'new', 'trending']);

// ─── Shared component ──────────────────────────────────────────────────────

interface FeedMeta {
  total?: number;
  limit?: number;
  perProtocol?: Record<string, number>;
  errors?: string[];
  notices?: string[];
}

interface Props {
  protocol: string;
}

export function ProtocolFeedPage({ protocol }: Props) {
  const config: ProtocolFeedConfig = PROTOCOL_CONFIGS[protocol] as ProtocolFeedConfig;
  const router = useRouter();
  const { engage, openComposeReply } = useAuth();

  const [activeTab, setActiveTab] = useState(config?.tabs[0]?.id ?? 'hot');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [newPostCount, setNewPostCount] = useState(0);
  const lastPostIdRef = useRef<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setState('loading');
    try {
      const url = new URL(config.endpoint, window.location.origin);
      url.searchParams.set('limit', '25');
      url.searchParams.set('protocols', config.feedParam);
      if (SORT_TAB_IDS.has(activeTab)) {
        // Hot / Quality / New / Trending map straight onto the worker sorts.
        url.searchParams.set('sort', activeTab);
      }
      if (activeTab === 'local') {
        url.searchParams.set('instance', 'social.degenfeed.xyz');
        url.searchParams.set('sort', 'new');
      }
      if (activeTab === 'mirrors') {
        url.searchParams.set('type', 'repost');
        url.searchParams.set('sort', 'hot');
      }

      const res = await fetch(url.toString(), {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      if (!res.ok) throw new Error(`Feed returned ${res.status}`);
      const data = (await res.json()) as { data?: UnifiedPost[]; meta?: FeedMeta };
      const feed = data.data ?? [];
      if (feed.length > 0) {
        lastPostIdRef.current = feed[0]?.id ?? '';
      }
      setPosts(feed);
      setFeedMeta(data.meta ?? {});
      setState(feed.length ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setState('error');
    }
  }, [config, activeTab]);

  // Poll for new posts
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void fetchFeed();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const url = new URL(config.endpoint, window.location.origin);
        url.searchParams.set('limit', '1');
        url.searchParams.set('protocols', config.feedParam);
        const res = await fetch(url.toString(), {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: UnifiedPost[] };
        const first = data.data?.[0];
        if (first && first.id !== lastPostIdRef.current) {
          setNewPostCount((c) => c + 1);
        }
      } catch {
        // ignore
      }
    }, 60_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchFeed, config]);

  const handleRefresh = useCallback(() => {
    setNewPostCount(0);
    void fetchFeed();
  }, [fetchFeed]);

  const handleRetry = useCallback(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const handleEngage = async (
    action: EngagementAction,
    postId: string,
    content?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'Post not found' };

    if ((action === 'bookmark' || action === 'unbookmark') && post.protocol !== 'mastodon') {
      try {
        if (action === 'bookmark')
          await addBookmark(
            postId,
            post.dfUri ?? '',
            post.protocol,
            post.text.slice(0, 60),
            post.author.displayName || '',
          );
        else await removeBookmark(postId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Bookmark failed' };
      }
    }

    return engage(action, postId, post.protocol, { content });
  };

  const handleCrossReplyOpen = useCallback(
    (post: UnifiedPost) => {
      const nativeId = post.id.replace(
        /^(nostr:|farcaster:|lens:|bluesky:|mastodon:|reddit:|rss:|threads:)/,
        '',
      );
      openComposeReply({
        parentPostUri: post.dfUri ?? `df://${post.protocol}:${nativeId}`,
        parentProtocol: post.protocol,
        parentPreview: post.text.slice(0, 120),
      });
    },
    [openComposeReply],
  );

  if (!config) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-[var(--color-fg)]">Unknown protocol</h1>
        <p className="text-sm text-gray-500">No configuration found for &quot;{protocol}&quot;.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-4">
        {/* ── Protocol identity bar ── */}
        <div
          className="relative mb-5 overflow-hidden rounded-2xl border p-5 transition-colors"
          style={{
            borderColor: `${config.color}33`,
            background: `linear-gradient(135deg, ${config.color}15 0%, ${config.color}08 50%, transparent 100%)`,
          }}
        >
          {/* Decorative glow */}
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: config.color }}
          />

          <div className="relative flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{
                backgroundColor: `${config.color}22`,
                color: config.color,
                boxShadow: `0 0 20px ${config.color}33`,
              }}
            >
              {config.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--color-fg)]">{config.name}</h1>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: `${config.color}22`, color: config.color }}
                >
                  {config.id}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{config.description}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {config.stats.map((s) => (
                  <div key={s.label} className="flex items-center gap-1">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: config.color }}
                    >
                      {s.value}
                    </span>
                    <span className="text-[11px] text-gray-500">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Protocol-specific curated sections ── */}
        <ProtocolSections protocol={config.id} color={config.color} />

        {/* ── Protocol tabs ── */}
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--color-glass-border)] pb-0">
          {config.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--color-fg)]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}66` }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab description */}
        {(() => {
          const currentTab = config.tabs.find((t) => t.id === activeTab);
          return currentTab?.description ? (
            <p className="mb-4 text-xs text-gray-500">{currentTab.description}</p>
          ) : null;
        })()}

        {/* ── Feed */}
        <FeedPollerBanner count={newPostCount} onRefresh={handleRefresh} />

        {feedMeta.notices && feedMeta.notices.length > 0 && (
          <div className="mb-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-400">
            {feedMeta.notices.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
        )}

        <FeedList
          state={state}
          posts={posts}
          error={error}
          protocolLabel={config.name}
          onPostClick={(id) => router.push(`/post/${encodeURIComponent(id)}`)}
          onEngage={handleEngage}
          onTip={(post) => setTipPost(post)}
          onRetry={handleRetry}
          onCrossReplyOpen={handleCrossReplyOpen}
        />

        {/* Protocol-specific empty state */}
        {state === 'empty' && (
          <div
            className="mt-6 rounded-xl border py-10 text-center"
            style={{ borderColor: `${config.color}22`, backgroundColor: `${config.color}05` }}
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{ backgroundColor: `${config.color}18`, color: config.color }}
            >
              {config.icon}
            </div>
            <h3 className="mb-1 text-base font-bold" style={{ color: config.color }}>
              No {config.postNoun}s found
            </h3>
            <p className="mx-auto max-w-xs text-sm text-gray-500">
              There are no {config.postNoun}s from {config.name} right now. This can happen when the
              network is slow or the API is temporarily unavailable.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all"
              style={{ backgroundColor: config.color }}
            >
              Retry
            </button>
          </div>
        )}

        {tipPost && (
          <TipModal
            open={!!tipPost}
            onClose={() => setTipPost(null)}
            recipientProtocol={tipPost.protocol}
            recipientAuthorId={tipPost.author.id}
            recipientDisplayName={tipPost.author.displayName}
            publicationId={
              tipPost.protocol === 'lens' ? (tipPost.raw as { id?: string })?.id : undefined
            }
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
