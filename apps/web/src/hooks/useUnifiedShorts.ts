'use client';

/**
 * useUnifiedShorts — SWR infinite hook for the unified multi-protocol shorts feed.
 *
 * Fetches from /api/shorts/unified/feed with cursor-based pagination.
 * Returns shorts aggregated from all protocols (ActivityPub/Loops, AT Protocol/Flashes,
 * Nostr, Farcaster, Lens, Zora, PeerTube, DegenFeed) with source breakdowns.
 */

import { useCallback, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';

// === Types =================================================================

export type ShortSource =
  | 'loops'
  | 'activitypub'
  | 'atprotocol'
  | 'flashes'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'zora'
  | 'peertube'
  | 'youtube'
  | 'tiktok'
  | 'tiktok_rss'
  | 'instagram'
  | 'pixelfed'
  | 'degenfeed';

export interface ZoraNftInfo {
  contractAddress: string;
  tokenId: string;
  mintPrice: string;
  mintCurrency: string;
  editionSize: number;
  mintedCount: number;
  creatorAddress: string;
}

export interface CrossChainTip {
  eth?: { address: string; chain: 'base' | 'ethereum' | 'arbitrum' };
  sol?: { address: string };
  lightning?: { address: string };
  zora?: { contract: string; tokenId: string };
}

export interface UnifiedShortItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  authorName: string;
  authorAvatar?: string;
  authorHandle: string;
  views: number;
  likes: number;
  source: ShortSource;
  sourceUrl: string;
  sourceLabel: string;
  topics: string[];
  publishedAt: number;
  vertical: boolean;
  nft?: ZoraNftInfo;
  tips?: CrossChainTip;
  caption: string;
  hashtags: string[];
  muted: boolean;
}

export interface UnifiedShortsResponse {
  shorts: UnifiedShortItem[];
  sources: Record<ShortSource, number>;
  nextCursor: string | null;
  hasMore: boolean;
  aggregatedAt: number;
  /** Feed type returned */
  feedType?: UnifiedFeedType;
}

export type UnifiedFeedType = 'for-you' | 'trending' | 'following' | 'loops-only';

export interface UseUnifiedShortsOptions {
  source?: ShortSource;
  category?: string;
  feedType?: UnifiedFeedType;
  limit?: number;
}

export interface UseUnifiedShortsResult {
  shorts: UnifiedShortItem[];
  sources: Record<ShortSource, number> | null;
  isLoading: boolean;
  isValidating: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: Error | undefined;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  isEmpty: boolean;
}

// === Fetcher ===============================================================

const fetcher = async (url: string): Promise<UnifiedShortsResponse> => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'cache-control': 'no-store' },
  });
  if (!res.ok) {
    throw new Error(`Unified shorts feed returned ${res.status}`);
  }
  return res.json() as Promise<UnifiedShortsResponse>;
};

// === Hook ==================================================================

export function useUnifiedShorts(opts: UseUnifiedShortsOptions = {}): UseUnifiedShortsResult {
  const { source, category, feedType = 'for-you', limit = 20 } = opts;

  const getKey = useCallback(
    (pageIndex: number, previousPageData: UnifiedShortsResponse | null) => {
      // Reached the end
      if (previousPageData && !previousPageData.nextCursor) return null;

      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (pageIndex > 0 && previousPageData?.nextCursor) {
        params.set('cursor', previousPageData.nextCursor);
      }
      if (source) params.set('source', source);
      if (category) params.set('category', category);

      // Route to the correct endpoint based on feed type
      let endpoint: string;
      switch (feedType) {
        case 'trending':
          endpoint = '/api/shorts/unified/trending';
          break;
        case 'following':
          endpoint = '/api/shorts/unified/following';
          break;
        case 'loops-only':
          endpoint = '/api/shorts/unified/loops';
          break;
        default:
          endpoint = '/api/shorts/unified/feed';
          break;
      }

      return `${endpoint}?${params.toString()}`;
    },
    [source, category, feedType, limit],
  );

  const { data, error, size, setSize, isValidating, mutate } =
    useSWRInfinite<UnifiedShortsResponse>(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      errorRetryCount: 3,
    });

  const shorts = useMemo(() => data?.flatMap((page) => page.shorts) ?? [], [data]);

  const sources = useMemo(() => (data?.[0]?.sources ? { ...data[0].sources } : null), [data]);

  const hasMore = useMemo(() => data?.[data.length - 1]?.hasMore ?? true, [data]);

  const isLoadingInitial = !data && !error;
  const isLoadingMore =
    isLoadingInitial || (size > 0 && data && typeof data[size - 1] === 'undefined');

  const loadMore = useCallback(() => {
    if (hasMore && !isValidating) {
      void setSize(size + 1);
    }
  }, [hasMore, isValidating, size, setSize]);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    shorts,
    sources,
    isLoading: isLoadingInitial,
    isValidating,
    isLoadingMore: isLoadingMore ?? false,
    isRefreshing: isValidating && data !== undefined,
    error,
    hasMore,
    loadMore,
    refresh,
    isEmpty: !isLoadingInitial && shorts.length === 0,
  };
}
