/**
 * @degenfeed/web — Feed data fetching hook
 *
 * Extracted from feed/page.tsx to manage:
 * - Feed post fetching with SWR caching
 * - Tab switching
 * - Polling for new content
 * - Graceful degradation on failure
 */

'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useRef, useState } from 'react';
import { encodeTopicWeights } from '../../components/FeedTuner';
import { fetchWithSwr, getCached } from '../../lib/fetchWithCache';
import type { FeedMeta, FeedTab, LoadingState } from '../../types/api';

export interface UseFeedDataOptions {
  activeTab: FeedTab;
  protocolFilter?: string | null;
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
  loadedLimit: number;
}

export interface UseFeedDataResult {
  /** The fetched posts */
  posts: UnifiedPost[];
  /** Loading/error state */
  state: LoadingState;
  /** Error message if any */
  error: string | undefined;
  /** Feed metadata from the response */
  feedMeta: FeedMeta;
  /** Whether new posts are available (for "New posts" banner) */
  newAvailable: boolean;
  /** Fetch/re-fetch feed data */
  fetchFeed: (checkOnly?: boolean) => Promise<void>;
  /** Dismiss the "new posts available" indicator */
  dismissNew: () => void;
  /** Set a specific error message */
  setError: (err: string | undefined) => void;
}

/**
 * Hook encapsulating all feed data fetching logic with:
 * - SWR (stale-while-revalidate) caching via fetchWithCache
 * - Graceful degradation to cached data on failure
 * - Polling for new content availability
 * - Follows filtering for the "following" tab
 */
export function useFeedData({
  activeTab,
  protocolFilter,
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
  loadedLimit,
}: UseFeedDataOptions): UseFeedDataResult {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | undefined>();
  const [feedMeta, setFeedMeta] = useState<FeedMeta>({});
  const [newAvailable, setNewAvailable] = useState(false);
  const lastPostIdRef = useRef('');

  const fetchFeed = useCallback(
    async (checkOnly = false) => {
      if (!checkOnly) setState('loading');
      try {
        const endpoint = activeTab === 'for-you' ? '/api/feed/for-you' : '/api/feed/home';
        // Build cache key from active tab + filters for SWR deduplication
        const cacheKey = [
          'feed',
          activeTab,
          protocolFilter ?? 'all',
          loadedLimit,
          hideLowQuality,
          allowNonCrypto,
          showOriginalContent,
          activePreset ?? 'none',
          freshnessPreference,
          exploreRatio,
        ].join('_');

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

        // Use SWR: prefer stale cache for instant render, refresh in background
        const swrResult = await fetchWithSwr<{ data?: UnifiedPost[]; meta?: FeedMeta }>(
          url.toString(),
          cacheKey,
          { credentials: 'include' },
        );
        const data = swrResult.data;
        const feed = data.data ?? [];
        // Upstream failures can arrive as 200-with-meta.errors (bridge
        // "all providers returned empty" notices) OR as non-2xx statuses
        // (fetchWithSwr throws on those). Either way we must NOT show a
        // bare "empty" state for a feed that actually errored.
        const metaErrors = data.meta?.errors;

        if (checkOnly && feed.length > 0 && feed[0]?.id !== lastPostIdRef.current) {
          setNewAvailable(true);
          return;
        }

        if (feed.length > 0) {
          lastPostIdRef.current = feed[0]?.id ?? '';
        }
        setPosts(feed);
        setFeedMeta(data.meta || {});
        if (feed.length > 0) {
          setState('loaded');
          setError(metaErrors && metaErrors.length > 0 ? metaErrors[0] : undefined);
        } else if (metaErrors && metaErrors.length > 0) {
          // Real failure — surface the error state instead of a fake "empty".
          setState('error');
          setError(metaErrors[0]);
        } else {
          setState('empty');
          setError(undefined);
        }

        if (swrResult.stale) {
          setError('Showing cached results. Updating…');
        } else {
          setError(undefined);
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
            setState('error');
            setError(err instanceof Error ? err.message : 'Failed to load feed');
          }
        }
      }
    },
    [
      activeTab,
      protocolFilter,
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
      loadedLimit,
    ],
  );

  // Dismiss new posts indicator
  const dismissNew = useCallback(() => setNewAvailable(false), []);

  return {
    posts,
    state,
    error,
    feedMeta,
    newAvailable,
    fetchFeed,
    dismissNew,
    setError,
  };
}
