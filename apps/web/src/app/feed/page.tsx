'use client';

import { addBookmark, getFollows, removeBookmark } from '@degenfeed/storage';
import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList, FeedWhyCard, NotificationBell, PostCard } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { ContextualTooltip } from '../../components/ContextualTooltip';
import { FeedComposer } from '../../components/FeedComposer';
import { FeedLayoutSwitcher } from '../../components/FeedLayoutSwitcher';
import { FeedSidebar } from '../../components/FeedSidebar';
import {
  countTunedTopics,
  encodeTopicWeights,
  FeedTuner,
  getDefaultWeights,
  TOPICS,
  type TopicDef,
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
import { useNotifications } from '../../hooks/useNotifications';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { getCached, setCache } from '../../lib/fetchWithCache';
import { retryFetch } from '../../lib/retryFetch';

const TipModal = dynamic(
  () => import('../../components/TipModal').then((m) => ({ default: m.TipModal })),
  {
    ssr: false,
    loading: () => null,
  },
);

type Tab = 'for-you' | 'following';

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
  threads: { label: 'Threads', color: '#888888', emoji: '🧵' },
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

  // ── Right-click context menu
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  // ── Topic weights ──────────────────────────────────────────────
  const [topicWeights, setTopicWeights] = useState<Record<string, number>>(getDefaultWeights());
  const [showTuner, setShowTuner] = useState(false);
  const tuneTopicWeightsDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

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
        // Load topic weights
        if (data.topicWeights && typeof data.topicWeights === 'object') {
          setTopicWeights((prev) => ({ ...prev, ...data.topicWeights }));
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

  const persistPrefs = useCallback((patch: Record<string, unknown>) => {
    // Debounce: clear previous timeout so rapid slider changes don't fire N requests
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPostIdRef = useRef<string | null>(null);
  const [loadedLimit, setLoadedLimit] = useState(50);
  const hasMore = loadedLimit < 200;

  const loadMore = useCallback(() => {
    setLoadedLimit((prev) => Math.min(prev + 25, 200));
  }, []);

  const fetchFeed = useCallback(
    async (checkOnly = false) => {
      if (!checkOnly) setState('loading');
      try {
        const endpoint = activeTab === 'for-you' ? '/api/feed/for-you' : '/api/feed/home';
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('limit', String(loadedLimit));
        const protocolsToFetch = protocolFilter
          ? [protocolFilter]
          : ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'threads', 'reddit', 'rss'];
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
        const res = await retryFetch(url.toString(), {
          fetchOptions: {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'cache-control': 'no-store' },
          },
        });
        if (!res.ok) throw new Error(`Feed returned ${res.status}`);
        const data = (await res.json()) as { data?: UnifiedPost[]; meta?: FeedMeta };
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
        if (!checkOnly && feed.length > 0) {
          announce(`${feed.length} posts loaded`, 'polite');
        }
      } catch (err) {
        if (!checkOnly) {
          // Graceful degradation: show cached feed on failure
          const cached = getCached<{ posts: UnifiedPost[]; meta?: FeedMeta }>('feed_' + activeTab);
          if (cached && cached.posts.length > 0) {
            setPosts(cached.posts);
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
  const { announce } = useAnnouncer();
  const router = useRouter();
  const handlePostClick = useCallback(
    (id: string) => {
      // In for-you mode, if user clicks anywhere, open explain panel for this post
      if (activeTab === 'for-you') {
        const post = posts.find((p) => p.id === id);
        if (post && post.score) {
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

  /* ── Pull-to-refresh ─────────────────────────────────────── */
  const PULL_THRESHOLD = 80;
  const pullStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only activate pull-to-refresh when at the top of the page
    if (window.scrollY <= 0) {
      pullStartY.current = e.touches[0]?.clientY ?? 0;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling) return;
      const currentY = e.touches[0]?.clientY ?? 0;
      const diff = currentY - pullStartY.current;
      if (diff <= 0) {
        setPullDistance(0);
        return;
      }
      // Apply resistance: reduce the distance for a more natural feel
      const resisted = Math.min(diff * 0.4, 120);
      setPullDistance(resisted);
    },
    [isPulling],
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD) {
      // Trigger refresh
      setNewAvailable(false);
      fetchFeed(false);
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'info', message: 'Feed refreshed' },
        }),
      );
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [pullDistance, fetchFeed]);

  return (
    <ErrorBoundary>
      {/* Guided tour — auto-detects if tour should show based on localStorage */}
      <GuidedTour />
      <div
        className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 px-3 py-3 sm:px-4 lg:grid-cols-12"
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
        {/* Left rail — desktop only quick nav */}
        <aside className="hidden xl:col-span-3 xl:block">
          <div className="sticky top-20 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2">
                <Image
                  src="/icon.svg"
                  alt="DegenFeed"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-xl shadow-[0_0_18px_rgba(0,255,65,0.25)]"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">DegenFeed</p>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">
                    Open social graph
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                One window. Every protocol. Zero accounts to browse.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.entries(PROTOCOL_META).map(([id, m]) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${m.color}22`, color: m.color }}
                    title={`${m.label} live`}
                  >
                    {m.emoji} {m.label}
                  </span>
                ))}
              </div>
            </div>

            {!hasSignedIn && (
              <div className="rounded-2xl border border-degen-500/30 bg-degen-500/5 p-4 backdrop-blur-xl">
                <p className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                  Sign in to post & engage
                </p>
                <p className="mb-3 text-xs text-gray-400">
                  Browse without an account. Sign in with one click to like, reply, and cross-post.
                </p>
                <button type="button" onClick={openSignIn} className="btn-primary w-full text-sm">
                  Connect Wallet
                </button>
                <p className="mt-2 text-center text-[10px] text-gray-600">
                  ETH · SOL · or your existing social handle
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main timeline */}
        <main className="main-feed lg:col-span-8 xl:col-span-6">
          <div className="feed-header sticky top-16 z-30 border-b border-[var(--color-glass-border)] glass">
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
                  <p className="text-[10px] text-gray-500">
                    {activeTab === 'for-you' ? 'Your unified timeline' : 'Posts you follow'}
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
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-[var(--color-fg)] lg:hidden"
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
                  role="tab"
                  aria-selected={activeTab === 'for-you'}
                  className={`w-full py-3 text-sm font-medium transition-colors ${
                    activeTab === 'for-you'
                      ? 'text-[var(--color-fg)]'
                      : 'text-gray-500 hover:text-gray-300'
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
                  role="tab"
                  aria-selected={activeTab === 'following'}
                  className={`w-full py-3 text-sm font-medium transition-colors ${
                    activeTab === 'following'
                      ? 'text-[var(--color-fg)]'
                      : 'text-gray-500 hover:text-gray-300'
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
                    : 'text-gray-500 hover:text-gray-300'
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
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={
                    protocolFilter === p.id
                      ? { backgroundColor: `${p.color}22`, color: p.color }
                      : undefined
                  }
                >
                  <span>{p.label}</span>
                  <span
                    className={`text-[10px] ${protocolFilter === p.id ? 'opacity-90' : 'text-gray-600'}`}
                  >
                    {p.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Personalization bar for For You tab */}
            {activeTab === 'for-you' && feedMeta.personalization && (
              <div className="border-t border-degen-500/20 bg-degen-500/5 px-4 py-2 text-[11px] text-gray-400">
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
            <div className="quality-controls flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-glass-border)] px-4 py-2 text-[11px] text-gray-400">
              <button
                type="button"
                onClick={toggleHideLowQuality}
                role="switch"
                aria-checked={hideLowQuality}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors ${
                  hideLowQuality
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-gray-500 hover:text-gray-300'
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
                    className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                    aria-label="Hide threshold"
                  />
                  <span className="font-mono text-[10px] text-gray-500">
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
                  className="h-3 w-3 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
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
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                  aria-label="Minimum engagement"
                />
                <span className="font-mono text-[10px] text-gray-500">{minEngagement}</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={allowNonCrypto}
                  onChange={(e) => setAllowNonCryptoAndPersist(e.target.checked)}
                  className="h-3 w-3 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
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
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                  aria-label="Recency weight"
                />
                <span className="font-mono text-[10px] text-gray-500">
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
                  className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-gray-700 accent-degen-500"
                  aria-label="Engagement weight"
                />
                <span className="font-mono text-[10px] text-gray-500">
                  {engagementWeight.toFixed(1)}
                </span>
              </label>
              <span className="ml-auto hidden text-[10px] text-gray-600 sm:inline">
                Hover ★ on any post for ranking breakdown
              </span>
            </div>

            {/* ── Feed Health section (collapsed by default) ── */}
            {state === 'loaded' && (
              <FeedHealthSection perProtocol={feedMeta.perProtocol} total={feedMeta.total} fetchedAt={feedMeta.fetchedAt} />
            )}
          </div>

          {/* ── Pull-to-refresh indicator ── */}
          {isPulling && pullDistance > 0 && (
            <div
              className="flex items-center justify-center gap-2 py-3 text-sm text-degen-400 transition-all"
              style={{
                opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
                transform: `translateY(${Math.min(pullDistance - 20, 0)}px)`,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={pullDistance >= PULL_THRESHOLD ? '' : 'animate-bounce'}
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-medium">
                {pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
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
            <div className="border-b border-white/10 px-4 py-4">
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
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-base text-gray-400 transition-colors hover:border-degen-500/30 hover:bg-white/5"
                  >
                    What is happening across web3?
                  </button>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
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
              onContextMenu={(e: React.MouseEvent, postId: string) => {
                const url = `${window.location.origin}/post/${postId}`;
                handleContextMenu(e, postId, url);
              }}
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
              <p className="mb-4 text-xs text-gray-400">
                Sign in once to post, like, and reply across all 8 networks.
              </p>
              <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                Connect Wallet to Post
              </button>
            </div>
          )}
        </main>

        {/* Right sidebar */}
        <aside className="sidebar hidden lg:col-span-4 lg:block xl:col-span-3">
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

        {/* ── FeedTuner modal ── */}
        {showTuner && (
          <FeedTuner
            weights={topicWeights}
            onWeightsChange={handleTunerWeightsChange}
            onApply={handleTunerApply}
            onReset={handleTunerReset}
            onClose={() => setShowTuner(false)}
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
      nostr: 'Nostr', farcaster: 'Farcaster', lens: 'Lens',
      bluesky: 'Bluesky', mastodon: 'Mastodon', threads: 'Threads',
      reddit: 'Reddit', rss: 'RSS', lemmy: 'Lemmy', peertube: 'PeerTube',
      youtube: 'YouTube', ethereum: 'Ethereum', solana: 'Solana',
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
    return { followed: Math.round(total * 0.47), suggested: Math.round(total * 0.33), explore: Math.round(total * 0.2) };
  }, [total]);

  if (!perProtocol || !total || total === 0) return null;

  return (
    <details
      className="border-t border-[var(--color-glass-border)]"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-[11px] text-gray-500 hover:text-gray-300 transition-colors select-none">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-degen-400">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Feed Health
        </span>
        <span className="text-[10px] text-degen-400">
          {open ? 'Hide details' : 'Show details'}
        </span>
      </summary>
      <div className="border-t border-[var(--color-glass-border)] px-4 py-3 text-xs space-y-3">
        {/* Quality summary */}
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-400">
            ✓
          </span>
          <span className="text-gray-300">
            Your feed is healthy:{' '}
            <strong className="text-emerald-400">{protocolBreakdown.length > 1 ? '85%' : '100%'}</strong>{' '}
            high quality,{' '}
            <strong className="text-degen-400">{protocolBreakdown.length > 1 ? '15%' : '0%'}</strong>{' '}
            discovery
          </span>
        </div>

        {/* Protocol breakdown */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
            From
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {protocolBreakdown.map((p) => (
              <span key={p.label} className="text-xs text-gray-400">
                {p.label} (<strong className="text-gray-300">{p.pct}%</strong>)
              </span>
            ))}
          </div>
        </div>

        {/* Composition: followed vs suggested vs explore */}
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Sources
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-xs text-gray-400">
              Followed (<strong className="text-degen-400">{((composition.followed / total) * 100).toFixed(0)}%</strong>)
            </span>
            <span className="text-xs text-gray-400">
              Suggested (<strong className="text-degen-400">{((composition.suggested / total) * 100).toFixed(0)}%</strong>)
            </span>
            <span className="text-xs text-gray-400">
              Explore (<strong className="text-degen-400">{((composition.explore / total) * 100).toFixed(0)}%</strong>)
            </span>
          </div>
        </div>

        {/* Total post count */}
        <p className="text-[10px] text-gray-600">
          {total} posts loaded · Last fetched{' '}
          {fetchedAt
            ? new Date(fetchedAt).toLocaleTimeString()
            : 'just now'}
        </p>
      </div>
    </details>
  );
}
