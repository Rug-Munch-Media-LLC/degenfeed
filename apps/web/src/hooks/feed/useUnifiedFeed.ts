'use client';

/**
 * @degenfeed/web — useUnifiedFeed
 *
 * Single source of truth for the unified feed's data layer, extracted from
 * feed/page.tsx. Owns:
 *  - Fetching the unified cross-protocol timeline (`/api/feed/unified`) with
 *    SWR stale-while-revalidate caching
 *  - Per-protocol parallel fallback when the unified feed is empty/errored
 *  - "Following" filter, client-side algorithm ranking (rankTopAlgo), and
 *    infinite-scroll pagination (append mode)
 *  - Polling support (pollFeed) + page reset/refresh
 *
 * The page keeps the render layer + engagement/realtime/tuner concerns; this
 * hook owns everything that turns URL params into the post timeline.
 */

import { getFollows } from '@degenfeed/storage';
import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedMixConfig } from '../../components/FeedTuner';
import { encodeTopicWeights } from '../../components/FeedTuner';
import type { AlgoProfile } from '../../lib/algoProfile';
import type { FeedControls } from '../../lib/feedRanking';
import { fetchWithSwr, getCached } from '../../lib/fetchWithCache';
import { rankTopAlgo } from '../../lib/topAlgo';
import type { LoadingState } from '../../types/api';

export type FeedTab = 'for-you' | 'following' | 'trending' | 'news' | 'custom-mix';

export interface FeedMeta {
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

export interface UseUnifiedFeedOptions {
  /** Active protocol tab — drives `filter` + SWR cache bucketing. */
  activeTab: FeedTab;
  /** Whether the visitor has any connected protocol (signed in). */
  hasSignedIn: boolean;
  /** User-controllable feed controls (sort, protocols, content type…). */
  controls: FeedControls;
  hideLowQuality: boolean;
  hideThreshold: number;
  allowNonCrypto: boolean;
  showOriginalContent: boolean;
  minEngagement: number;
  maxPerNiche: number;
  recencyWeight: number;
  engagementWeight: number;
  topicWeights: Record<string, number>;
  algorithmTransparent: boolean;
  freshnessPreference: number;
  creatorDiversity: number;
  exploreRatio: number;
  activePreset: string | null;
  /** Protocol weights from the feed mix tuner (blended into ranking). */
  feedMixConfig: FeedMixConfig;
  /** Latest engagement profile — read through a ref so fetchFeed stays stable. */
  algoProfile: AlgoProfile;
  /** Server-rendered initial posts (SSR handoff) used as the first render seed. */
  initialPosts: UnifiedPost[];
  /** Screen-reader announcer callback (optional). */
  announceFeed?: (msg: string, priority?: 'polite' | 'assertive') => void;
}

export interface UseUnifiedFeedResult {
  /** The fetched posts (newest first after ranking). */
  posts: UnifiedPost[];
  /** Direct setter — used by realtime insertions that merge queued posts. */
  setPosts: React.Dispatch<React.SetStateAction<UnifiedPost[]>>;
  /** Loading/loaded/empty/error state machine for the timeline. */
  state: LoadingState;
  /** Human-readable error message when state === 'error'. */
  error: string | undefined;
  /** Force a specific error message (e.g. from a realtime connection loss). */
  setError: (err: string | undefined) => void;
  /** Metadata from the last feed response (notices/errors/per-protocol). */
  feedMeta: FeedMeta;
  /** True while a full (non-append) fetch is in flight with content showing. */
  refreshing: boolean;
  /** Current page number (infinite scroll). */
  page: number;
  /** Whether another page is available. */
  hasMore: boolean;
  /** True while the infinite-scroll append fetch is in flight. */
  loadingMore: boolean;
  /** Fetch page 1 (or a specific page) — appends when `append` is true. */
  fetchFeed: (pageNum?: number, append?: boolean) => Promise<void>;
  /** Fetch the next page when more posts exist and the feed is loaded. */
  loadMore: () => void;
  /** Reset pagination and reload page 1 (used by pull-to-refresh). */
  refresh: () => Promise<void>;
  /** Fetch just the first page of post ids for the background poller. */
  pollFeed: () => Promise<UnifiedPost[]>;
}

/**
 * Unified feed data hook — see file header. Behavior is a faithful extraction
 * of feed/page.tsx's previous inline fetchFeed so the timeline renders
 * identically (unified endpoint → per-protocol fallback → ranked list).
 */
export function useUnifiedFeed(options: UseUnifiedFeedOptions): UseUnifiedFeedResult {
  const {
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
  } = options;

  const [posts, setPosts] = useState<UnifiedPost[]>(initialPosts);
  // Server-rendered initial posts arrive via InitialFeedProvider — using them
  // as the seed means the very first SSR + hydration render already shows
  // content (no skeleton flash, no post-hydration DOM swap).
  const [state, setState] = useState<LoadingState>(initialPosts.length > 0 ? 'loaded' : 'loading');
  // True while a full feed fetch is in flight. When posts already exist we
  // keep showing them (SWR stale-while-revalidate) and just surface a subtle
  // "Loading fresh content…" indicator instead of wiping the timeline.
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | undefined>();
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  // Infinite scroll pagination: page N is requested with ?page=N and appended
  // (deduped) to the timeline. hasMore comes from the API meta.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Ref mirrors the latest profile so fetchFeed can personalize without being
  // re-created (and re-fetching) on every engagement action.
  const algoProfileRef = useRef(algoProfile);
  algoProfileRef.current = algoProfile;

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
      //
      // Bridge sort contract: `new` (chronological) | `trending` (default,
      // score + diversity). Map the richer client sort set onto it — `latest`
      // is the only chronological mode; every other client sort is a ranking
      // mode, so the server serves the trending pool and rankTopAlgo applies
      // the fine-grained ordering + personalization after fetch.
      url.searchParams.set('sort', controls.sort === 'latest' ? 'new' : 'trending');
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
      hideThreshold,
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
          announceFeed?.(`${feed.length} posts loaded${swrFromCache ? ' (cached)' : ''}`, 'polite');
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

  // Initial + re-fetch on dependency change (tab switch, control change, …).
  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  /** Load the next page of posts (infinite scroll / "Load more" button). */
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || state !== 'loaded') return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    void fetchFeed(next, true);
  }, [loadingMore, hasMore, state, page, fetchFeed]);

  /** Reset pagination and reload the first page (pull-to-refresh, retry). */
  const refresh = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    await fetchFeed(1);
  }, [fetchFeed]);

  /** Poller payload: page 1 of the same effective feed, ids only. */
  const pollFeed = useCallback(async () => {
    const res = await fetch(buildFeedUrl(1).toString(), { credentials: 'include' });
    const data = (await res.json()) as { data?: UnifiedPost[] };
    return data.data ?? [];
  }, [buildFeedUrl]);

  return {
    posts,
    setPosts,
    state,
    error,
    setError,
    feedMeta,
    refreshing,
    page,
    hasMore,
    loadingMore,
    fetchFeed,
    loadMore,
    refresh,
    pollFeed,
  };
}
