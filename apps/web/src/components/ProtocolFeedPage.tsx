'use client';

import { addBookmark, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter} from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRealtimeFeed } from '../hooks/useRealtimeFeed';
import { useAuth } from './AuthProvider';
import { ContentFilterBar, type ContentType } from './ContentFilterBar';
import { ContentMosaic } from './ContentMosaic';
import { type DensityMode, DensityToggle } from './DensityToggle';
import { FeedPollerBanner } from './FeedPollerBanner';
import { ProtocolHero } from './ProtocolHero';
import { ProtocolSections } from './ProtocolSections';
import { ProtocolSidebar } from './ProtocolSidebar';
import { QuickJumpSidebar } from './QuickJumpSidebar';

const TipModal = dynamic(() => import('./TipModal').then((m) => ({ default: m.TipModal })), {
  ssr: false,
  loading: () => null,
});

// === Protocol configuration ================================================

export interface ProtocolFeedConfig {
  id: string;
  name: string;
  color: string;
  /** Background/accent color for hero cards */
  bgColor: string;
  /** Darker shade for borders */
  borderColor: string;
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
  /** Theme accent that overrides --color-accent on protocol pages */
  themeAccent?: string;
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

/** Compute backdrop/border colors from main color */
function themeFromColor(hex: string) {
  return {
    bgColor: `${hex}12`,
    borderColor: `${hex}30`,
    themeAccent: hex,
  };
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
    ...themeFromColor('#8a63d2'),
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
    ...themeFromColor('#abfe2c'),
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
    ...themeFromColor('#1185fe'),
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
    ...themeFromColor('#8e30eb'),
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
    ...themeFromColor('#6364ff'),
  },
};

/** Tabs whose id maps 1:1 onto the worker's ?sort= parameter. */
const SORT_TAB_IDS = new Set(['hot', 'quality', 'new', 'trending']);

/** Convert hex color to comma-separated RGB for CSS rgba() usage */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0,0,0';
  return `${Number.parseInt(result[1]!, 16)},${Number.parseInt(result[2]!, 16)},${Number.parseInt(result[3]!, 16)}`;
}

// === Shared component ======================================================

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
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState(config?.tabs[0]?.id ?? 'hot');
  const [_tabDirection, setTabDirection] = useState<'left' | 'right'>('right');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<UnifiedPost[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [newPostCount, setNewPostCount] = useState(0);
  const [contentType, setContentType] = useState<ContentType>('all');

  // ── Real-time feed updates via WebSocket ──
  const realtimeFeed = useRealtimeFeed('home', protocol);
  const [density, setDensity] = useState<DensityMode>('comfortable');
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const lastPostIdRef = useRef<string | null>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const prevProtocolRef = useRef<string>(protocol);

  // == Set protocol accent color on document for transition overlay ==
  useEffect(() => {
    if (config) {
      document.documentElement.style.setProperty('--protocol-accent', config.color);
      document.documentElement.style.setProperty('--protocol-accent-rgb', hexToRgb(config.color));
      document.documentElement.setAttribute('data-protocol', protocol);
      // Also set a CSS variable so FeedCards can use protocol-specific highlights
      document.documentElement.style.setProperty(
        '--protocol-accent-bg',
        config.bgColor || `${config.color}12`,
      );
    }
  }, [protocol, config]);

  // == Protocol transition flash effect (only on protocol change) ==
  useEffect(() => {
    if (prevProtocolRef.current !== protocol) {
      const prev = prevProtocolRef.current;
      prevProtocolRef.current = protocol;
      const prevConfig = PROTOCOL_CONFIGS[prev];
      const flashColor = prevConfig?.color ?? config?.color ?? '#00ff41';
      const overlay = document.createElement('div');
      overlay.className = 'protocol-transition-overlay';
      overlay.style.backgroundColor = flashColor;
      overlay.style.opacity = '0.3';
      document.body.appendChild(overlay);
      setTimeout(() => {
        overlay.remove();
      }, 700);
    }
  }, [protocol, config]);

  // == Handle tab change with smooth transition ==
  const handleTabChange = useCallback(
    (tabId: string) => {
      if (tabId === activeTab) return;
      const tabIds = config?.tabs.map((t) => t.id) ?? [];
      const oldIdx = tabIds.indexOf(activeTab);
      const newIdx = tabIds.indexOf(tabId);
      setTabDirection(newIdx > oldIdx ? 'right' : 'left');
      setTabTransitioning(true);
      startTransition(() => {
        setActiveTab(tabId);
      });
      setTimeout(() => setTabTransitioning(false), 350);
    },
    [activeTab, config],
  );

  const fetchFeed = useCallback(async () => {
    setState('loading');
    try {
      const url = new URL(config.endpoint, window.location.origin);
      url.searchParams.set('limit', '25');
      url.searchParams.set('protocols', config.feedParam);
      if (SORT_TAB_IDS.has(activeTab)) {
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
      const json = (await res.json()) as { posts?: UnifiedPost[]; meta?: FeedMeta };
      const data = json as { data?: UnifiedPost[]; meta?: FeedMeta };
      const feed = json.posts ?? data.data ?? [];
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
      const featJson = (await res.json()) as { posts?: UnifiedPost[]; data?: UnifiedPost[] };
      if (featJson.posts?.length) setFeaturedPosts(featJson.posts);
      else if (featJson.data?.length) setFeaturedPosts(featJson.data);
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
        const pollJson = (await res.json()) as { posts?: UnifiedPost[]; data?: UnifiedPost[] };
        const first = (pollJson.posts ?? pollJson.data ?? [])[0];
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

  // Handle real-time post insertion from WebSocket
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
        <p className="text-sm text-[var(--color-muted)]">
          No configuration found for &quot;{protocol}&quot;.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* == Hero section (full width) == */}
        <ProtocolHero config={config} />

        {/* == Featured posts mosaic (full width) == */}
        <ContentMosaic
          posts={featuredPosts}
          color={config.color}
          onPostClick={(id) => router.push(`/post/${encodeURIComponent(id)}`)}
          loading={featuredLoading}
        />

        {/* == Protocol-specific curated sections == */}
        <ProtocolSections protocol={config.id} color={config.color} />

        {/* == Two-column layout: feed + sidebar == */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Left column — main feed */}
          <div className="min-w-0 flex-1">
            {/* Tab bar + density toggle */}
            <div
              className="mb-4 flex items-center justify-between gap-3 overflow-x-auto border-b pb-0"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              <div
                className="flex gap-1 overflow-x-auto scrollbar-none"
                role="tablist"
                aria-label="Feed sort order"
              >
                {config.tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleTabChange(tab.id)}
                      className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'text-[var(--color-fg)]'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-muted)]'
                      }`}
                    >
                      {tab.label}
                      {isActive && (
                        <span
                          className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full transition-all duration-200"
                          style={{
                            backgroundColor: config.color,
                            boxShadow: `0 0 8px ${config.color}66`,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
                <Link
                  href={`/${config.id}/trending`}
                  className="relative whitespace-nowrap px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                >
                  📈 Trending
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full opacity-0 transition-opacity hover:opacity-60"
                    style={{ backgroundColor: config.color }}
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
                <p className="mb-4 text-xs" style={{ color: 'var(--color-muted)' }}>
                  {currentTab.description}
                </p>
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
                    ? 'Reconnecting…'
                    : 'Connecting…'}
              </span>
            </div>

            {/* == Feed */}
            {/* Real-time new posts banner */}
            {realtimeFeed.newPostCount > 0 && (
              <div className="mb-4 animate-slideDown">
                <FeedPollerBanner
                  count={realtimeFeed.newPostCount}
                  onRefresh={handleRealtimeInsert}
                />
              </div>
            )}

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
              ref={feedContainerRef}
              className={`${
                density === 'dense'
                  ? 'feed-density-dense'
                  : density === 'visual'
                    ? 'feed-density-visual'
                    : ''
              } ${tabTransitioning ? 'tab-content-exit' : 'tab-content-enter'}`}
              key={`${activeTab}-${contentType}`}
            >
              <FeedList
                state={state}
                posts={posts}
                error={error}
                protocolLabel={config.name}
                protocolColor={config.color}
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
                <p className="mx-auto max-w-xs text-sm" style={{ color: 'var(--color-muted)' }}>
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

          {/* Right column — Protocol-specific sidebar (desktop only) */}
          <div className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-[124px] space-y-3">
              <ProtocolSidebar protocol={config.id} color={config.color} />
              <QuickJumpSidebar color={config.color} activeTab={activeTab} onJump={setActiveTab} />
            </div>
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
