'use client';

import { addBookmark, getFollows, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import {
  ErrorBoundary,
  NotificationBell,
  PostCard,
  ProtocolBadge,
  ScrollToTop,
} from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
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
import { FeedFilterBar, FeedTabBar } from '../../components/feed/FeedFilterBar';
import {
  FeedAuthGate,
  FeedEmptyState,
  FeedErrorState,
  FeedLoadingSkeleton,
  FeedNewPostsBanner,
  FeedProtocolSummary,
} from '../../components/feed/FeedStates';
import { FEED_PRESETS } from '../../components/feed/feedPresets';
import { getProtocolTabs, ProtocolFeedTabs } from '../../components/feed/ProtocolFeedTabs';
import { PullToRefresh } from '../../components/feed/PullToRefresh';
import { SortSelector } from '../../components/feed/SortSelector';
import { GettingStartedChecklist } from '../../components/GettingStartedChecklist';
import { GuidedTour } from '../../components/GuidedTour';
import { PostContextMenu, useContextMenu } from '../../components/PostContextMenu';
import { useAnnouncer } from '../../components/ScreenReaderAnnouncer';
import { useToast } from '../../components/Toast';
import { useEdgeSwipeBack } from '../../hooks/useEdgeSwipeBack';
import { useFeedLayout } from '../../hooks/useFeedLayout';
import { useFeedPosition } from '../../hooks/useFeedPosition';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeFeed } from '../../hooks/useRealtimeFeed';
import { useReturningUser } from '../../hooks/useReturningUser';
import { useScrollVelocity } from '../../hooks/useScrollVelocity';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { fetchWithSwr, getCached } from '../../lib/fetchWithCache';
import { ReadingProgressBar } from './components/ReadingProgressBar';
import { ShareSheet } from './components/ShareSheet';

const TipModal = dynamic(
  () => import('../../components/TipModal').then((m) => ({ default: m.TipModal })),
  { ssr: false, loading: () => null },
);

type Tab = 'for-you' | 'following' | 'trending' | 'news' | 'custom-mix';

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
  perProtocol?: Record<string, number>;
  errors?: string[];
  notices?: string[];
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
  const { signedInProtocols, engage, publish, ready, walletAddress } = useAuth();
  const { showToast } = useToast();
  const isAdmin = walletAddress ? ADMIN_WALLETS.has(walletAddress.toLowerCase()) : false;

  const [activeTab, setActiveTab] = useState<Tab>('for-you');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [hideLowQuality, setHideLowQuality] = useState(false);
  const [hideThreshold, _setHideThreshold] = useState(1.0);
  const [allowNonCrypto, setAllowNonCrypto] = useState(false);
  const [recencyWeight, setRecencyWeight] = useState(1.0);
  const [engagementWeight, setEngagementWeight] = useState(1.0);
  const [showOriginalContent, setShowOriginalContent] = useState(false);
  const [minEngagement, setMinEngagement] = useState(0);
  const [maxPerNiche, setMaxPerNiche] = useState(5);
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null);
  const [algorithmTransparent, setAlgorithmTransparent] = useState(false);
  const [freshnessPreference, setFreshnessPreference] = useState(50);
  const [creatorDiversity, setCreatorDiversity] = useState(5);
  const [exploreRatio, setExploreRatio] = useState(30);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const { unreadCount, markRead } = useNotifications(hasSignedIn);
  const { layout, setLayout, isCompact } = useFeedLayout();
  const feedContainerRef = useRef<HTMLDivElement>(null);
  useFeedPosition(feedContainerRef);
  const swipeHandlers = useSwipeTabs(
    () => setActiveTab('following'),
    () => setActiveTab('for-you'),
  );
  useEdgeSwipeBack(() => window.history.back());
  const haptic = useHapticFeedback();
  const _router = useRouter();
  const returnUser = useReturningUser();

  // ── Real-time feed updates via WebSocket ──
  const realtimeFeed = useRealtimeFeed(
    activeTab === 'trending' ? 'trending' : activeTab === 'following' ? 'home' : 'for-you',
    protocolFilter,
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
  }, [realtimeFeed.newPostCount, handleRealtimeInsert]);

  // Reset the insertion flag when posts change (e.g., tab switch)
  useEffect(() => {
    realtimeInsertedRef.current = false;
  }, [activeTab, protocolFilter]);

  const [topicWeights, setTopicWeights] = useState<Record<string, number>>({});
  const [_showFeedInfo, _setShowFeedInfo] = useState(false);
  const [showTuner, setShowTuner] = useState(false);
  const [newAvailable, setNewAvailable] = useState(false);
  const [loadedLimit, setLoadedLimit] = useState(25);
  const lastPostIdRef = useRef('');
  const [feedMixConfig, setFeedMixConfig] = useState<FeedMixConfig>(() => loadFeedMixConfig());
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(() => loadSavedMixes());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tuneTopicWeightsDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [showComposer, setShowComposer] = useState(false);
  const [_visiblePostIds, _setVisiblePostIds] = useState<Set<string>>(new Set());
  const [_jumpedToPostId, _setJumpedToPostId] = useState<string | null>(null);
  const [readingProgress, _setReadingProgress] = useState(0);
  const [popupPost, setPopupPost] = useState<UnifiedPost | null>(null);
  const [_showWhyCard, _setShowWhyCard] = useState(false);
  const [_feedHealthOpen, _setFeedHealthOpen] = useState(false);
  const [_isPublishing, _setIsPublishing] = useState(false);
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

  const _handleTopicToggle = useCallback(
    (topic: string) => {
      setTopicWeights((prev) => {
        const next = { ...prev, [topic]: (prev[topic] ?? 0) > 0 ? 0 : 1 };
        persistTopicWeights(next);
        return next;
      });
    },
    [persistTopicWeights],
  );
  const _handleTopicWeightChange = useCallback(
    (topic: string, weight: number) => {
      setTopicWeights((prev) => {
        const next = { ...prev, [topic]: weight };
        persistTopicWeights(next);
        return next;
      });
    },
    [persistTopicWeights],
  );

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
        if (data.protocolFilter) setProtocolFilter(data.protocolFilter);
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
  }, []);

  const [contextMenuPostId, setContextMenuPostId] = useState<string | null>(null);
  const [_contextMenuPos, _setContextMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const toggleHideLowQuality = useCallback(() => {
    setHideLowQuality((p) => {
      const next = !p;
      persistPrefs({ hideLowQuality: next });
      return next;
    });
  }, [persistPrefs]);

  // Memoized feed content to optimize re-renders
  const memoizedFeed = useMemo(() => posts, [posts]);

  const { handleContextMenu, closeContextMenu } = useContextMenu();
  const _contextMenuHandlers = { handleContextMenu, closeContextMenu };

  useEffect(() => {
    if (contextMenuPostId) {
      const handler = (e: MouseEvent) => {
        if (!(e.target as HTMLElement)?.closest('.context-menu')) setContextMenuPostId(null);
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [contextMenuPostId]);

  const loadMore = useCallback(() => {
    setLoadedLimit((p) => p + 25);
  }, []);

  // useViewportPrefetch(posts, (post) => post);
  // useHoverPrefetch(posts, (post) => post);
  const _scrollVelocity = useScrollVelocity();

  const announceFeed = useCallback((msg: string, priority?: 'polite' | 'assertive') => {
    announcerRef.current?.(msg, priority);
  }, []);

  const fetchFeed = useCallback(
    async (checkOnly = false) => {
      if (!checkOnly) setState('loading');
      try {
        const endpoint = activeTab === 'for-you' ? '/api/feed/for-you' : '/api/feed/home';
        const cacheKey = `feed_${activeTab}_${protocolFilter ?? 'all'}_${loadedLimit}_${hideLowQuality}_${allowNonCrypto}_${showOriginalContent}_${minEngagement}_${maxPerNiche}_${recencyWeight}_${engagementWeight}_${freshnessPreference}_${creatorDiversity}_${exploreRatio}_${algorithmTransparent}_${activePreset ?? 'none'}`;
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', String(loadedLimit));
        const protocolsToFetch = protocolFilter
          ? [protocolFilter]
          : ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit', 'rss'];
        url.searchParams.set('protocols', protocolsToFetch.join(','));
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

        const swrResult = await fetchWithSwr<{ data?: UnifiedPost[]; meta?: FeedMeta }>(
          url.toString(),
          cacheKey,
          { credentials: 'include' },
        );
        const data = swrResult.data;
        let feed = data.data ?? [];

        if (activeTab === 'following') {
          try {
            const follows = await getFollows('self');
            const ids = new Set(follows.map((f) => f.targetId));
            feed = feed.filter((p) => ids.has(p.author.id));
          } catch {
            /* ignore */
          }
        }

        if (checkOnly && feed.length > 0 && feed[0]?.id !== lastPostIdRef.current) {
          setNewAvailable(true);
          return;
        }
        if (feed.length > 0) {
          lastPostIdRef.current = (feed[0]?.id as string) ?? '';
        }
        setPosts(feed);
        setFeedMeta(data.meta || {});
        setState(feed.length ? 'loaded' : 'empty');
        if (swrResult.stale) setError('Showing cached results. Updating…');
        else setError(undefined);
        if (!checkOnly && feed.length > 0)
          announceFeed(
            `${feed.length} posts loaded${swrResult.fromCache ? ' (cached)' : ''}`,
            'polite',
          );
      } catch (err) {
        if (!checkOnly) {
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
      }
    },
    [
      activeTab,
      loadedLimit,
      hideLowQuality,
      hideThreshold,
      allowNonCrypto,
      showOriginalContent,
      minEngagement,
      maxPerNiche,
      recencyWeight,
      engagementWeight,
      protocolFilter,
      topicWeights,
      algorithmTransparent,
      freshnessPreference,
      creatorDiversity,
      exploreRatio,
      activePreset,
      announceFeed,
    ],
  );

  const refreshNow = useCallback(() => {
    setNewAvailable(false);
    fetchFeed(false);
  }, [fetchFeed]);

  const handleEngage = async (
    action: EngagementAction,
    postId: string,
    content?: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: 'Post not found' };
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
            post.text.slice(0, 60),
            post.author.displayName || '',
          );
        else await removeBookmark(postId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Bookmark failed' };
      }
    }
    return engage(action, postId, post.protocol, { content: content ?? '' });
  };

  const _handleShareToast = useCallback(
    (message: string) => {
      navigator.clipboard
        .writeText(message)
        .then(() => {
          showToast('success', 'Link copied!');
        })
        .catch(() => {
          showToast('error', 'Failed to copy');
        });
    },
    [showToast],
  );

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchFeed(true), 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFeed]);

  if (!ready)
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <FeedLoadingSkeleton />
      </div>
    );
  if (!hasSignedIn) return <FeedAuthGate />;

  return (
    <ErrorBoundary>
      <ReadingProgressBar progress={readingProgress} />
      <PullToRefresh onRefresh={refreshNow} disabled={state === 'loading'}>
        <div ref={feedContainerRef} className="mx-auto max-w-2xl px-4 py-6" {...swipeHandlers}>
          {isAdmin && (
            <div className="mb-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-[10px] text-amber-400">
              Admin mode
            </div>
          )}
          {!isCompact && <GettingStartedChecklist />}
          {returnUser && <GuidedTour />}

          {/* Protocol filter tabs */}
          <div className="mb-4">
            <ProtocolFeedTabs
              tabs={getProtocolTabs()}
              activeTab={protocolFilter}
              onTabChange={(id) => {
                setProtocolFilter(id);
                persistPrefs({ protocolFilter: id });
              }}
              showCounts
            />
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
              <SortSelector mode="latest" onChange={() => {}} />
              <NotificationBell
                notifications={[]}
                unreadCount={unreadCount}
                onFetch={() => {}}
                onMarkRead={() => {}}
              />
              <FeedLayoutSwitcher current={layout} onChange={setLayout} />
              <button
                type="button"
                onClick={() => setShowComposer(true)}
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
            protocolFilter={protocolFilter}
            onProtocolFilterChange={(v) => {
              setProtocolFilter(v);
              persistPrefs({ protocolFilter: v });
            }}
            onOpenTuner={() => setShowTuner(true)}
          />

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
          {newAvailable && realtimeFeed.newPostCount === 0 && (
            <div className="mb-4">
              <FeedNewPostsBanner count={posts.length} onRefresh={refreshNow} />
            </div>
          )}

          {state === 'loading' && <FeedLoadingSkeleton />}
          {state === 'empty' && <FeedEmptyState activeTab={activeTab} />}
          {state === 'error' && (
            <FeedErrorState error={error || 'Unknown error'} onRetry={() => fetchFeed(false)} />
          )}

          {state === 'loaded' && (
            <>
              <div className="space-y-4 stagger-enter">
                {memoizedFeed.map((post, i) => (
                  <div
                    key={post.id}
                    className="relative"
                    style={{ '--stagger-i': i } as React.CSSProperties}
                  >
                    {/* Protocol source indicator */}
                    {post.protocol && (
                      <div className="mb-1.5 flex items-center gap-2">
                        <ProtocolBadge protocol={post.protocol} size="sm" showLabel />
                      </div>
                    )}
                    <PostCard post={post} onEngage={handleEngage} />
                  </div>
                ))}
              </div>
              {posts.length >= loadedLimit && (
                <div className="mt-8 text-center">
                  <button type="button" onClick={loadMore} className="btn-secondary text-sm">
                    Load more
                  </button>
                </div>
              )}
              {/* Context menu */}
              {contextMenuPostId && (
                <PostContextMenu
                  postId={contextMenuPostId ?? ''}
                  onClose={() => setContextMenuPostId(null)}
                  open={!!contextMenuPostId}
                  position={{ x: 0, y: 0 }}
                />
              )}
            </>
          )}

          {/* Composer */}
          {showComposer && <FeedComposer signedInProtocols={{}} onPost={publish} />}

          {/* Tip modal */}
          {tipPost && (
            <TipModal
              open={true}
              onClose={() => setTipPost(null)}
              recipientProtocol={tipPost.protocol}
              recipientAuthorId={tipPost.author.id}
              recipientDisplayName={tipPost.author.displayName}
              publicationId={tipPost.id}
            />
          )}

          {/* Share sheet */}
          {popupPost && (
            <ShareSheet post={popupPost} open={!!popupPost} onClose={() => setPopupPost(null)} />
          )}

          {/* Feed tuner */}
          {showTuner && (
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
          )}

          <ScrollToTop />
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: screen-reader announcer */}
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
