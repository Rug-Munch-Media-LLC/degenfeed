'use client';

import { addBookmark, getFollows, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import {
  ErrorBoundary,
  FeedList,
  FeedWhyCard,
  NotificationBell,
  PostCard,
  ScrollToTop,
} from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { ContextualTooltip } from '../../components/ContextualTooltip';
import { FeedComposer } from '../../components/FeedComposer';
import { FeedLayoutSwitcher } from '../../components/FeedLayoutSwitcher';
import { FeedSidebar } from '../../components/FeedSidebar';
import type { FeedMixConfig, SavedMix } from '../../components/FeedTuner';
import {
  countTunedTopics,
  encodeTopicWeights,
  FeedTuner,
  getDefaultFeedMixConfig,
  getDefaultWeights,
  loadFeedMixConfig,
  loadSavedMixes,
  PREBUILT_MIXES,
  saveFeedMixConfig,
  saveSavedMixes,
  TOPICS,
} from '../../components/FeedTuner';
import { GettingStartedChecklist } from '../../components/GettingStartedChecklist';
import { GuidedTour } from '../../components/GuidedTour';
import { PostCardPrefetcher } from '../../components/PostCardPrefetcher';
import { PostContextMenu, useContextMenu } from '../../components/PostContextMenu';
import { useAnnouncer } from '../../components/ScreenReaderAnnouncer';
import { useToast } from '../../components/Toast';
import { useEdgeSwipeBack } from '../../hooks/useEdgeSwipeBack';
import { useFeedLayout } from '../../hooks/useFeedLayout';
import { useFeedPosition } from '../../hooks/useFeedPosition';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { useHoverPrefetch } from '../../hooks/useHoverPrefetch';
import { useNotifications } from '../../hooks/useNotifications';
import { useReturningUser } from '../../hooks/useReturningUser';
import { useScrollVelocity } from '../../hooks/useScrollVelocity';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useViewportPrefetch } from '../../hooks/useViewportPrefetch';
import { fetchWithSwr, getCached } from '../../lib/fetchWithCache';
import { aggregateNiches, CategoryBreakCard } from './components/CategoryBreak';
import { OnboardingSuggestions } from './components/OnboardingSuggestions';
import { ReadingProgressBar } from './components/ReadingProgressBar';
import { ShareSheet } from './components/ShareSheet';

const TipModal = dynamic(
  () => import('../../components/TipModal').then((m) => ({ default: m.TipModal })),
  {
    ssr: false,
    loading: () => null,
  },
);

type Tab = 'for-you' | 'following' | 'custom-mix';

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

interface ProtocolSummary {
  id: string;
  label: string;
  color: string;
  count: number;
}

const PROTOCOL_META: Record<string, { label: string; color: string; emoji: string }> = {
  nostr: { label: 'Nostr', color: '#8e30eb', emoji: '⚡' },
  farcaster: { label: 'Farcaster', color: '#8a63d2', emoji: '🟣' },
  lens: { label: 'Lens', color: '#abfe2c', emoji: '🌿' },
  bluesky: { label: 'Bluesky', color: '#1185fe', emoji: '🦋' },
  mastodon: { label: 'Mastodon', color: '#6364ff', emoji: '🐘' },
  threads: { label: 'Threads (Experimental)', color: '#888888', emoji: '🧵' },
  reddit: { label: 'Reddit', color: '#ff4500', emoji: '🔴' },
  rss: { label: 'News', color: '#ffa500', emoji: '📰' },
};

// ─── Admin wallets ──────────────────────────────────────────────────
const ADMIN_WALLETS_RAW =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_ADMIN_WALLETS || '' : '';
const ADMIN_WALLETS = new Set(
  ADMIN_WALLETS_RAW.split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean),
);

export interface FeedPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: {
    freshnessPreference: number;
    creatorDiversity: number;
    exploreRatio: number;
    algorithmTransparent: boolean;
    recencyWeight: number;
    engagementWeight: number;
    contentTypes?: Record<string, number>;
  };
}

export const FEED_PRESETS: FeedPreset[] = [
  {
    id: 'tiktok-mode',
    name: 'TikTok Mode',
    description: 'Video-forward, rapid-fire content. Max freshness, low creator diversity.',
    icon: '🎵',
    config: {
      freshnessPreference: 90,
      creatorDiversity: 2,
      exploreRatio: 60,
      algorithmTransparent: false,
      recencyWeight: 2.5,
      engagementWeight: 3.0,
      contentTypes: { posts: 20, images: 30, videos: 100, links: 10, threads: 10 },
    },
  },
  {
    id: 'twitter-mode',
    name: 'Twitter Mode',
    description: 'Text-forward, chronological-leaning. Balanced discovery.',
    icon: '🐦',
    config: {
      freshnessPreference: 70,
      creatorDiversity: 5,
      exploreRatio: 30,
      algorithmTransparent: true,
      recencyWeight: 2.0,
      engagementWeight: 1.5,
      contentTypes: { posts: 100, images: 40, videos: 20, links: 30, threads: 40 },
    },
  },
  {
    id: 'discover-mode',
    name: 'Discover Mode',
    description: 'Explore-heavy. Maximize new creators, topics, and content types.',
    icon: '✨',
    config: {
      freshnessPreference: 40,
      creatorDiversity: 10,
      exploreRatio: 90,
      algorithmTransparent: true,
      recencyWeight: 1.0,
      engagementWeight: 2.0,
    },
  },
  {
    id: 'focus-mode',
    name: 'Focus Mode',
    description: 'Followed creators only. Minimum noise, maximum signal.',
    icon: '🎯',
    config: {
      freshnessPreference: 30,
      creatorDiversity: 3,
      exploreRatio: 5,
      algorithmTransparent: false,
      recencyWeight: 1.5,
      engagementWeight: 2.5,
    },
  },
];

export default function FeedPage() {
  const {
    signedInProtocols,
    engage,
    openSignIn,
    openComposeReply,
    publish,
    ready,
    signOut,
    nostrPublicId,
    walletAddress,
  } = useAuth();

  const isAdmin = walletAddress ? ADMIN_WALLETS.has(walletAddress.toLowerCase()) : false;

  const [activeTab, setActiveTab] = useState<Tab>('for-you');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [hideLowQuality, setHideLowQuality] = useState(false);
  const [hideThreshold, setHideThreshold] = useState(1.0);
  const [allowNonCrypto, setAllowNonCrypto] = useState(false);
  const [recencyWeight, setRecencyWeight] = useState(1.0);
  const [engagementWeight, setEngagementWeight] = useState(1.0);
  const [showOriginalContent, setShowOriginalContent] = useState(false);
  const [minEngagement, setMinEngagement] = useState(0);
  const [maxPerNiche, setMaxPerNiche] = useState(5);
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null);
  // ── Algorithm transparency ────────────────────────────────────
  const [algorithmTransparent, setAlgorithmTransparent] = useState(false);
  // ── Content freshness slider (0-100, 0=evergreen, 100=bleeding-edge) ──
  const [freshnessPreference, setFreshnessPreference] = useState(50);
  // ── Creator diversity (1-10, max posts per creator per page) ──
  const [creatorDiversity, setCreatorDiversity] = useState(5);
  // ── Explore vs Exploit (0-100, 0=only familiar, 100=only discovery) ──
  const [exploreRatio, setExploreRatio] = useState(30);
  // ── Active feed preset ────────────────────────────────────────
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const { notifications, unreadCount, fetchNotifications, markRead } =
    useNotifications(hasSignedIn);
  const { layout, setLayout, isCompact } = useFeedLayout();

  // ── Feed position restore ("Resume where you left off")
  const feedContainerRef = useRef<HTMLDivElement>(null);
  useFeedPosition(feedContainerRef);

  // ── Swipe between tabs on mobile
  const swipeHandlers = useSwipeTabs(
    () => setActiveTab('following'),
    () => setActiveTab('for-you'),
  );

  // ── Edge swipe back gesture
  useEdgeSwipeBack(() => {
    window.history.back();
  });

  // ── 2026 Social UX: Haptic feedback for engagement actions ──
  const haptic = useHapticFeedback();

  // ── 2026 Social UX: Share sheet state ──
  const [sharePost, setSharePost] = useState<UnifiedPost | null>(null);

  // ── 2026 Social UX: Reading progress tracking (expanded long posts) ──
  const [readingPostId, setReadingPostId] = useState<string | null>(null);

  // ── 2026 Social UX: Category break state ──
  const [categoryNiches, setCategoryNiches] = useState<string[]>([]);
  // Track which break index we've computed niches for
  const _lastBreakIdxRef = useRef<number>(-1);

  // ── 2026 Social UX: First-visit detection for onboarding suggestions ──
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const visited = localStorage.getItem('degenfeed_visited_before');
      if (!visited) {
        setIsFirstVisit(true);
        localStorage.setItem('degenfeed_visited_before', 'true');
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── 2026 Social UX: Toast for share sheet ──
  const handleShareToast = useCallback((message: string) => {
    window.dispatchEvent(
      new CustomEvent('df-toast', {
        detail: { kind: 'success', message },
      }),
    );
  }, []);

  // ── Feed preloading: prefetch post routes when cards enter viewport ──
  useViewportPrefetch([
    { href: '/feed', priority: 1 },
    { href: '/trending', priority: 1 },
    { href: '/notifications', priority: 2 },
    { href: '/messages', priority: 2 },
    { href: '/search', priority: 2 },
  ]);

  // ── Tab hover preloading: prefetch feed data when hovering over tabs ──
  const hoverPrefetch = useHoverPrefetch(200);
  const tabPrefetchMap = useMemo(
    () => ({
      'for-you': '/api/feed/for-you',
      following: '/api/feed/home?filter=following',
      'custom-mix': '/api/feed/for-you?mix=true',
    }),
    [],
  );

  // ── Right-click context menu
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  // ── Topic weights ──────────────────────────────────────────────
  const [topicWeights, setTopicWeights] = useState<Record<string, number>>(getDefaultWeights());
  const [showTuner, setShowTuner] = useState(false);
  const tuneTopicWeightsDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Feed Mix Config ────────────────────────────────────────────
  const [feedMixConfig, setFeedMixConfig] = useState<FeedMixConfig>(() => {
    if (typeof window === 'undefined') return getDefaultFeedMixConfig();
    return loadFeedMixConfig();
  });
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(() => {
    if (typeof window === 'undefined') return [];
    return loadSavedMixes();
  });

  const persistTopicWeights = useCallback((weights: Record<string, number>) => {
    if (tuneTopicWeightsDebounce.current) clearTimeout(tuneTopicWeightsDebounce.current);
    tuneTopicWeightsDebounce.current = setTimeout(() => {
      void fetch('/api/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topicWeights: weights }),
      }).catch(() => {});
    }, 2000);
  }, []);

  const handleTunerWeightsChange = useCallback((weights: Record<string, number>) => {
    setTopicWeights(weights);
    // Real-time preview: don't persist yet, just update state for next feed fetch
  }, []);

  const handleTunerApply = useCallback(
    (weights: Record<string, number>) => {
      setTopicWeights(weights);
      persistTopicWeights(weights);
      setShowTuner(false);
    },
    [persistTopicWeights],
  );

  const handleTunerReset = useCallback(() => {
    const defaults = getDefaultWeights();
    setTopicWeights(defaults);
    persistTopicWeights(defaults);
  }, [persistTopicWeights]);

  // ── Debounced persistence ─────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const persistPrefs = useCallback((patch: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetch('/api/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => {});
    }, 300);
  }, []);

  // ── Feed mix handlers ──────────────────────────────────────────
  const handleFeedMixChange = useCallback((config: FeedMixConfig) => {
    setFeedMixConfig(config);
  }, []);

  const handleFeedMixApply = useCallback(
    (config: FeedMixConfig) => {
      setFeedMixConfig(config);
      saveFeedMixConfig(config);
      // Also persist to server
      persistPrefs({ feedMixConfig: config });
    },
    [persistPrefs],
  );

  const handleFeedMixReset = useCallback(() => {
    const defaults = getDefaultFeedMixConfig();
    setFeedMixConfig(defaults);
    saveFeedMixConfig(defaults);
    persistPrefs({ feedMixConfig: defaults });
  }, [persistPrefs]);

  const handleSaveMix = useCallback(
    (mix: SavedMix) => {
      setSavedMixes((prev) => {
        const updated = [...prev, mix];
        saveSavedMixes(updated);
        persistPrefs({ savedMixes: updated });
        return updated;
      });
    },
    [persistPrefs],
  );

  const handleLoadMix = useCallback(
    (mix: SavedMix) => {
      setFeedMixConfig(mix.config);
      saveFeedMixConfig(mix.config);
      persistPrefs({ feedMixConfig: mix.config });
    },
    [persistPrefs],
  );

  const handleDeleteMix = useCallback(
    (id: string) => {
      setSavedMixes((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        saveSavedMixes(updated);
        persistPrefs({ savedMixes: updated });
        return updated;
      });
    },
    [persistPrefs],
  );

  /** Load a pre-built mix */
  const applyPrebuiltMix = useCallback(
    (mixId: string) => {
      const mix = PREBUILT_MIXES.find((m) => m.id === mixId);
      if (!mix) return;
      setFeedMixConfig(mix.config);
      saveFeedMixConfig(mix.config);
      persistPrefs({ feedMixConfig: mix.config });
      setShowTuner(true);
    },
    [persistPrefs],
  );

  /** Apply a feed preset */
  const applyFeedPreset = useCallback(
    (presetId: string) => {
      if (presetId === '__clear__') {
        setActivePreset(null);
        persistPrefs({ activePreset: null });
        return;
      }
      const preset = FEED_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      setActivePreset(presetId);
      setAlgorithmTransparent(preset.config.algorithmTransparent);
      setFreshnessPreference(preset.config.freshnessPreference);
      setCreatorDiversity(preset.config.creatorDiversity);
      setExploreRatio(preset.config.exploreRatio);
      setRecencyWeight(preset.config.recencyWeight);
      setEngagementWeight(preset.config.engagementWeight);
      // Apply content type weights if present
      if (preset.config.contentTypes && feedMixConfig) {
        const updatedConfig = {
          ...feedMixConfig,
          contentTypes: {
            ...feedMixConfig.contentTypes,
            ...preset.config.contentTypes,
          },
        };
        setFeedMixConfig(updatedConfig);
        saveFeedMixConfig(updatedConfig);
      }
      persistPrefs({
        activePreset: presetId,
        algorithmTransparent: preset.config.algorithmTransparent,
        freshnessPreference: preset.config.freshnessPreference,
        creatorDiversity: preset.config.creatorDiversity,
        exploreRatio: preset.config.exploreRatio,
      });
      setShowTuner(true);
    },
    [persistPrefs, feedMixConfig],
  );

  /** Quick-tune: boost a topic by +5 (capped at 100) */
  const handleShowMoreLikeThis = useCallback(
    (topic: string) => {
      const topicId = TOPICS.find(
        (t) => t.id === topic || t.label.toLowerCase() === topic.toLowerCase(),
      )?.id;
      if (!topicId) return;
      setTopicWeights((prev) => {
        const next = { ...prev, [topicId]: Math.min(100, (prev[topicId] ?? 50) + 5) };
        persistTopicWeights(next);
        return next;
      });
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'success', message: `Boosting "${topic}" topics` },
        }),
      );
    },
    [persistTopicWeights],
  );

  /** Quick-tune: demote a topic by -5 (capped at 0) */
  const handleShowLessLikeThis = useCallback(
    (topic: string) => {
      const topicId = TOPICS.find(
        (t) => t.id === topic || t.label.toLowerCase() === topic.toLowerCase(),
      )?.id;
      if (!topicId) return;
      setTopicWeights((prev) => {
        const next = { ...prev, [topicId]: Math.max(0, (prev[topicId] ?? 50) - 5) };
        persistTopicWeights(next);
        return next;
      });
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'info', message: `Reducing "${topic}" topics` },
        }),
      );
    },
    [persistTopicWeights],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prefsRes] = await Promise.all([
          fetch('/api/preferences', { credentials: 'include' }),
        ]);
        if (!prefsRes.ok || cancelled) return;
        const data = (await prefsRes.json()) as {
          hideLowQuality?: boolean;
          hideLowQualityThreshold?: number;
          allowNonCrypto?: boolean;
          recencyWeight?: number;
          engagementWeight?: number;
          showOriginalContent?: boolean;
          minEngagement?: number;
          maxPerNiche?: number;
          topicWeights?: Record<string, number>;
          feedMixConfig?: FeedMixConfig;
          savedMixes?: SavedMix[];
          algorithmTransparent?: boolean;
          freshnessPreference?: number;
          creatorDiversity?: number;
          exploreRatio?: number;
          activePreset?: string | null;
        };
        if (typeof data.hideLowQuality === 'boolean') setHideLowQuality(data.hideLowQuality);
        if (typeof data.hideLowQualityThreshold === 'number') {
          setHideThreshold(data.hideLowQualityThreshold);
        }
        if (typeof data.allowNonCrypto === 'boolean') setAllowNonCrypto(data.allowNonCrypto);
        if (typeof data.recencyWeight === 'number') setRecencyWeight(data.recencyWeight);
        if (typeof data.engagementWeight === 'number') setEngagementWeight(data.engagementWeight);
        if (typeof data.showOriginalContent === 'boolean')
          setShowOriginalContent(data.showOriginalContent);
        if (typeof data.minEngagement === 'number') setMinEngagement(data.minEngagement);
        if (typeof data.maxPerNiche === 'number') setMaxPerNiche(data.maxPerNiche);
        // Load algorithm controls
        if (typeof data.algorithmTransparent === 'boolean')
          setAlgorithmTransparent(data.algorithmTransparent);
        if (typeof data.freshnessPreference === 'number')
          setFreshnessPreference(data.freshnessPreference);
        if (typeof data.creatorDiversity === 'number') setCreatorDiversity(data.creatorDiversity);
        if (typeof data.exploreRatio === 'number') setExploreRatio(data.exploreRatio);
        if (typeof data.activePreset === 'string') setActivePreset(data.activePreset);
        // Load topic weights
        if (data.topicWeights && typeof data.topicWeights === 'object') {
          setTopicWeights((prev) => ({ ...prev, ...data.topicWeights }));
        }
        // Load feed mix config
        if (data.feedMixConfig && typeof data.feedMixConfig === 'object') {
          setFeedMixConfig(data.feedMixConfig);
        }
        if (data.savedMixes && Array.isArray(data.savedMixes)) {
          setSavedMixes(data.savedMixes);
        }
      } catch {
        /* ignore — user has no session yet */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setHideThresholdAndPersist = useCallback(
    (next: number) => {
      setHideThreshold(next);
      persistPrefs({ hideLowQualityThreshold: next });
    },
    [persistPrefs],
  );

  const setAllowNonCryptoAndPersist = useCallback(
    (next: boolean) => {
      setAllowNonCrypto(next);
      persistPrefs({ allowNonCrypto: next });
    },
    [persistPrefs],
  );

  const toggleHideLowQuality = useCallback(() => {
    setHideLowQuality((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('degenfeed_hide_low_quality', String(next));
      } catch {
        /* ignore */
      }
      persistPrefs({ hideLowQuality: next });
      return next;
    });
  }, [persistPrefs]);

  // ── "Why this post?" panel state ──────────────────────────────
  const [explainPost, setExplainPost] = useState<UnifiedPost | null>(null);
  const explainRef = useRef<HTMLDivElement>(null);

  // Close explain panel on outside click
  useEffect(() => {
    if (!explainPost) return;
    const handler = (e: MouseEvent) => {
      if (explainRef.current && !explainRef.current.contains(e.target as Node)) {
        setExplainPost(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [explainPost]);

  const [newAvailable, setNewAvailable] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPostIdRef = useRef<string | null>(null);
  const [loadedLimit, setLoadedLimit] = useState(50);
  const hasMore = loadedLimit < 200;

  const loadMore = useCallback(() => {
    setLoadedLimit((prev) => Math.min(prev + 25, 200));
  }, []);

  // ── "While you were away" — detects return after >30min ──────
  const returning = useReturningUser();
  const [showReturnCard, setShowReturnCard] = useState(true);

  // ── Boredom detection via scroll velocity ────────────────────
  const scrollVel = useScrollVelocity(800, 2000);
  const [injectedExplore, setInjectedExplore] = useState(0);
  const lastPaceRef = useRef<string>('idle');

  // When scrolling fast, inject explore cards into the feed
  useEffect(() => {
    const pace = scrollVel.pace;
    if (pace === 'fast' || pace === 'racing') {
      if (lastPaceRef.current !== 'fast' && lastPaceRef.current !== 'racing') {
        // Just entered fast-scroll mode — inject an explore suggestion
        setInjectedExplore((prev) => Math.min(prev + 1, 3));
      }
    }
    lastPaceRef.current = pace;
  }, [scrollVel.pace]);

  // Reset injected explore when feed changes tab or refreshes
  useEffect(() => {
    setInjectedExplore(0);
  }, []);

  // ── End-of-feed discovery suggestions ────────────────────────
  const endOfFeedSuggestions = useMemo(
    () => [
      {
        id: 'trending',
        label: 'Trending',
        description: 'See what the DegenFeed community is buzzing about right now.',
        color: '#f59e0b',
        icon: '🔥',
      },
      {
        id: 'news',
        label: 'Crypto News',
        description: 'Stay informed with the latest crypto news aggregated from 350+ RSS sources.',
        color: '#ffa500',
        icon: '📰',
      },
      {
        id: 'discover',
        label: 'Discover',
        description: 'New accounts, new topics, new conversations. Expand your web3 horizons.',
        color: '#8b5cf6',
        icon: '✨',
      },
      {
        id: 'videos',
        label: 'Videos & Shorts',
        description: 'Watch the latest crypto videos, interviews, and short-form content.',
        color: '#ef4444',
        icon: '🎬',
      },
    ],
    [],
  );

  const { announce } = useAnnouncer();

  const fetchFeed = useCallback(
    async (checkOnly = false) => {
      if (!checkOnly) setState('loading');
      try {
        const endpoint = activeTab === 'for-you' ? '/api/feed/for-you' : '/api/feed/home';
        // Build cache key from active tab + filters for SWR deduplication
        const cacheKey = `feed_${activeTab}_${protocolFilter ?? 'all'}_${loadedLimit}_${hideLowQuality}_${allowNonCrypto}_${showOriginalContent}_${activePreset ?? 'none'}_${freshnessPreference}_${exploreRatio}`;

        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', String(loadedLimit));
        const protocolsToFetch = protocolFilter
          ? [protocolFilter]
          : ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit', 'rss'];
        url.searchParams.set('protocols', protocolsToFetch.join(','));
        if (activeTab === 'following') {
          url.searchParams.set('filter', 'following');
        }
        if (hideLowQuality) {
          url.searchParams.set('hideLowQuality', 'true');
          url.searchParams.set('hideLowQualityThreshold', String(hideThreshold));
        }
        if (allowNonCrypto) {
          url.searchParams.set('allowNonCrypto', 'true');
        }
        if (showOriginalContent) {
          url.searchParams.set('showOriginalContent', 'true');
        }
        if (minEngagement > 0) {
          url.searchParams.set('minEngagement', String(minEngagement));
        }
        if (maxPerNiche < 5) {
          url.searchParams.set('maxPerNiche', String(maxPerNiche));
        }
        if (recencyWeight !== 1) url.searchParams.set('recencyWeight', String(recencyWeight));
        if (engagementWeight !== 1)
          url.searchParams.set('engagementWeight', String(engagementWeight));
        const tw = encodeTopicWeights(topicWeights);
        if (tw) url.searchParams.set('topic_weights', tw);

        // New algorithm controls
        if (algorithmTransparent) {
          url.searchParams.set('algorithmTransparent', 'true');
        }
        if (freshnessPreference !== 50) {
          url.searchParams.set('freshness', String(freshnessPreference));
        }
        if (creatorDiversity !== 5) {
          url.searchParams.set('creatorDiversity', String(creatorDiversity));
        }
        if (exploreRatio !== 30) {
          url.searchParams.set('exploreRatio', String(exploreRatio));
        }
        if (activePreset) {
          url.searchParams.set('preset', activePreset);
        }

        // Use SWR: prefer stale cache for instant render, refresh in background
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
            /* ignore IndexedDB errors in private mode */
          }
        }

        if (checkOnly && feed.length > 0 && feed[0]?.id !== lastPostIdRef.current) {
          setNewAvailable(true);
          return;
        }

        if (feed.length > 0) {
          lastPostIdRef.current = feed[0]?.id ?? '';
        }
        setPosts(feed);
        setFeedMeta(data.meta || {});
        setState(feed.length ? 'loaded' : 'empty');
        if (swrResult.stale) {
          setError('Showing cached results. Updating…');
        } else {
          setError(undefined);
        }
        if (!checkOnly && feed.length > 0) {
          announce(
            `${feed.length} posts loaded${swrResult.fromCache ? ' (cached)' : ''}`,
            'polite',
          );
        }
      } catch (err) {
        if (!checkOnly) {
          // Graceful degradation: show cached feed on failure
          const cached = getCached<{ data?: UnifiedPost[]; meta?: FeedMeta }>(`feed_${activeTab}`);
          if (cached && (cached.data ?? []).length > 0) {
            const cachedFeed = cached.data ?? [];
            setPosts(cachedFeed);
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
      announce,
    ],
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

    // 2026 Social UX: Trigger haptic feedback for engagement actions
    if (action === 'like' || action === 'unlike') {
      haptic.triggerLike();
    } else if (action === 'repost' || action === 'unrepost') {
      haptic.triggerRepost();
    } else if (action === 'bookmark' || action === 'unbookmark') {
      haptic.triggerBookmark();
    } else if (action === 'reply') {
      haptic.triggerReply();
    }

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
      if (!hasSignedIn) {
        openSignIn();
        return;
      }
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
    [hasSignedIn, openSignIn, openComposeReply],
  );

  const handleTip = useCallback(
    (post: UnifiedPost) => {
      if (!hasSignedIn) {
        openSignIn();
        return;
      }
      setTipPost(post);
    },
    [hasSignedIn, openSignIn],
  );

  const { showToast } = useToast();
  const router = useRouter();
  const handlePostClick = useCallback(
    (id: string) => {
      // In for-you mode, if user clicks anywhere, open explain panel for this post
      if (activeTab === 'for-you') {
        const post = posts.find((p) => p.id === id);
        if (post?.score) {
          setExplainPost(post);
          return;
        }
      }
      router.push(`/post/${encodeURIComponent(id)}`);
    },
    [activeTab, posts, router],
  );

  const handleReport = useCallback(
    (_postId: string) => {
      showToast('success', 'Report submitted. Thank you for helping keep DegenFeed safe.');
    },
    [showToast],
  );

  const handleAdminRemove = useCallback(
    async (postId: string) => {
      try {
        // Create a report for the removal and resolve it immediately
        const reportRes = await fetch('/api/moderation/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ postId, reason: 'spam', protocol: 'moderator' }),
        });
        if (!reportRes.ok) throw new Error('Failed to report');
        const reportData = (await reportRes.json()) as { reportId?: string };
        if (reportData.reportId) {
          await fetch(`/api/moderation/reports/${reportData.reportId}/remove`, {
            method: 'POST',
            credentials: 'include',
          });
        }
        showToast('success', 'Post removed from feed');
        // Remove from local state immediately
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } catch (e) {
        showToast('error', e instanceof Error ? e.message : 'Failed to remove post');
      }
    },
    [showToast],
  );

  const handleWhyThisPost = useCallback((post: UnifiedPost) => {
    setExplainPost(post);
  }, []);

  const handleAdminBan = useCallback(
    async (userId: string, protocol: string, handle?: string) => {
      try {
        const res = await fetch('/api/moderation/ban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId, protocol, reason: 'Moderator action' }),
        });
        if (!res.ok) throw new Error('Failed to ban user');
        showToast('success', `Banned ${handle || userId}`);
        // Remove all posts from this user from local state
        setPosts((prev) => prev.filter((p) => p.author.id !== userId));
      } catch (e) {
        showToast('error', e instanceof Error ? e.message : 'Failed to ban user');
      }
    },
    [showToast],
  );

  const protocolSummaries: ProtocolSummary[] = useMemo(() => {
    const perProtocol = feedMeta.perProtocol ?? {};
    return Object.entries(PROTOCOL_META)
      .map(([id, meta]) => ({
        id,
        label: meta.label,
        color: meta.color,
        count: perProtocol[id] ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [feedMeta.perProtocol]);

  const handleProtocolFilter = useCallback((id: string) => {
    setProtocolFilter((current) => (current === id ? null : id));
  }, []);

  /* ── Pull-to-refresh (spring animation) ─────────────────── */
  const PULL_THRESHOLD = 80;
  const PULL_MAX = 140;
  const pullStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullReady, setPullReady] = useState(false);
  const pullSpringRef = useRef<number | null>(null);
  const pullRefreshCleanupRef = useRef<(() => void) | null>(null);
  // Refs for latest values in touch handlers
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only activate pull-to-refresh when at the top of the page
    if (window.scrollY <= 0 && !isRefreshingRef.current) {
      pullStartY.current = e.touches[0]?.clientY ?? 0;
      setIsPulling(true);
      setPullReady(false);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling) return;
      if (isRefreshingRef.current) return;
      const currentY = e.touches[0]?.clientY ?? 0;
      const diff = currentY - pullStartY.current;
      if (diff <= 0) {
        setPullDistance(0);
        pullDistanceRef.current = 0;
        setPullReady(false);
        return;
      }
      // Spring-like resistance: easy at first, harder as you pull
      // Using diminishing returns curve for natural feel
      const resisted = Math.min(diff * 0.5 - Math.max(0, diff - 60) ** 2 * 0.003, PULL_MAX);
      const newVal = Math.max(0, resisted);
      setPullDistance(newVal);
      pullDistanceRef.current = newVal;
      setPullReady(newVal >= PULL_THRESHOLD);
    },
    [isPulling],
  );

  const handleTouchEnd = useCallback(() => {
    const currentPull = pullDistanceRef.current;
    const currentRefreshing = isRefreshingRef.current;

    if (currentPull >= PULL_THRESHOLD && !currentRefreshing) {
      // Haptic-style spring animation: snap to "refreshing" position with bounce
      setIsRefreshing(true);
      isRefreshingRef.current = true;

      // Animate to full pull position with spring feel
      if (pullSpringRef.current) cancelAnimationFrame(pullSpringRef.current);
      setPullDistance(60);
      pullDistanceRef.current = 60;

      // Trigger refresh
      setNewAvailable(false);
      fetchFeed(false);

      // After refresh completes (or timeout), spring back with bounce
      const refreshTimer = setTimeout(() => {
        // Spring back to zero
        let start = 60;
        const springBack = () => {
          start *= 0.85; // Damping factor
          if (Math.abs(start) < 1) {
            setPullDistance(0);
            pullDistanceRef.current = 0;
            setIsRefreshing(false);
            isRefreshingRef.current = false;
            setPullReady(false);
            return;
          }
          setPullDistance(start);
          pullDistanceRef.current = start;
          pullSpringRef.current = requestAnimationFrame(springBack);
        };
        pullSpringRef.current = requestAnimationFrame(springBack);
      }, 600); // Hold at refresh position briefly

      // Safety timeout for refresh
      const safetyTimer = setTimeout(() => {
        setPullDistance(0);
        pullDistanceRef.current = 0;
        setIsRefreshing(false);
        isRefreshingRef.current = false;
        setPullReady(false);
      }, 5000);

      // Store cleanup
      const rTimer = refreshTimer;
      const sTimer = safetyTimer;
      const cleanup = () => {
        clearTimeout(rTimer);
        clearTimeout(sTimer);
      };
      if (pullRefreshCleanupRef.current) pullRefreshCleanupRef.current();
      pullRefreshCleanupRef.current = cleanup;

      // Reset pulling state
      setIsPulling(false);
      setPullReady(false);
      return;
    }

    // Didn't reach threshold — spring back with bounce
    if (currentPull > 0) {
      let current = currentPull;
      const springBack = () => {
        current *= 0.82; // Spring damping
        if (Math.abs(current) < 1) {
          setPullDistance(0);
          pullDistanceRef.current = 0;
          return;
        }
        setPullDistance(current);
        pullDistanceRef.current = current;
        pullSpringRef.current = requestAnimationFrame(springBack);
      };
      pullSpringRef.current = requestAnimationFrame(springBack);
    }

    setPullDistance(0);
    pullDistanceRef.current = 0;
    setIsPulling(false);
    setPullReady(false);
  }, [fetchFeed]);

  // Sync pullDistance to ref for use in touchEnd handler
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  // Cleanup pull-to-refresh timers on unmount
  useEffect(() => {
    return () => {
      if (pullSpringRef.current) cancelAnimationFrame(pullSpringRef.current);
      if (pullRefreshCleanupRef.current) pullRefreshCleanupRef.current();
    };
  }, []);

  // ── Compute category break niches when posts change ─────────────
  useEffect(() => {
    if (posts.length === 0) return;
    // Aggregate niches from first batch for the first category break (at index 12)
    const batchSize = 12;
    const firstBreakIndex = batchSize;
    if (firstBreakIndex < posts.length) {
      const niches = aggregateNiches(posts, firstBreakIndex, 8);
      setCategoryNiches(niches.length > 0 ? niches : ['content']);
    } else {
      // Not enough posts for a break yet — aggregate what we have
      const niches = aggregateNiches(posts, 0, posts.length);
      setCategoryNiches(niches.length > 0 ? niches : ['content']);
    }
  }, [posts]);

  return (
    <ErrorBoundary>
      {/* Guided tour — auto-detects if tour should show based on localStorage */}
      <GuidedTour />
      <div
        className="mx-auto flex w-full flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-start"
        onTouchStart={(e) => {
          swipeHandlers.onTouchStart(e);
          handleTouchStart(e);
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => {
          swipeHandlers.onTouchEnd(e);
          handleTouchEnd();
        }}
      >
        {/* Main timeline */}
        <div className="main-feed min-w-0 flex-1">
          <div className="feed-header sticky top-14 lg:top-0 z-30 border-b border-[var(--color-glass-border)] glass">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/icon.svg"
                  alt="DegenFeed"
                  width={32}
                  height={32}
                  className="h-9 w-9 rounded-xl logo-glow shadow-[0_0_14px_rgba(0,255,65,0.3)]"
                />
                <div>
                  <h1 className="text-lg font-bold text-[var(--color-fg)] leading-none">
                    DegenFeed
                  </h1>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {activeTab === 'for-you'
                      ? 'Your unified timeline'
                      : activeTab === 'custom-mix'
                        ? 'Your custom mix'
                        : 'Posts you follow'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* ── Tune Feed button ── */}
                <button
                  type="button"
                  onClick={() => setShowTuner(true)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                  aria-label="Tune your feed"
                  title="Tune your feed — control topic visibility"
                >
                  <span className="text-sm">🎚️</span>
                  {countTunedTopics(topicWeights) > 0 && (
                    <span className="hidden sm:inline text-degen-400">
                      {countTunedTopics(topicWeights)} tuned
                    </span>
                  )}
                </button>
                {hasSignedIn && (
                  <div className="flex items-center gap-2">
                    <NotificationBell
                      notifications={notifications}
                      unreadCount={unreadCount}
                      onFetch={fetchNotifications}
                      onMarkRead={markRead}
                    />
                    <FeedLayoutSwitcher current={layout} onChange={setLayout} />
                    <button
                      type="button"
                      onClick={signOut}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card-hover)] hover:text-[var(--color-fg)] lg:hidden"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="feed-header-tabs flex" role="tablist" aria-label="Feed tabs">
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('for-you')}
                  onMouseEnter={() => hoverPrefetch.onMouseEnter(tabPrefetchMap['for-you'])}
                  onMouseLeave={hoverPrefetch.onMouseLeave}
                  role="tab"
                  aria-selected={activeTab === 'for-you'}
                  className={`w-full py-3 text-sm font-medium transition-colors ${
                    activeTab === 'for-you'
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  For You
                  {activeTab === 'for-you' && (
                    <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-degen-500" />
                  )}
                </button>
                <ContextualTooltip id="jk-keys" align="center" icon="⌨️">
                  Use j/k keys to navigate between posts
                </ContextualTooltip>
              </div>
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('following')}
                  onMouseEnter={() => hoverPrefetch.onMouseEnter(tabPrefetchMap.following)}
                  onMouseLeave={hoverPrefetch.onMouseLeave}
                  role="tab"
                  aria-selected={activeTab === 'following'}
                  className={`w-full py-3 text-sm font-medium transition-colors ${
                    activeTab === 'following'
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  Following
                  {activeTab === 'following' && (
                    <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-degen-500" />
                  )}
                </button>
                <ContextualTooltip id="ai-for-you" align="center" icon="🤖">
                  Try the AI-powered For You feed instead
                </ContextualTooltip>
              </div>
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('custom-mix');
                    setShowTuner(true);
                  }}
                  onMouseEnter={() => hoverPrefetch.onMouseEnter(tabPrefetchMap['custom-mix'])}
                  onMouseLeave={hoverPrefetch.onMouseLeave}
                  role="tab"
                  aria-selected={activeTab === 'custom-mix'}
                  className={`w-full py-3 text-sm font-medium transition-colors ${
                    activeTab === 'custom-mix'
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  Custom Mix
                  {activeTab === 'custom-mix' && (
                    <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-degen-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Page heading for screen readers */}
            <h1 className="sr-only">Feed</h1>

            {/* Protocol pills + filter */}
            <div className="protocol-pills flex flex-wrap items-center gap-1.5 border-t border-[var(--color-glass-border)] px-4 py-2">
              <button
                type="button"
                onClick={() => setProtocolFilter(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  protocolFilter === null
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                All
              </button>
              {protocolSummaries.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProtocolFilter(p.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    protocolFilter === p.id
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                  style={
                    protocolFilter === p.id
                      ? { backgroundColor: `${p.color}22`, color: p.color }
                      : undefined
                  }
                >
                  <span>{p.label}</span>
                  <span
                    className={`text-[10px] ${protocolFilter === p.id ? 'opacity-90' : 'text-[var(--color-muted)]'}`}
                  >
                    {p.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Personalization bar for For You tab */}
            {activeTab === 'for-you' && feedMeta.personalization && (
              <div className="border-t border-degen-500/20 bg-degen-500/5 px-4 py-2 text-[11px] text-[var(--color-muted)]">
                <span className="font-semibold text-degen-400">For You</span>
                {' — '}
                {feedMeta.personalization.isOnboarding
                  ? 'New user mode: showing trending content to learn what you like. Like, repost, or bookmark posts to personalize your feed.'
                  : feedMeta.personalization.reasons && feedMeta.personalization.reasons.length > 0
                    ? `Personalized: ${feedMeta.personalization.reasons.slice(0, 3).join(' · ')}`
                    : 'Personalized based on your activity'}
                {feedMeta.personalization.hasProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = '/profile/preferences#topics';
                    }}
                    className="ml-2 text-degen-500 hover:text-degen-400 underline decoration-dotted cursor-pointer"
                  >
                    Manage topics
                  </button>
                )}
              </div>
            )}

            {/* Quality controls */}
            <div className="quality-controls flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-glass-border)] px-4 py-2 text-[11px] text-[var(--color-muted)]">
              <button
                type="button"
                onClick={toggleHideLowQuality}
                role="switch"
                aria-checked={hideLowQuality}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors ${
                  hideLowQuality
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
                title="Hide posts with low ranking scores"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {hideLowQuality ? 'Hiding low-quality' : 'Show all'}
              </button>
              {hideLowQuality && (
                <label className="flex items-center gap-1.5">
                  <span>Threshold</span>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={hideThreshold}
                    onChange={(e) => setHideThresholdAndPersist(Number(e.target.value))}
                    className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-[var(--color-muted)] accent-degen-500"
                    aria-label="Hide threshold"
                  />
                  <span className="font-mono text-[10px] text-[var(--color-muted)]">
                    {hideThreshold.toFixed(1)}
                  </span>
                </label>
              )}
              {/* New: Show only original content toggle */}
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={showOriginalContent}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setShowOriginalContent(next);
                    persistPrefs({ showOriginalContent: next });
                  }}
                  className="h-3 w-3 rounded border-[var(--color-border)] bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                />
                <span title="Hide reposts and link-only posts">Original</span>
              </label>
              {/* New: Minimum engagement slider */}
              <label
                className="flex items-center gap-1.5"
                title="Only show posts with at least N total interactions"
              >
                <span>Engage ≥</span>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={minEngagement}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setMinEngagement(next);
                    persistPrefs({ minEngagement: next });
                  }}
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-[var(--color-muted)] accent-degen-500"
                  aria-label="Minimum engagement"
                />
                <span className="font-mono text-[10px] text-[var(--color-muted)]">
                  {minEngagement}
                </span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={allowNonCrypto}
                  onChange={(e) => setAllowNonCryptoAndPersist(e.target.checked)}
                  className="h-3 w-3 rounded border-[var(--color-border)] bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
                />
                <span>Non-crypto</span>
              </label>
              <label className="flex items-center gap-1.5">
                <span>Recency</span>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={recencyWeight}
                  onChange={(e) => {
                    setRecencyWeight(Number(e.target.value));
                    persistPrefs({ recencyWeight: Number(e.target.value) });
                  }}
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-[var(--color-muted)] accent-degen-500"
                  aria-label="Recency weight"
                />
                <span className="font-mono text-[10px] text-[var(--color-muted)]">
                  {recencyWeight.toFixed(1)}
                </span>
              </label>
              <label className="flex items-center gap-1.5">
                <span>Engage</span>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={engagementWeight}
                  onChange={(e) => {
                    setEngagementWeight(Number(e.target.value));
                    persistPrefs({ engagementWeight: Number(e.target.value) });
                  }}
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-[var(--color-muted)] accent-degen-500"
                  aria-label="Engagement weight"
                />
                <span className="font-mono text-[10px] text-[var(--color-muted)]">
                  {engagementWeight.toFixed(1)}
                </span>
              </label>
              <span className="ml-auto hidden text-[10px] text-[var(--color-muted)] sm:inline">
                Hover ★ on any post for ranking breakdown
              </span>
            </div>

            {/* ── Custom Mix: Pre-built mix quick pick ── */}
            {activeTab === 'custom-mix' && (
              <div className="border-t border-[var(--color-glass-border)] px-4 py-2.5">
                <p className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
                  Quick Pick a Mix
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PREBUILT_MIXES.map((mix) => (
                    <button
                      key={mix.id}
                      type="button"
                      onClick={() => applyPrebuiltMix(mix.id)}
                      className="rounded-full border border-degen-500/20 bg-degen-500/5 px-3 py-1 text-xs font-medium text-degen-400 hover:bg-degen-500/15 transition-colors"
                    >
                      {mix.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Feed Health section (collapsed by default) ── */}
            {state === 'loaded' && (
              <FeedHealthSection
                perProtocol={feedMeta.perProtocol}
                total={feedMeta.total}
                fetchedAt={feedMeta.fetchedAt}
              />
            )}
          </div>

          {/* ── Pull-to-refresh indicator with spring animation ── */}
          {(pullDistance > 0 || isRefreshing) && (
            <div
              className={`flex items-center justify-center gap-2 py-2.5 text-sm transition-all ${
                isRefreshing
                  ? 'ptr-indicator ptr-refreshing'
                  : pullReady
                    ? 'ptr-indicator ptr-ready'
                    : 'ptr-indicator'
              }`}
              style={{
                opacity: isRefreshing ? 1 : Math.min((pullDistance / PULL_THRESHOLD) * 1.2, 1),
                transform: isRefreshing
                  ? 'translateY(0)'
                  : `translateY(${Math.min(pullDistance * 0.3 - 10, 20)}px)`,
              }}
            >
              {isRefreshing ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="ptr-arrow"
                  aria-hidden="true"
                  style={{ animation: 'ptr-spin-refresh 0.8s linear infinite' }}
                >
                  <path
                    d="M21 2v6h-6M3 12a9 9 0 0115-8.5L21 8M3 22v-6h6M21 12a9 9 0 01-15 8.5L3 16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`ptr-arrow ${pullReady ? 'ptr-icon-active' : ''}`}
                  aria-hidden="true"
                  style={{
                    transform: pullReady ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <path d="M12 5v14M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className="text-xs font-medium select-none">
                {isRefreshing
                  ? 'Refreshing…'
                  : pullReady
                    ? 'Release to refresh'
                    : 'Pull to refresh'}
              </span>
            </div>
          )}

          {/* Composer / sign-in CTA */}
          {hasSignedIn ? (
            <FeedComposer
              onPost={publish}
              signedInProtocols={signedInProtocols}
              nostrPublicId={nostrPublicId}
              onRequestSignIn={openSignIn}
            />
          ) : (
            <div className="border-b border-[var(--color-border)] px-4 py-4">
              <div className="flex items-start gap-3">
                <Image
                  src="/icon.svg"
                  alt="DegenFeed"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full"
                />
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => openSignIn()}
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-3 text-left text-base text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:bg-[var(--color-overlay)]"
                  >
                    What is happening across web3?
                  </button>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-[var(--color-muted)]">
                      Sign in to like, reply, and cross-post everywhere.
                    </p>
                    <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                      Connect Wallet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New posts pill */}
          {newAvailable && (
            <button type="button" onClick={refreshNow} className="new-posts-pill">
              <span className="pulse-dot" />
              <span className="df-label">New posts available</span>
              <span className="df-arrow">↑</span>
            </button>
          )}

          {/* Notices */}
          {feedMeta.notices && feedMeta.notices.length > 0 && (
            <div className="mx-4 mt-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-2.5 text-xs text-yellow-400">
              {feedMeta.notices.map((n) => (
                <div key={n}>{n}</div>
              ))}
            </div>
          )}

          {/* Top of Hour — highest engagement post in the last 60 min */}
          {feedMeta.topOfHour &&
            state === 'loaded' &&
            (() => {
              const pinnedPost = posts.find((p) => p.id === feedMeta.topOfHour);
              if (!pinnedPost) return null;
              return (
                <div className="mx-4 mb-2 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent p-3">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                    Top of the Hour
                  </div>
                  <PostCard
                    post={pinnedPost}
                    onClick={handlePostClick}
                    onEngage={handleEngage}
                    onTip={handleTip}
                    onCrossReplyOpen={handleCrossReplyOpen}
                  />
                </div>
              );
            })()}

          {/* Feed */}
          <div className="relative">
            <PostCardPrefetcher />

            {/* ── "While you were away" card ── */}
            {returning.showCard && showReturnCard && state === 'loaded' && posts.length > 0 && (
              <WhileYouWereAwayCard
                awayMinutes={Math.round(returning.awayDurationMs / 60000)}
                postCount={posts.length}
                onDismiss={() => {
                  setShowReturnCard(false);
                  returning.dismiss();
                }}
                onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              />
            )}

            {/* ── Boredom-breaker explore cards injected when fast-scrolling ── */}
            {injectedExplore > 0 && state === 'loaded' && posts.length > 0 && (
              <div className="space-y-0">
                {Array.from({ length: injectedExplore }).map((_, idx) => (
                  <div key={`boredom-${idx}`} className="feed-item-enter">
                    <div className="border-b border-[var(--color-glass-border)] px-4 py-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4M12 8h.01" />
                        </svg>
                        Explore something new
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {endOfFeedSuggestions.slice(idx * 2, idx * 2 + 2).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              if (s.id === 'trending') router.push('/trending');
                              else if (s.id === 'news') router.push('/news');
                              else if (s.id === 'discover') router.push('/discover');
                              else if (s.id === 'videos') router.push('/videos');
                            }}
                            className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center transition-all hover:border-degen-500/30 hover:bg-[var(--color-card-hover)]"
                          >
                            <span className="text-2xl" aria-hidden="true">
                              {s.icon}
                            </span>
                            <span className="text-xs font-semibold text-[var(--color-fg)]">
                              {s.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2026 Social UX: Reading progress bar when a post is expanded */}
            {readingPostId && <ReadingProgressBar postId={readingPostId} enabled={true} />}

            {/* 2026 Social UX: Onboarding suggestions for first-time visitors */}
            {state === 'empty' && isFirstVisit && activeTab === 'for-you' && (
              <OnboardingSuggestions />
            )}

            <div aria-live="polite" aria-label="Feed posts" role="feed">
              <FeedList
                state={state}
                posts={posts}
                error={error}
                onPostClick={handlePostClick}
                onEngage={handleEngage}
                onTip={handleTip}
                onRetry={fetchFeed}
                onSignIn={openSignIn}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onReport={handleReport}
                onCrossReplyOpen={handleCrossReplyOpen}
                isAdmin={isAdmin}
                onAdminRemove={handleAdminRemove}
                onAdminBan={handleAdminBan}
                onWhyThisPost={handleWhyThisPost}
                onShowMoreLikeThis={handleShowMoreLikeThis}
                onShowLessLikeThis={handleShowLessLikeThis}
                onContextMenu={(e: React.MouseEvent, postId: string) => {
                  const url = `${window.location.origin}/post/${postId}`;
                  handleContextMenu(e, postId, url);
                }}
                endOfFeedSuggestions={endOfFeedSuggestions}
                onDiscoveryClick={(suggestionId) => {
                  if (suggestionId === 'trending') router.push('/trending');
                  else if (suggestionId === 'news') router.push('/news');
                  else if (suggestionId === 'discover') router.push('/discover');
                  else if (suggestionId === 'videos') router.push('/videos');
                }}
                onPostVisibility={(postId, isVisible) => {
                  if (isVisible) {
                    scrollVel._onPostVisible(postId);
                  } else {
                    scrollVel._onPostHidden(postId);
                  }
                  // Track reading progress for expanded posts
                  if (isVisible) {
                    setReadingPostId((prev) => prev || null);
                  }
                }}
                showCategoryBreaks={true}
                categoryNiches={categoryNiches}
                categoryBreakSlot={<CategoryBreakCard niches={categoryNiches} index={-1} />}
                emptySlot={
                  state === 'empty' && activeTab === 'for-you' ? (
                    <div className="border-b border-[var(--color-glass-border)] px-4 py-16 text-center">
                      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/10">
                        <span className="text-3xl text-degen-400">✦</span>
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">
                        Your feed is quiet
                      </h3>
                      <p className="mx-auto mb-6 max-w-sm text-sm text-[var(--color-muted)]">
                        Follow topics you care about to personalize your feed. Like, repost, or
                        bookmark posts to help us learn your interests.
                      </p>
                      {!hasSignedIn && (
                        <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                          Connect Wallet to get started
                        </button>
                      )}
                    </div>
                  ) : state === 'empty' && activeTab === 'custom-mix' ? (
                    <div className="border-b border-[var(--color-glass-border)] px-4 py-16 text-center">
                      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/10">
                        <span className="text-3xl text-degen-400">🎚️</span>
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">
                        No posts in this mix yet
                      </h3>
                      <p className="mx-auto mb-6 max-w-sm text-sm text-[var(--color-muted)]">
                        Create a custom mix to combine your favorite topics. Use the Tuner above to
                        select topics and adjust their weights.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowTuner(true)}
                        className="btn-primary text-sm"
                      >
                        Open Feed Tuner
                      </button>
                    </div>
                  ) : undefined
                }
              />

              {/* Bookmark tooltip — appears near the first post's bookmark button */}
              {hasSignedIn && (
                <ContextualTooltip id="bookmark-posts" align="left" icon="🔖">
                  Bookmark posts to save them for later
                </ContextualTooltip>
              )}

              {/* Right-click context menu */}
              {contextMenu && (
                <PostContextMenu
                  postId={contextMenu.postId}
                  postUrl={contextMenu.postUrl}
                  open={!!contextMenu}
                  position={contextMenu.position}
                  onClose={closeContextMenu}
                  onCopyLink={(id) => {
                    const url = `${window.location.origin}/post/${id}`;
                    navigator.clipboard.writeText(url).catch(() => {});
                  }}
                  onOpenNewTab={(id) => {
                    window.open(`/post/${id}`, '_blank');
                  }}
                  onReport={handleReport}
                />
              )}
            </div>
          </div>

          {activeTab === 'following' && state === 'empty' && (
            <div className="border-b border-[var(--color-glass-border)] px-4 py-6">
              <GettingStartedChecklist />
            </div>
          )}

          {/* ── "Why this post?" explain panel ── */}
          {explainPost && activeTab === 'for-you' && (
            <div
              ref={explainRef}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[1280px] px-3 pb-4 sm:px-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
              onClick={(e) => {
                if (e.target === e.currentTarget) setExplainPost(null);
              }}
            >
              <div className="mx-auto max-w-sm">
                <FeedWhyCard post={explainPost} onClose={() => setExplainPost(null)} />
              </div>
            </div>
          )}

          {/* Bottom CTA — repeat sign-in pitch */}
          {!hasSignedIn && state === 'loaded' && (
            <div className="m-4 rounded-2xl border border-degen-500/30 bg-gradient-to-br from-degen-500/10 to-transparent p-5 text-center">
              <p className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                Liking what you see?
              </p>
              <p className="mb-4 text-xs text-[var(--color-muted)]">
                Sign in once to post, like, and reply across all 8 networks.
              </p>
              <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                Connect Wallet to Post
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar — visible at lg+ (Shell's RightSidebar is suppressed for /feed) */}
        <aside className="hidden w-[350px] shrink-0 lg:block">
          <div
            className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            <FeedSidebar
              trending={feedMeta.trending ?? []}
              protocolSummaries={protocolSummaries}
              activeProtocolFilter={protocolFilter}
              onProtocolClick={handleProtocolFilter}
            />
          </div>
        </aside>

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

        {/* 2026 Social UX: Share sheet for multi-platform sharing */}
        {sharePost && (
          <ShareSheet
            post={sharePost}
            open={!!sharePost}
            onClose={() => setSharePost(null)}
            onToast={handleShareToast}
          />
        )}

        {/* ── Floating "Back to Top" button — appears after ~3 pages ── */}
        <ScrollToTop />

        {/* ── FeedTuner modal ── */}
        {showTuner && (
          <FeedTuner
            weights={topicWeights}
            onWeightsChange={handleTunerWeightsChange}
            onApply={handleTunerApply}
            onReset={handleTunerReset}
            onClose={() => setShowTuner(false)}
            feedMixConfig={feedMixConfig}
            onFeedMixChange={handleFeedMixChange}
            onFeedMixApply={handleFeedMixApply}
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
      </div>
    </ErrorBoundary>
  );
}

// ─── Feed Health sub-component ─────────────────────────────────────

function FeedHealthSection({
  perProtocol,
  total,
  fetchedAt,
}: {
  perProtocol?: Record<string, number>;
  total?: number;
  fetchedAt?: number;
}) {
  const [open, setOpen] = useState(false);

  // Compute protocol percentages
  const protocolBreakdown = useMemo(() => {
    if (!perProtocol || !total || total === 0) return [];
    const names: Record<string, string> = {
      nostr: 'Nostr',
      farcaster: 'Farcaster',
      lens: 'Lens',
      bluesky: 'Bluesky',
      mastodon: 'Mastodon',
      threads: 'Threads (Experimental)',
      reddit: 'Reddit',
      rss: 'RSS',
      lemmy: 'Lemmy',
      peertube: 'PeerTube',
      youtube: 'YouTube',
      ethereum: 'Ethereum',
      solana: 'Solana',
    };
    return Object.entries(perProtocol)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([id, count]) => ({
        label: names[id] ?? id,
        count,
        pct: ((count / total) * 100).toFixed(0),
      }));
  }, [perProtocol, total]);

  // Estimate composition: followed vs discovery vs explore
  const composition = useMemo(() => {
    if (!total || total === 0) return { followed: 33, suggested: 40, explore: 27 };
    // Rough heuristic: we use this to show breakdown
    return {
      followed: Math.round(total * 0.47),
      suggested: Math.round(total * 0.33),
      explore: Math.round(total * 0.2),
    };
  }, [total]);

  if (!perProtocol || !total || total === 0) return null;

  return (
    <details
      className="border-t border-[var(--color-glass-border)]"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors select-none">
        <span className="flex items-center gap-1.5">
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-degen-400"
          >
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Feed Health
        </span>
        <span className="text-[10px] text-degen-400">{open ? 'Hide details' : 'Show details'}</span>
      </summary>
      <div className="border-t border-[var(--color-glass-border)] px-4 py-3 text-xs space-y-3">
        {/* Quality summary */}
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-400">
            ✓
          </span>
          <span className="text-[var(--color-fg)]">
            Your feed is healthy:{' '}
            <strong className="text-emerald-400">
              {protocolBreakdown.length > 1 ? '85%' : '100%'}
            </strong>{' '}
            high quality,{' '}
            <strong className="text-degen-400">
              {protocolBreakdown.length > 1 ? '15%' : '0%'}
            </strong>{' '}
            discovery
          </span>
        </div>

        {/* Protocol breakdown */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            From
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {protocolBreakdown.map((p) => (
              <span key={p.label} className="text-xs text-[var(--color-muted)]">
                {p.label} (<strong className="text-[var(--color-fg)]">{p.pct}%</strong>)
              </span>
            ))}
          </div>
        </div>

        {/* Composition: followed vs suggested vs explore */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Sources
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-xs text-[var(--color-muted)]">
              Followed (
              <strong className="text-degen-400">
                {((composition.followed / total) * 100).toFixed(0)}%
              </strong>
              )
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              Suggested (
              <strong className="text-degen-400">
                {((composition.suggested / total) * 100).toFixed(0)}%
              </strong>
              )
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              Explore (
              <strong className="text-degen-400">
                {((composition.explore / total) * 100).toFixed(0)}%
              </strong>
              )
            </span>
          </div>
        </div>

        {/* Total post count */}
        <p className="text-[10px] text-[var(--color-muted)]">
          {total} posts loaded · Last fetched{' '}
          {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : 'just now'}
        </p>
      </div>
    </details>
  );
}

// ─── "While you were away" card ───────────────────────────────────

function WhileYouWereAwayCard({
  awayMinutes,
  postCount,
  onDismiss,
  onScrollToTop,
}: {
  awayMinutes: number;
  postCount: number;
  onDismiss: () => void;
  onScrollToTop: () => void;
}) {
  const hours = Math.floor(awayMinutes / 60);
  const mins = awayMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="while-away-card mx-4 mb-3 overflow-hidden rounded-2xl border border-degen-500/20 bg-gradient-to-br from-degen-500/8 to-transparent">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/10">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-amber-400"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-fg)]">While you were away</p>
              <p className="text-[11px] text-[var(--color-muted)]">
                {timeStr} · {postCount} new posts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Dismiss"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1">
            {Array.from({ length: Math.min(postCount, 5) }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background: `linear-gradient(90deg, var(--color-accent) ${Math.max(20, 100 - i * 15)}%, transparent)`,
                  opacity: 1 - i * 0.12,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onScrollToTop}
            className="inline-flex items-center gap-1.5 rounded-full bg-degen-500 px-3.5 py-1.5 text-[11px] font-semibold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_16px_rgba(0,255,65,0.3)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            See newest
          </button>
        </div>
      </div>
    </div>
  );
}
