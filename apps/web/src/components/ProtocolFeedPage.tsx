'use client';

import { addBookmark, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { ContentFilterBar, type ContentType } from './ContentFilterBar';
import { ContentMosaic } from './ContentMosaic';
import { type DensityMode, DensityToggle } from './DensityToggle';
import { FeedPollerBanner } from './FeedPollerBanner';
import { ProtocolHero } from './ProtocolHero';
import { ProtocolSections } from './ProtocolSections';
import { QuickJumpSidebar } from './QuickJumpSidebar';

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
  const [featuredPosts, setFeaturedPosts] = useState<UnifiedPost[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [newPostCount, setNewPostCount] = useState(0);
  const [contentType, setContentType] = useState<ContentType>('all');
  const [density, setDensity] = useState<DensityMode>('comfortable');
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

  // Fetch featured posts for the mosaic
  const fetchFeatured = useCallback(async () => {
    setFeaturedLoading(true);
    try {
      const url = new URL(config.endpoint, window.location.origin);
      url.searchParams.set('limit', '6');
      url.searchParams.set('protocols', config.feedParam);
      url.searchParams.set('sort', 'quality');
      const res = await fetch(url.toString(), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        setFeaturedLoading(false);
        return;
      }
      const data = (await res.json()) as { data?: UnifiedPost[] };
      if (data.data?.length) setFeaturedPosts(data.data);
    } catch {
      // non-critical
    }
    setFeaturedLoading(false);
  }, [config]);

  // Poll for new posts
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void fetchFeed();
    void fetchFeatured();
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
  }, [fetchFeed, config, fetchFeatured]);

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
      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* ── Hero section (full width) ── */}
        <ProtocolHero config={config} />

        {/* ── Featured posts mosaic (full width) ── */}
        <ContentMosaic
          posts={featuredPosts}
          color={config.color}
          onPostClick={(id) => router.push(`/post/${encodeURIComponent(id)}`)}
          loading={featuredLoading}
        />

        {/* ── Protocol-specific curated sections ── */}
        <ProtocolSections protocol={config.id} color={config.color} />

        {/* ── Two-column layout: feed + sidebar ── */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Left column — main feed */}
          <div className="min-w-0 flex-1">
            {/* Tab bar + density toggle */}
            <div className="mb-4 flex items-center justify-between gap-3 overflow-x-auto border-b border-[var(--color-glass-border)] pb-0">
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
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
                        style={{
                          backgroundColor: config.color,
                          boxShadow: `0 0 8px ${config.color}66`,
                        }}
                      />
                    )}
                  </button>
                ))}
                {/* ── Dedicated Trending page link ── */}
                <Link
                  href={`/${config.id}/trending`}
                  className="relative whitespace-nowrap px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-300"
                >
                  📈 Trending
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full opacity-0 transition-opacity hover:opacity-60"
                    style={{
                      backgroundColor: config.color,
                    }}
                  />
                </Link>
              </div>
              <div className="hidden shrink-0 sm:block">
                <DensityToggle value={density} onChange={setDensity} color={config.color} />
              </div>
            </div>

            {/* Tab description */}
            {(() => {
              const currentTab = config.tabs.find((t) => t.id === activeTab);
              return currentTab?.description ? (
                <p className="mb-4 text-xs text-gray-500">{currentTab.description}</p>
              ) : null;
            })()}

            {/* Content type filter bar */}
            <ContentFilterBar active={contentType} onChange={setContentType} color={config.color} />

            {/* Mobile density toggle */}
            <div className="mb-3 flex sm:hidden">
              <DensityToggle value={density} onChange={setDensity} color={config.color} />
            </div>

            {/* Quick jump — mobile dropdown */}
            <QuickJumpSidebar color={config.color} activeTab={activeTab} onJump={setActiveTab} />

            {/* ── Feed */}
            <FeedPollerBanner count={newPostCount} onRefresh={handleRefresh} />

            {feedMeta.notices && feedMeta.notices.length > 0 && (
              <div className="mb-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-400">
                {feedMeta.notices.map((n) => (
                  <div key={n}>{n}</div>
                ))}
              </div>
            )}

            {/* Density class applied to feed container */}
            <div
              className={
                density === 'dense'
                  ? 'feed-density-dense'
                  : density === 'visual'
                    ? 'feed-density-visual'
                    : ''
              }
            >
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
            </div>

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
                  There are no {config.postNoun}s from {config.name} right now. This can happen when
                  the network is slow or the API is temporarily unavailable.
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="mt-4 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  style={{ backgroundColor: config.color, color: '#fff' }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Right column — Quick Jump sidebar (desktop only) */}
          <div className="hidden w-44 shrink-0 lg:block">
            <QuickJumpSidebar color={config.color} activeTab={activeTab} onJump={setActiveTab} />
          </div>
        </div>

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
