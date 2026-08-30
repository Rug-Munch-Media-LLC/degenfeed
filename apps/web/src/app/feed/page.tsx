'use client';

import { addBookmark, getFollows, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import {
  CardSkeleton,
  ErrorBoundary,
  FeedWhyCard,
  NotificationBell,
  PostCard,
  PostCardGuard,
  ScrollToTop,
} from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { CryptoRugMunchHeader } from '../../components/brand/CryptoRugMunchHeader';
import { FeedComposer } from '../../components/FeedComposer';
import { FeedLayoutSwitcher } from '../../components/FeedLayoutSwitcher';
import type { FeedMixConfig, SavedMix } from '../../components/FeedTuner';
import {
  encodeTopicWeights,
  FeedTuner,
  getDefaultFeedMixConfig,
  getDefaultWeights,
  loadFeedMixConfig,
  loadSavedMixes,
  saveFeedMixConfig,
  saveSavedMixes,
} from '../../components/FeedTuner';
import { FeedControls } from '../../components/feed/FeedControls';
import { FeedFilterBar, FeedTabBar } from '../../components/feed/FeedFilterBar';
import {
  FeedAuthBanner,
  FeedEmptyState,
  FeedErrorState,
  FeedNewPostsBanner,
  FeedProtocolSummary,
} from '../../components/feed/FeedStates';
import { FEED_PRESETS } from '../../components/feed/feedPresets';
import { PullToRefresh } from '../../components/feed/PullToRefresh';
import { GettingStartedChecklist } from '../../components/GettingStartedChecklist';
import { GuidedTour } from '../../components/GuidedTour';
import { PostContextMenu, useContextMenu } from '../../components/PostContextMenu';
import { useAnnouncer } from '../../components/ScreenReaderAnnouncer';
import { useAlgorithmProfile } from '../../hooks/useAlgorithmProfile';
import { useEdgeSwipeBack } from '../../hooks/useEdgeSwipeBack';
import { useFeedControls } from '../../hooks/useFeedControls';
import { useFeedLayout } from '../../hooks/useFeedLayout';
import { useFeedPoller } from '../../hooks/useFeedPoller';
import { useFeedPosition } from '../../hooks/useFeedPosition';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { useNotifications } from '../../hooks/useNotifications';
import { useReadingProgress } from '../../hooks/useReadingProgress';
import { useRealtimeFeed } from '../../hooks/useRealtimeFeed';
import { useReturningUser } from '../../hooks/useReturningUser';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import type { FeedControls as FeedControlsState } from '../../lib/feedRanking';
import { fetchWithSwr, getCached } from '../../lib/fetchWithCache';
import { rankTopAlgo } from '../../lib/topAlgo';
import { useInitialFeed } from './components/InitialFeedContext';
import { ReadingProgressBar } from './components/ReadingProgressBar';
import { ShareSheet } from './components/ShareSheet';

const TipModal = dynamic(
  () => import('../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

type Tab = 'for-you' | 'following' | 'trending' | 'news' | 'custom-mix';

/**
 * Compact inline fallback for non-critical feed widgets (controls, filter
 * bars, modals). If one widget throws, the rest of the timeline keeps
 * rendering — a broken tuner must never take down the whole feed.
 */
function WidgetErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="my-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-center text-xs text-yellow-400">
          This control couldn&apos;t be displayed. The rest of the feed is unaffected.
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

const ADMIN_WALLETS_RAW =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_ADMIN_WALLETS || '' : '';
const ADMIN_WALLETS = new Set(
  ADMIN_WALLETS_RAW.split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean),
);

const FEED_TABS = [
  { id: 'for-you' as Tab, label: 'For You' },
  { id: 'following' as Tab, label: 'Following' },
  { id: 'trending' as Tab, label: 'Trending' },
  { id: 'news' as Tab, label: 'News' },
  { id: 'custom-mix' as Tab, label: 'Custom Mix' },
];

interface FeedMeta {
  total?: number;
  limit?: number;
  page?: number;
  hasMore?: boolean;
  perProtocol?: Record<string, number>;
  errors?: string[];
  notices?: string[];
  providerSources?: Record<string, string>;
  trending?: { topic: string; count: number; score: number }[];
  topOfHour?: string | null;
  fetchedAt?: number;
  personalization?: {
    hasProfile: boolean;
    boostApplied: boolean;
    isOnboarding: boolean;
    reasons?: string[];
  };
}

export default function FeedPage() {
  const { openSignIn, signedInProtocols, engage, publish, ready, walletAddress } = useAuth();
  const isAdmin = walletAddress ? ADMIN_WALLETS.has(walletAddress.toLowerCase()) : false;

  const [activeTab, setActiveTab] = useState<Tab>('for-you');
  // Server-rendered initial posts arrive via InitialFeedProvider (feed/layout.tsx
  // fetches them with a bounded 1.6s budget). Using them as the useState seed
  // means the very first SSR + hydration render already shows content — no
  // skeleton flash, no post-hydration DOM swap.
  const initialPosts = useInitialFeed();
  const [posts, setPosts] = useState<UnifiedPost[]>(initialPosts);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>(
    initialPosts.length > 0 ? 'loaded' : 'loading',
  );
  // True while a full feed fetch is in flight. When posts
  // already exist we keep showing them (SWR stale-while-revalidate) and just
  // surface a subtle "Loading fresh content…" indicator instead of wiping the
  // timeline or flashing skeletons over content.
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [hideLowQuality, setHideLowQuality] = useState(false);
  // Fixed quality threshold — surfaced in the fetch URL when hideLowQuality is on.
  const hideThreshold = 1.0;
  const [allowNonCrypto, setAllowNonCrypto] = useState(false);
  const [recencyWeight, setRecencyWeight] = useState(1.0);
  const [engagementWeight, setEngagementWeight] = useState(1.0);
  const [showOriginalContent, setShowOriginalContent] = useState(false);
  const [minEngagement, setMinEngagement] = useState(0);
  const [maxPerNiche, setMaxPerNiche] = useState(5);
  // User-controllable feed controls: sort, protocols, content type, time,
  // niches, and "My Algorithm" weights. Persisted to URL + localStorage by
  // the hook; forwarded to the bridge feed endpoint and applied client-side
  // (the bridge returns a deduplicated, unsorted mix today).
  const {
    controls,
    setControls: setFeedControls,
    patchControls: patchFeedControls,
  } = useFeedControls();
  const [algorithmTransparent, setAlgorithmTransparent] = useState(false);
  const [freshnessPreference, setFreshnessPreference] = useState(50);
  const [creatorDiversity, setCreatorDiversity] = useState(5);
  const [exploreRatio, setExploreRatio] = useState(30);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  // Top-tier 2026 algorithm: engagement profile (localStorage) powers
  // personalization + serendipity; the "Why this?" card explains each post.
  const { profile: algoProfile, recordEngagement: recordAlgoEngagement } = useAlgorithmProfile();
  const [whyPost, setWhyPost] = useState<UnifiedPost | null>(null);
  // Ref mirrors the latest profile so fetchFeed can personalize without being
  // re-created (and re-fetching) on every engagement action.
  const algoProfileRef = useRef(algoProfile);
  algoProfileRef.current = algoProfile;
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const { unreadCount, notifications, fetchNotifications, markRead, markAllRead } =
    useNotifications();
  const { layout, setLayout, isCompact } = useFeedLayout();
  const feedContainerRef = useRef<HTMLDivElement>(null);
  useFeedPosition(feedContainerRef);
  const swipeHandlers = useSwipeTabs(
    () => setActiveTab('following'),
    () => setActiveTab('for-you'),
  );
  useEdgeSwipeBack(() => window.history.back());
  const haptic = useHapticFeedback();
  const returnUser = useReturningUser();

  // ── Real-time feed updates via WebSocket ──
  const realtimeProtocol = controls.protocols.length === 1 ? controls.protocols[0] : null;
  const realtimeFeed = useRealtimeFeed(
    activeTab === 'trending' ? 'trending' : activeTab === 'following' ? 'home' : 'for-you',
    realtimeProtocol,
  );
  const realtimeInsertedRef = useRef(false);

  // When the user clicks the real-time banner, insert queued posts
  const handleRealtimeInsert = useCallback(() => {
    const queued = realtimeFeed.insertQueued();
    if (queued.length > 0) {
      realtimeInsertedRef.current = true;
      setPosts((prev) => {
        const newPosts = queued.map((q) => q.post);
        const existingIds = new Set(prev.map((p) => p.id));
        const trulyNew = newPosts.filter((p) => !existingIds.has(p.id));
        if (trulyNew.length === 0) return prev;
        return [...trulyNew, ...prev];
      });
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [realtimeFeed]);

  // Auto-insert posts when user is at the top of the feed
  useEffect(() => {
    if (realtimeFeed.newPostCount > 0 && !realtimeInsertedRef.current) {
      // Check if user is near the top — handled via scroll detection in the hook
      const checkAndAutoInsert = () => {
        if (window.scrollY < 80) {
          handleRealtimeInsert();
        }
      };
      // Give the DOM a moment to render
      const timer = setTimeout(checkAndAutoInsert, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [realtimeFeed.newPostCount, handleRealtimeInsert]);

  // Reset the insertion flag when posts change (e.g., tab switch)
  useEffect(() => {
    realtimeInsertedRef.current = false;
  }, []);

  const [topicWeights, setTopicWeights] = useState<Record<string, number>>({});
  const [showTuner, setShowTuner] = useState(false);
  // Infinite scroll pagination: page N is requested with ?page=N and appended
  // (deduped) to the timeline. hasMore comes from the API meta.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedMixConfig, setFeedMixConfig] = useState<FeedMixConfig>(() => loadFeedMixConfig());
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(() => loadSavedMixes());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tuneTopicWeightsDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showComposer, setShowComposer] = useState(false);
  const [popupPost, setPopupPost] = useState<UnifiedPost | null>(null);
  // Reading progress through the feed timeline — drives the top progress bar.
  const readingProgress = useReadingProgress('feed-scroll-container');
  const { announce } = useAnnouncer();
  const announcerRef = useRef<ReturnType<typeof useAnnouncer>['announce'] | null>(null);
  announcerRef.current = announce;

  const persistTopicWeights = useCallback((weights: Record<string, number>) => {
    if (tuneTopicWeightsDebounce.current) clearTimeout(tuneTopicWeightsDebounce.current);
    tuneTopicWeightsDebounce.current = setTimeout(() => {
      fetch('/api/preferences/topic-weights', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ weights }),
      }).catch(() => {});
    }, 1000);
  }, []);

  const handleTunerWeightsChange = useCallback(
    (weights: Record<string, number>) => {
      setTopicWeights(weights);
      persistTopicWeights(weights);
    },
    [persistTopicWeights],
  );

  const handleTunerReset = useCallback(() => {
    const def = getDefaultWeights();
    setTopicWeights(def);
    persistTopicWeights(def);
  }, [persistTopicWeights]);

  const persistPrefs = useCallback((patch: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch('/api/preferences/feed', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => {});
    }, 800);
  }, []);

  // FeedControls → state + URL/localStorage (hook) + server preference sync.
  const handleControlsChange = useCallback(
    (next: FeedControlsState) => {
      setFeedControls(next);
      persistPrefs({
        sort: next.sort,
        protocols: next.protocols,
        timeRange: next.timeRange,
        contentTypes: next.contentTypes,
        niches: next.niches,
        algorithm: next.algorithm,
      });
    },
    [setFeedControls, persistPrefs],
  );

  const handleFeedMixChange = useCallback((config: FeedMixConfig) => {
    setFeedMixConfig(config);
    saveFeedMixConfig(config);
  }, []);
  const handleFeedMixReset = useCallback(() => {
    const def = getDefaultFeedMixConfig();
    setFeedMixConfig(def);
    saveFeedMixConfig(def);
  }, []);
  const handleSaveMix = useCallback((mix: SavedMix) => {
    setSavedMixes((prev) => {
      const next = [...prev.filter((m) => m.id !== mix.id), mix];
      saveSavedMixes(next);
      return next;
    });
  }, []);
  const handleLoadMix = useCallback((mix: SavedMix) => {
    setFeedMixConfig(mix.config);
    saveFeedMixConfig(mix.config);
  }, []);
  const handleDeleteMix = useCallback((id: string) => {
    setSavedMixes((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveSavedMixes(next);
      return next;
    });
  }, []);

  const applyFeedPreset = useCallback((presetId: string) => {
    const preset = FEED_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setFreshnessPreference(preset.config.freshnessPreference);
    setCreatorDiversity(preset.config.creatorDiversity);
    setExploreRatio(preset.config.exploreRatio);
    setAlgorithmTransparent(preset.config.algorithmTransparent);
    setRecencyWeight(preset.config.recencyWeight);
    setEngagementWeight(preset.config.engagementWeight);
    setActivePreset(presetId);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/preferences/feed', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          topicWeights?: Record<string, number>;
          hideLowQuality?: boolean;
          allowNonCrypto?: boolean;
          recencyWeight?: number;
          engagementWeight?: number;
          protocolFilter?: string | null;
          freshnessPreference?: number;
          creatorDiversity?: number;
          exploreRatio?: number;
          algorithmTransparent?: boolean;
          showOriginalContent?: boolean;
          minEngagement?: number;
          maxPerNiche?: number;
        };
        if (data.topicWeights) setTopicWeights(data.topicWeights);
        if (typeof data.hideLowQuality === 'boolean') setHideLowQuality(data.hideLowQuality);
        if (typeof data.allowNonCrypto === 'boolean') setAllowNonCrypto(data.allowNonCrypto);
        if (data.recencyWeight) setRecencyWeight(data.recencyWeight);
        if (data.engagementWeight) setEngagementWeight(data.engagementWeight);
        if (data.protocolFilter) patchFeedControls({ protocols: [data.protocolFilter] });
        if (typeof data.freshnessPreference === 'number')
          setFreshnessPreference(data.freshnessPreference);
        if (typeof data.creatorDiversity === 'number') setCreatorDiversity(data.creatorDiversity);
        if (typeof data.exploreRatio === 'number') setExploreRatio(data.exploreRatio);
        if (typeof data.algorithmTransparent === 'boolean')
          setAlgorithmTransparent(data.algorithmTransparent);
        if (typeof data.showOriginalContent === 'boolean')
          setShowOriginalContent(data.showOriginalContent);
        if (data.minEngagement) setMinEngagement(data.minEngagement);
        if (data.maxPerNiche) setMaxPerNiche(data.maxPerNiche);
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [patchFeedControls]);

  // Right-click context menu — real cursor position tracked by useContextMenu;
  // PostContextMenu handles outside-click + Escape closing internally.
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  const toggleHideLowQuality = useCallback(() => {
    setHideLowQuality((p) => {
      const next = !p;
      persistPrefs({ hideLowQuality: next });
      return next;
    });
  }, [persistPrefs]);

  // Memoized feed content to optimize re-renders
  const announceFeed = useCallback((msg: string, priority?: 'polite' | 'assertive') => {
    announcerRef.current?.(msg, priority);
  }, []);

  // Build the unified-feed URL for a given page. Shared by the main fetch and
  // the background poller so both hit the same effective feed.
  const buildFeedUrl = useCallback(
    (pageNum: number) => {
      const endpoint = '/api/feed/unified';
      const url = new URL(endpoint, window.location.origin);
      // Fixed 50-post pages; ?page=N advances the cursor (offset pagination
      // implemented on the api-server + bridge).
      url.searchParams.set('limit', '50');
      url.searchParams.set('page', String(pageNum));
      // Only send an explicit `protocols` filter when the user has chosen
      // one. With no filter, the worker aggregates EVERY registered
      // protocol (68+) into the master unified feed instead of a small
      // hard-coded subset.
      if (controls.protocols.length > 0) {
        url.searchParams.set('protocols', controls.protocols.join(','));
      }
      // User-controlled feed params — forwarded to the bridge feed endpoint.
      // The bridge honors protocols/limit today; the rest are applied
      // client-side and ready for server-side adoption.
      url.searchParams.set('sort', controls.sort);
      url.searchParams.set('time', controls.timeRange);
      if (controls.contentTypes.length > 0)
        url.searchParams.set('contentType', controls.contentTypes.join(','));
      if (controls.niches.length > 0) url.searchParams.set('niches', controls.niches.join(','));
      if (controls.algorithm.recencyQuality !== 50)
        url.searchParams.set('recencyQuality', String(controls.algorithm.recencyQuality));
      if (controls.algorithm.engagementDiversity !== 50)
        url.searchParams.set('engagementDiversity', String(controls.algorithm.engagementDiversity));
      if (controls.algorithm.protocolDiversity !== 50)
        url.searchParams.set('protocolDiversity', String(controls.algorithm.protocolDiversity));
      if (controls.algorithm.familiarDiscover !== 50)
        url.searchParams.set('familiarDiscover', String(controls.algorithm.familiarDiscover));
      if (controls.algorithm.creatorSize !== 50)
        url.searchParams.set('creatorSize', String(controls.algorithm.creatorSize));
      if (activeTab === 'following') url.searchParams.set('filter', 'following');
      if (hideLowQuality) {
        url.searchParams.set('hideLowQuality', 'true');
        url.searchParams.set('hideLowQualityThreshold', String(hideThreshold));
      }
      if (allowNonCrypto) url.searchParams.set('allowNonCrypto', 'true');
      if (showOriginalContent) url.searchParams.set('showOriginalContent', 'true');
      if (minEngagement > 0) url.searchParams.set('minEngagement', String(minEngagement));
      if (maxPerNiche < 5) url.searchParams.set('maxPerNiche', String(maxPerNiche));
      if (recencyWeight !== 1) url.searchParams.set('recencyWeight', String(recencyWeight));
      if (engagementWeight !== 1)
        url.searchParams.set('engagementWeight', String(engagementWeight));
      const tw = encodeTopicWeights(topicWeights);
      if (tw) url.searchParams.set('topic_weights', tw);
      if (algorithmTransparent) url.searchParams.set('algorithmTransparent', 'true');
      if (freshnessPreference !== 50)
        url.searchParams.set('freshness', String(freshnessPreference));
      if (creatorDiversity !== 5)
        url.searchParams.set('creatorDiversity', String(creatorDiversity));
      if (exploreRatio !== 30) url.searchParams.set('exploreRatio', String(exploreRatio));
      if (activePreset) url.searchParams.set('preset', activePreset);
      return url;
    },
    [
      controls,
      activeTab,
      hideLowQuality,
      allowNonCrypto,
      showOriginalContent,
      minEngagement,
      maxPerNiche,
      recencyWeight,
      engagementWeight,
      topicWeights,
      algorithmTransparent,
      freshnessPreference,
      creatorDiversity,
      exploreRatio,
      activePreset,
    ],
  );

  const fetchFeed = useCallback(
    async (pageNum = 1, append = false) => {
      // Skip hard loading state when content already exists — page keeps
      // showing the current timeline while revalidating in the background.
      // Only the very first load (no posts yet) falls back to the skeleton.
      // Append-mode (infinite scroll) shows the sentinel spinner instead.
      if (!append) setRefreshing(true);
      try {
        // Try the unified cross-protocol timeline first. Anonymous and
        // signed-in users read the same aggregated feed; personalization is
        // applied client-side below via rankTopAlgo. If the bridge worker is
        // stale and returns an empty/error payload, fetchFeed falls back to
        // per-protocol feeds below.
        // The SWR cache key is derived from the full query string (built by
        // buildFeedUrl), so every control/preference change gets its own bucket.
        const url = buildFeedUrl(pageNum);
        const cacheKey = `feed_${hasSignedIn ? 'signed' : 'anon'}_${activeTab}_${pageNum}_${url.searchParams.toString()}`;

        // Try the unified feed first. If it returns empty or errors (e.g. a
        // stale bridge worker), fall back to fetching each protocol
        // individually in parallel so the feed still renders.
        let feed: UnifiedPost[] = [];
        let feedMetaData: FeedMeta = {};
        let swrFromCache = false;
        let swrStale = false;

        try {
          const swrResult = await fetchWithSwr<{ data?: UnifiedPost[]; meta?: FeedMeta }>(
            url.toString(),
            cacheKey,
            { credentials: 'include' },
          );
          const data = swrResult.data;
          feed = data.data ?? [];
          feedMetaData = data.meta ?? {};
          swrFromCache = swrResult.fromCache;
          swrStale = swrResult.stale;
        } catch {
          // Unified feed errored — fall through to the per-protocol fallback.
        }

        // ── Per-protocol fallback ──
        // When the unified feed is empty or errored, fetch each protocol
        // individually (limit 10 each) in parallel, then merge + dedupe +
        // sort by date (newest first).
        let fallbackRan = false;
        let fallbackAllErrored = false;
        if (feed.length === 0) {
          fallbackRan = true;
          const fallbackProtocols =
            controls.protocols.length > 0
              ? controls.protocols
              : ['nostr', 'farcaster', 'rss', 'mastodon', 'bluesky'];
          const results = await Promise.allSettled(
            fallbackProtocols.map((p) =>
              fetch(`/api/feed/${encodeURIComponent(p)}?limit=10&page=${pageNum}`, {
                credentials: 'include',
                cache: 'no-store',
              }).then((r) => r.json() as Promise<{ data?: UnifiedPost[]; error?: string }>),
            ),
          );
          const successful = fallbackProtocols
            .map((protocol, i) => {
              const r = results[i];
              return r && r.status === 'fulfilled' && !r.value.error && Array.isArray(r.value.data)
                ? { protocol, posts: r.value.data as UnifiedPost[] }
                : null;
            })
            .filter((x): x is { protocol: string; posts: UnifiedPost[] } => x !== null);
          const allPosts = successful.flatMap((s) => s.posts);
          fallbackAllErrored = results.length > 0 && successful.length === 0;
          if (allPosts.length > 0) {
            const seen = new Set<string>();
            feed = allPosts
              .filter((p) => {
                if (!p || seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
              })
              .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
            feedMetaData = {
              ...feedMetaData,
              perProtocol: Object.fromEntries(successful.map((s) => [s.protocol, s.posts.length])),
              notices: [
                ...(feedMetaData.notices ?? []),
                'Unified feed unavailable — showing per-protocol results.',
              ],
            };
          }
        }

        if (activeTab === 'following') {
          try {
            const follows = await getFollows('self');
            const ids = new Set(follows.map((f) => f.targetId));
            feed = feed.filter((p) => ids.has(p.author.id));
          } catch {
            /* ignore */
          }
        }

        // Apply the top-tier 2026 algorithm: user sliders (recency/quality,
        // familiar/discover, creator size, protocol weights) blended with the
        // engagement profile, genre-aware freshness, creator reputation,
        // engagement velocity, author-diversity caps, cold-start discovery,
        // and serendipity injection. Every post gets a score + reasons so the
        // "Why this?" card can explain it.
        const protocolWeights = Object.fromEntries(
          Object.entries(feedMixConfig.protocols).map(([id, p]) => [id, p.weight]),
        );
        feed = rankTopAlgo(feed, controls, {
          profile: algoProfileRef.current,
          protocolWeights,
        });

        const nextHasMore = feedMetaData.hasMore ?? feed.length >= 50;
        if (append) {
          // Infinite scroll: merge the next page at the end, deduping by id.
          // Existing posts keep their position so the scroll stays put.
          setPosts((prev) => {
            if (feed.length === 0) return prev;
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...feed.filter((p) => !seen.has(p.id))];
          });
          setHasMore(nextHasMore);
          if (feed.length > 0) setState('loaded');
          setLoadingMore(false);
          return;
        }
        setPosts(feed);
        setHasMore(nextHasMore);
        setFeedMeta(feedMetaData);
        // Show the error state only when the unified feed AND every protocol
        // fallback failed. A partially successful fallback renders as loaded;
        // an all-empty result renders as empty.
        setState(feed.length ? 'loaded' : fallbackRan && fallbackAllErrored ? 'error' : 'empty');
        if (feed.length === 0 && fallbackRan && fallbackAllErrored) {
          setError('All feed sources are unavailable right now.');
        } else if (swrStale) {
          setError('Showing cached results. Updating…');
        } else {
          setError(undefined);
        }
        if (!append && feed.length > 0)
          announceFeed(`${feed.length} posts loaded${swrFromCache ? ' (cached)' : ''}`, 'polite');
      } catch (err) {
        setLoadingMore(false);
        if (!append) {
          const cached = getCached<{ data?: UnifiedPost[]; meta?: FeedMeta }>(`feed_${activeTab}`);
          if (cached && (cached.data ?? []).length > 0) {
            setPosts(cached.data ?? []);
            setFeedMeta(cached.meta ?? {});
            setState('loaded');
            setError("Couldn't load feed. Showing cached version.");
          } else {
            setError(err instanceof Error ? err.message : 'Failed');
            setState('error');
          }
        }
      } finally {
        if (!append) setRefreshing(false);
      }
    },
    [activeTab, hasSignedIn, feedMixConfig, controls, buildFeedUrl, announceFeed],
  );

  // ── Background polling (useFeedPoller) ──
  // Replaces the old hand-rolled setInterval: polls page 1 of the same
  // effective feed, detects newly-arrived post ids, and pauses while the tab
  // is hidden (resumes with an immediate poll on return).
  const pollFeed = useCallback(async () => {
    const res = await fetch(buildFeedUrl(1).toString(), { credentials: 'include' });
    const data = (await res.json()) as { data?: UnifiedPost[] };
    return data.data ?? [];
  }, [buildFeedUrl]);
  const feedPoller = useFeedPoller(pollFeed, 60000);

  /** Load the next page of posts (infinite scroll / "Load more" button). */
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || state !== 'loaded') return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    void fetchFeed(next, true);
  }, [loadingMore, hasMore, state, page, fetchFeed]);

  const refreshNow = useCallback(() => {
    feedPoller.refresh();
    setPage(1);
    setHasMore(true);
    fetchFeed(1);
  }, [fetchFeed, feedPoller]);

  // Composing requires auth — anonymous visitors are prompted to sign in
  // instead of hitting a dead-end composer with no connected protocols.
  const handleComposeClick = useCallback(() => {
    if (!hasSignedIn) {
      openSignIn();
      return;
    }
    setShowComposer(true);
  }, [hasSignedIn, openSignIn]);

  const handleEngage = async (
    action: EngagementAction,
    postId: string,
    content?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'Post not found' };
    // Bookmark/unbookmark work locally without an account; all other
    // engagement (like, repost, reply) requires signing in first.
    if (!hasSignedIn && action !== 'bookmark' && action !== 'unbookmark') {
      openSignIn();
      return { ok: false, error: 'Sign in to like, repost, or reply' };
    }
    if (['like', 'unlike'].includes(action)) haptic.triggerLike();
    else if (['repost', 'unrepost'].includes(action)) haptic.triggerRepost();
    else if (['bookmark', 'unbookmark'].includes(action)) haptic.triggerBookmark();
    else if (action === 'reply') haptic.triggerReply();
    if ((action === 'bookmark' || action === 'unbookmark') && post.protocol !== 'mastodon') {
      try {
        if (action === 'bookmark')
          await addBookmark(
            postId,
            post.dfUri ?? '',
            post.protocol,
            (post.text ?? '').slice(0, 60),
            post.author.displayName || '',
          );
        else await removeBookmark(postId);
        if (action === 'bookmark') recordAlgoEngagement(post, 'bookmark');
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Bookmark failed' };
      }
    }
    const engageResult = await engage(action, postId, post.protocol, { content: content ?? '' });
    // Feed the algorithm's engagement profile so it can personalize + explain.
    if (engageResult.ok) {
      if (action === 'like' || action === 'repost' || action === 'reply') {
        recordAlgoEngagement(post, action);
      }
    }
    return engageResult;
  };

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // No auth gate: the unified feed is public and renders for ALL users
  // (logged in or not). Auth is only required for posting/engaging, which is
  // handled by FeedAuthBanner (above), handleComposeClick, and handleEngage.
  return (
    <ErrorBoundary>
      <ReadingProgressBar progress={readingProgress} />
      <PullToRefresh onRefresh={refreshNow} disabled={state === 'loading'}>
        <div
          ref={feedContainerRef}
          id="feed-scroll-container"
          className="mx-auto max-w-2xl px-4 py-6"
          {...swipeHandlers}
        >
          {/* @CryptoRugMunch profile header — brands this feed as part of the Rug Munch Intelligence platform */}
          <CryptoRugMunchHeader />
          {isAdmin && (
            <div className="mb-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-[10px] text-amber-400">
              Admin mode
            </div>
          )}
          {!hasSignedIn && <FeedAuthBanner onSignIn={openSignIn} />}
          {!isCompact && <GettingStartedChecklist />}
          {returnUser && <GuidedTour />}

          {/* Feed controls: sort, protocols, content type, time, niches, algorithm */}
          <WidgetErrorBoundary>
            <FeedControls
              controls={controls}
              onChange={handleControlsChange}
              resultCount={state === 'loaded' ? posts.length : undefined}
            />
          </WidgetErrorBoundary>

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

          <div className="mb-4 flex items-center justify-between">
            <FeedTabBar
              tabs={FEED_TABS}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as Tab)}
            />
            <div className="flex items-center gap-2">
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onFetch={fetchNotifications}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
              />
              <FeedLayoutSwitcher current={layout} onChange={setLayout} />
              <button
                type="button"
                onClick={handleComposeClick}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/20 text-degen-400 hover:bg-degen-500/30 transition-colors"
                aria-label="Compose"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M7 1v12M1 7h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <WidgetErrorBoundary>
            <FeedFilterBar
              hideLowQuality={hideLowQuality}
              onToggleHideLowQuality={toggleHideLowQuality}
              allowNonCrypto={allowNonCrypto}
              onToggleAllowNonCrypto={() => {
                setAllowNonCrypto((p) => {
                  const n = !p;
                  persistPrefs({ allowNonCrypto: n });
                  return n;
                });
              }}
              showOriginalContent={showOriginalContent}
              onToggleShowOriginal={() => {
                setShowOriginalContent((p) => {
                  const n = !p;
                  persistPrefs({ showOriginalContent: n });
                  return n;
                });
              }}
              minEngagement={minEngagement}
              onMinEngagementChange={(v) => {
                setMinEngagement(v);
                persistPrefs({ minEngagement: v });
              }}
              protocolFilter={
                controls.protocols.length === 1 ? (controls.protocols[0] ?? null) : null
              }
              onProtocolFilterChange={(v) =>
                handleControlsChange({ ...controls, protocols: v ? [v] : [] })
              }
              onOpenTuner={() => setShowTuner(true)}
            />
          </WidgetErrorBoundary>

          <FeedProtocolSummary meta={feedMeta} />
          {feedMeta?.notices?.map((n, i) => (
            <div key={i} className="mb-3 rounded-lg bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
              {n}
            </div>
          ))}
          {feedMeta?.errors?.map((e, i) => (
            <div key={i} className="mb-3 rounded-lg bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {e}
            </div>
          ))}
          {/* Real-time new posts banner (WebSocket) */}
          {realtimeFeed.newPostCount > 0 && (
            <div className="mb-4 animate-slideDown">
              <FeedNewPostsBanner
                count={realtimeFeed.newPostCount}
                onRefresh={handleRealtimeInsert}
              />
            </div>
          )}

          {/* Polling new posts banner (fallback) */}
          {feedPoller.newPostCount > 0 && realtimeFeed.newPostCount === 0 && (
            <div className="mb-4">
              <FeedNewPostsBanner count={feedPoller.newPostCount} onRefresh={refreshNow} />
            </div>
          )}

          {/* Stale-while-revalidate indicator: fresh data is being fetched in
              the background but the current timeline stays visible. */}
          {refreshing && state === 'loaded' && posts.length > 0 && (
            <div
              className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-degen-500/20 bg-degen-500/5 px-3 py-1.5"
              role="status"
              aria-live="polite"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-degen-400" />
              <span className="text-[10px] font-medium text-degen-400">Loading fresh content…</span>
            </div>
          )}

          {state === 'loading' && (
            <div role="status" aria-live="polite">
              <div className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-degen-500/20 bg-degen-500/5 px-3 py-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-degen-400" />
                <span className="text-[10px] font-medium text-degen-400">
                  Loading fresh content…
                </span>
              </div>
              {/* CardSkeleton mirrors PostCard dimensions exactly (h-8 w-8
                  avatar, three text lines, engagement row) so there's no
                  layout shift when real posts replace it. */}
              <CardSkeleton count={5} avatar lines={3} />
            </div>
          )}
          {state === 'empty' && (
            <FeedEmptyState activeTab={activeTab} onRefresh={() => fetchFeed()} />
          )}
          {state === 'error' && (
            <FeedErrorState error={error || 'Unknown error'} onRetry={() => fetchFeed()} />
          )}

          {state === 'loaded' && (
            <>
              <div className="stagger-enter">
                {posts.map((post, i) => (
                  <div
                    key={post.id}
                    className="relative"
                    style={{ '--stagger-i': i } as React.CSSProperties}
                  >
                    <PostCardGuard postId={post.id}>
                      <PostCard
                        post={post}
                        onEngage={handleEngage}
                        onWhyThisPost={setWhyPost}
                        onContextMenu={handleContextMenu}
                        mediaPriority={i < 3}
                      />
                    </PostCardGuard>
                  </div>
                ))}
              </div>
              {hasMore && posts.length > 0 && (
                <div className="mt-8 text-center">
                  <button type="button" onClick={loadMore} className="btn-secondary text-sm">
                    Load more
                  </button>
                </div>
              )}
              {/* Context menu — positioned at the right-click cursor via useContextMenu */}
              {contextMenu && (
                <PostContextMenu
                  postId={contextMenu.postId}
                  postUrl={contextMenu.postUrl}
                  open
                  position={contextMenu.position}
                  onClose={closeContextMenu}
                />
              )}

              {/* Algorithm transparency — "Why this?" on every post */}
              {whyPost && (
                // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop — click-to-dismiss is the affordance; keyboard users dismiss via the Escape onKeyDown below and the dialog's close button
                <div
                  className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                  onClick={() => setWhyPost(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setWhyPost(null);
                  }}
                  role="presentation"
                >
                  <div
                    className="w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Why this post?"
                  >
                    <FeedWhyCard post={whyPost} onClose={() => setWhyPost(null)} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Composer */}
          {showComposer && (
            <WidgetErrorBoundary>
              <FeedComposer
                signedInProtocols={signedInProtocols}
                onPost={publish}
                onRequestSignIn={openSignIn}
              />
            </WidgetErrorBoundary>
          )}

          {/* Tip modal */}
          {tipPost && (
            <WidgetErrorBoundary>
              <TipModal
                open={true}
                onClose={() => setTipPost(null)}
                recipientProtocol={tipPost.protocol}
                recipientAuthorId={tipPost.author.id}
                recipientDisplayName={tipPost.author.displayName}
                publicationId={tipPost.id}
              />
            </WidgetErrorBoundary>
          )}

          {/* Share sheet */}
          {popupPost && (
            <WidgetErrorBoundary>
              <ShareSheet post={popupPost} open={!!popupPost} onClose={() => setPopupPost(null)} />
            </WidgetErrorBoundary>
          )}

          {/* Feed tuner */}
          {showTuner && (
            <WidgetErrorBoundary>
              <FeedTuner
                topicWeights={topicWeights}
                onWeightsChange={handleTunerWeightsChange}
                onReset={handleTunerReset}
                feedMixConfig={feedMixConfig}
                onFeedMixChange={handleFeedMixChange}
                onFeedMixReset={handleFeedMixReset}
                savedMixes={savedMixes}
                onSaveMix={handleSaveMix}
                onLoadMix={handleLoadMix}
                onDeleteMix={handleDeleteMix}
                algorithmTransparent={algorithmTransparent}
                onAlgorithmTransparencyChange={setAlgorithmTransparent}
                freshnessPreference={freshnessPreference}
                onFreshnessChange={setFreshnessPreference}
                creatorDiversity={creatorDiversity}
                onCreatorDiversityChange={setCreatorDiversity}
                exploreRatio={exploreRatio}
                onExploreRatioChange={setExploreRatio}
                activePreset={activePreset}
                onApplyPreset={applyFeedPreset}
                feedPresets={FEED_PRESETS}
              />
            </WidgetErrorBoundary>
          )}

          <ScrollToTop />
          <div
            ref={announcerRef as React.Ref<HTMLDivElement>}
            className="sr-only"
            role="status"
            aria-live="polite"
          />
        </div>
      </PullToRefresh>
    </ErrorBoundary>
  );
}
