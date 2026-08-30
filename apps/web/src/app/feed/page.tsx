'use client';

import { addBookmark, removeBookmark } from '@degenfeed/storage';
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { FeedComposer } from '../../components/FeedComposer';
import { FeedLayoutSwitcher } from '../../components/FeedLayoutSwitcher';
import type { FeedMixConfig, SavedMix } from '../../components/FeedTuner';
import {
  FeedTuner,
  getDefaultFeedMixConfig,
  getDefaultWeights,
  loadFeedMixConfig,
  loadSavedMixes,
  saveFeedMixConfig,
  saveSavedMixes,
} from '../../components/FeedTuner';
import { ConnectedNetworks } from '../../components/feed/ConnectedNetworks';
import { FeedControls } from '../../components/feed/FeedControls';
import { FeedFilterBar, FeedTabBar } from '../../components/feed/FeedFilterBar';
import {
  FeedAuthBanner,
  FeedNewPostsBanner,
  FeedProtocolSummary,
} from '../../components/feed/FeedStates';
import { FEED_PRESETS } from '../../components/feed/feedPresets';
import { PullToRefresh } from '../../components/feed/PullToRefresh';
import { GettingStartedChecklist } from '../../components/GettingStartedChecklist';
import { GuidedTour } from '../../components/GuidedTour';
import { PostContextMenu, useContextMenu } from '../../components/PostContextMenu';
import { useAnnouncer } from '../../components/ScreenReaderAnnouncer';
import { type FeedTab, useUnifiedFeed } from '../../hooks/feed/useUnifiedFeed';
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
import { FeedEmptyState } from './components/FeedEmptyState';
import { FeedErrorState } from './components/FeedErrorState';
import { FeedNotices } from './components/FeedNotices';
import { useInitialFeed } from './components/InitialFeedContext';
import { ReadingProgressBar } from './components/ReadingProgressBar';

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
  { id: 'for-you' as FeedTab, label: 'For You' },
  { id: 'following' as FeedTab, label: 'Following' },
  { id: 'trending' as FeedTab, label: 'Trending' },
  { id: 'news' as FeedTab, label: 'News' },
  { id: 'custom-mix' as FeedTab, label: 'Custom Mix' },
];

export default function FeedPage() {
  const { openSignIn, signedInProtocols, engage, publish, ready, walletAddress } = useAuth();
  const isAdmin = walletAddress ? ADMIN_WALLETS.has(walletAddress.toLowerCase()) : false;

  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  // Server-rendered initial posts arrive via InitialFeedProvider (feed/layout.tsx
  // fetches them with a bounded 1.6s budget). They seed the useUnifiedFeed
  // hook so the very first SSR + hydration render already shows content — no
  // skeleton flash, no post-hydration DOM swap.
  const initialPosts = useInitialFeed();

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

  const [topicWeights, setTopicWeights] = useState<Record<string, number>>({});
  const [showTuner, setShowTuner] = useState(false);
  const [feedMixConfig, setFeedMixConfig] = useState<FeedMixConfig>(() => loadFeedMixConfig());
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(() => loadSavedMixes());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tuneTopicWeightsDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showComposer, setShowComposer] = useState(false);
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

  // ── Unified feed data hook ──
  // All fetching, fallback, ranking, and pagination lives in useUnifiedFeed
  // (extracted from this component) so the page only renders. Re-fetches
  // automatically when the tab / controls / preferences change.
  const feedData = useUnifiedFeed({
    activeTab,
    hasSignedIn,
    controls,
    hideLowQuality,
    hideThreshold,
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
    feedMixConfig,
    algoProfile,
    initialPosts,
    announceFeed,
  });
  // useState-backed stable setter — safe to reference in callbacks without
  // re-creating them (and their effects) on every render.
  const feedSetPosts = feedData.setPosts;
  // When the user clicks the real-time banner, insert queued posts
  const handleRealtimeInsert = useCallback(() => {
    const queued = realtimeFeed.insertQueued();
    if (queued.length > 0) {
      realtimeInsertedRef.current = true;
      feedSetPosts((prev) => {
        const newPosts = queued.map((q) => q.post);
        const existingIds = new Set(prev.map((p) => p.id));
        const trulyNew = newPosts.filter((p) => !existingIds.has(p.id));
        if (trulyNew.length === 0) return prev;
        return [...trulyNew, ...prev];
      });
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [realtimeFeed, feedSetPosts]);

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

  // ── Background polling (useFeedPoller) ──
  // Replaces the old hand-rolled setInterval: polls page 1 of the same
  // effective feed, detects newly-arrived post ids, and pauses while the tab
  // is hidden (resumes with an immediate poll on return).
  const feedPoller = useFeedPoller(feedData.pollFeed, 60000);

  const refreshNow = useCallback(() => {
    feedPoller.refresh();
    void feedData.refresh();
  }, [feedPoller, feedData.refresh]);

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
    const post = feedData.posts.find((p) => p.id === postId);
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

  // No auth gate: the unified feed is public and renders for ALL users
  // (logged in or not). Auth is only required for posting/engaging, which is
  // handled by FeedAuthBanner (above), handleComposeClick, and handleEngage.
  return (
    <ErrorBoundary>
      <ReadingProgressBar progress={readingProgress} />
      <PullToRefresh onRefresh={refreshNow} disabled={feedData.state === 'loading'}>
        <div
          ref={feedContainerRef}
          id="feed-scroll-container"
          className="mx-auto max-w-2xl px-4 py-6"
          {...swipeHandlers}
        >
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
              resultCount={feedData.state === 'loaded' ? feedData.posts.length : undefined}
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

          {/* Network ownership — the user's linked federated/social identities */}
          <ConnectedNetworks />

          <div className="mb-4 flex items-center justify-between">
            <FeedTabBar
              tabs={FEED_TABS}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as FeedTab)}
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

          <FeedProtocolSummary meta={feedData.feedMeta} />
          <FeedNotices meta={feedData.feedMeta} />
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
          {feedData.refreshing && feedData.state === 'loaded' && feedData.posts.length > 0 && (
            <div
              className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-degen-500/20 bg-degen-500/5 px-3 py-1.5"
              role="status"
              aria-live="polite"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-degen-400" />
              <span className="text-[10px] font-medium text-degen-400">Loading fresh content…</span>
            </div>
          )}

          {feedData.state === 'loading' && (
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
          {feedData.state === 'empty' && (
            <FeedEmptyState activeTab={activeTab} onRefresh={() => feedData.fetchFeed()} />
          )}
          {feedData.state === 'error' && (
            <FeedErrorState
              error={feedData.error || 'Unknown error'}
              onRetry={() => feedData.fetchFeed()}
            />
          )}

          {feedData.state === 'loaded' && (
            <>
              <div className="stagger-enter">
                {feedData.posts.map((post, i) => (
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
              {feedData.hasMore && feedData.posts.length > 0 && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={feedData.loadMore}
                    className="btn-secondary text-sm"
                  >
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
