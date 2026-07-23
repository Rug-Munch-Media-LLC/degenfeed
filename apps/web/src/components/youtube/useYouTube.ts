'use client';

/**
 * @degenfeed/web — useYouTube
 *
 * SWR hooks for YouTube data fetching.
 * All API calls go through /api/youtube/* endpoints.
 * YouTube content is clearly labeled as YouTube (not PeerTube).
 */

import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

// === Types ===============================================================

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelName: string;
  channelAvatar: string;
  channelId: string;
  viewCount: number;
  likeCount: number;
  duration: string;
  publishedAt: string;
  category: string;
  tags: string[];
  isShort: boolean;
}

export interface EnrichedYouTubeVideo extends YouTubeVideo {
  canTip: boolean;
  creatorCoin?: { address: string; symbol: string };
  creatorDegenFeedProfile?: string;
  source: 'youtube';
  sourceLabel: 'YouTube';
  sourceColor: '#FF0000';
}

export interface YouTubeCategory {
  id: string;
  label: string;
  icon: string;
}

export interface YouTubeShort {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  channelName: string;
  channelAvatar: string;
  channelId: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  category: string;
  tags: string[];
  vertical: boolean;
}

interface YouTubeResponse<T> {
  data: T[];
  meta: {
    count: number;
    category?: string;
    query?: string;
    personalized?: boolean;
    source: 'youtube';
    sourceLabel: string;
  };
}

interface ChannelResponse {
  channel: { name: string; channelId: string; avatar: string; subscriberCount: number; videoCount: number } | null;
  videos: EnrichedYouTubeVideo[];
  meta: { count: number; source: string; sourceLabel: string };
}

// === Fetcher =============================================================

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
};

// === Hooks ===============================================================

/**
 * Fetch trending YouTube videos in a category.
 */
export function useYouTubeTrending(category = 'all', limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<YouTubeResponse<EnrichedYouTubeVideo>>(
    `/api/youtube/trending?category=${encodeURIComponent(category)}&limit=${limit}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 300_000, // 5 min client-side dedup
      errorRetryCount: 2,
    },
  );

  return {
    videos: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Fetch personalized YouTube recommendations.
 */
export function useYouTubeRecommended(limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<YouTubeResponse<EnrichedYouTubeVideo>>(
    `/api/youtube/recommended?limit=${limit}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      errorRetryCount: 2,
    },
  );

  return {
    videos: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Search YouTube videos.
 */
export function useYouTubeSearch(query: string, limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<YouTubeResponse<EnrichedYouTubeVideo>>(
    query ? `/api/youtube/search?q=${encodeURIComponent(query)}&limit=${limit}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120_000,
      errorRetryCount: 2,
    },
  );

  return {
    videos: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Fetch YouTube Shorts.
 */
export function useYouTubeShorts(category = 'crypto', limit = 30) {
  const { data, error, isLoading, mutate } = useSWR<YouTubeResponse<YouTubeShort>>(
    `/api/youtube/shorts?category=${encodeURIComponent(category)}&limit=${limit}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
      errorRetryCount: 2,
    },
  );

  return {
    shorts: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Fetch channel info and videos.
 */
export function useYouTubeChannel(channelId: string, limit = 20) {
  const { data, error, isLoading, mutate } = useSWR<ChannelResponse>(
    channelId ? `/api/youtube/channels/${encodeURIComponent(channelId)}?limit=${limit}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
      errorRetryCount: 2,
    },
  );

  return {
    channel: data?.channel ?? null,
    videos: data?.videos ?? [],
    meta: data?.meta,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Fetch available YouTube categories.
 */
export function useYouTubeCategories() {
  const { data, error, isLoading } = useSWR<{ categories: YouTubeCategory[] }>(
    '/api/youtube/categories',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 600_000, // 10 min — categories rarely change
      errorRetryCount: 1,
    },
  );

  return {
    categories: data?.categories ?? [],
    isLoading,
    isError: !!error,
  };
}

/**
 * Infinite scroll hook for trending videos.
 */
export function useYouTubeTrendingInfinite(category = 'all', limit = 20) {
  const getKey = (pageIndex: number, previousPageData: YouTubeResponse<EnrichedYouTubeVideo> | null) => {
    if (previousPageData && previousPageData.data.length < limit) return null;
    return `/api/youtube/trending?category=${encodeURIComponent(category)}&limit=${limit}&page=${pageIndex + 1}`;
  };

  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<YouTubeResponse<EnrichedYouTubeVideo>>(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
    },
  );

  const allVideos = data?.flatMap((page) => page.data) ?? [];
  const hasMore = data ? (data[data.length - 1] as typeof data[number])?.data.length >= limit : true;

  return {
    videos: allVideos,
    isLoading,
    isValidating,
    isError: !!error,
    error,
    hasMore,
    loadMore: () => setSize(size + 1),
    mutate,
  };
}

// === Utility helpers ====================================================

export function formatYouTubeCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatYouTubeDuration(duration: string): string {
  if (!duration) return '';
  if (/^\d+:\d{2}(:\d{2})?$/.test(duration)) return duration;
  if (duration.startsWith('PT')) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;
    const h = match[1] ? Number.parseInt(match[1], 10) : 0;
    const m = match[2] ? Number.parseInt(match[2], 10) : 0;
    const s = match[3] ? Number.parseInt(match[3], 10) : 0;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return duration;
}

export function formatYouTubeTimeAgo(publishedAt: string): string {
  const ms = new Date(publishedAt).getTime();
  if (Number.isNaN(ms)) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
