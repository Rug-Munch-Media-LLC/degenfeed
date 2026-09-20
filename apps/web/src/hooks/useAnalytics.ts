'use client';

/**
 * useAnalytics — SWR hook for the creator analytics API
 *
 * Fetches data from the premium-gated /api/analytics/creator/:wallet/* endpoints.
 * Returns typed responses for each data domain with loading/error states.
 */

import useSWR from 'swr';
import { useAuth } from '../components/AuthProvider';

// ─── Types ─────────────────────────────────────────────────────────

export interface CreatorOverview {
  earnings: {
    totalUsd: number;
    bySource: {
      tips: number;
      coinFees: number;
      subscriptions: number;
      streams: number;
    };
    byProtocol: Record<string, number>;
    history30d: number[];
    historyLabels: string[];
  };
  coin: {
    exists: boolean;
    symbol: string | null;
    priceUsd: number | null;
    marketCap: number | null;
    holders: number;
    holderGrowth24h: number;
    volume24h: number;
    bondingCurveProgress: number;
    graduated: boolean;
    topHolders: { address: string; percentage: number }[];
    chains: string[];
  };
  content: {
    totalPosts: number;
    postsByProtocol: Record<string, number>;
    postsByDay: number[];
    dayLabels: string[];
    topPosts: TopPost[];
    bestProtocol: string | null;
    bestProtocolEngagement: number;
  };
  followers: {
    total: number;
    byProtocol: Record<string, number>;
    growth30d: number[];
    growthLabels: string[];
    engagementRate: number;
  };
}

export interface EarningsBreakdown {
  totalUsd: number;
  bySource: {
    tips: number;
    coinFees: number;
    subscriptions: number;
    streams: number;
  };
  byProtocol: Record<string, number>;
  history30d: number[];
  historyLabels: string[];
  byCurrency: Record<string, number>;
  topTippers: { name: string; totalUsd: number }[];
  last10: { amount: string; currency: string; protocol: string; createdAt: number }[];
}

export interface CoinAnalytics {
  exists: boolean;
  symbol: string | null;
  name: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  holders: number;
  holderGrowth24h: number;
  volume24h: number;
  volume7d: number;
  bondingCurveProgress: number;
  graduated: boolean;
  graduatedAt: string | null;
  topHolders: { address: string; percentage: number }[];
  chains: { chain: string; address: string; explorer: string }[];
  tradeVelocity24h: number;
  largestBuys: { amount: number; usdValue: number; txHash: string; timestamp: number }[];
  priceHistory: { timestamp: number; price: number }[];
}

export interface AudienceInsights {
  total: number;
  byProtocol: Record<string, number>;
  protocolGrowth: Record<string, { current: number; growth30d: number[]; growthLabels: string[] }>;
  engagementRate: number;
  engagementByProtocol: Record<
    string,
    { likes: number; reposts: number; replies: number; rate: number }
  >;
  geographic: Record<string, number>;
  topContent: TopPost[];
}

export interface ContentPerformance {
  totalPosts: number;
  postsByProtocol: Record<string, number>;
  postsByDay: number[];
  dayLabels: string[];
  byWeekday: number[];
  weekdayLabels: string[];
  engagementPerPost: Record<string, { avg: number; total: number; count: number }>;
  bestProtocol: string | null;
  bestProtocolEngagement: number;
  optimalPostingHour: number | null;
  typeBreakdown: { photo: number; video: number; text: number; link: number };
  topPosts: TopPost[];
}

export interface PlatformOverview {
  totalCreators: number;
  totalCoins: number;
  totalVolumeUsd: number;
  activeUsers24h: number;
  newSignups24h: number;
  premiumConversions24h: number;
  revenue24h: number;
  totalRevenue: number;
  activeProtocols: Record<string, number>;
  topCreators: { wallet: string; handle: string; revenueUsd: number }[];
}

export interface TopPost {
  id: string;
  protocol: string;
  content: string;
  likes: number;
  reposts: number;
  replies: number;
  tips: number;
  tipsUsd: number;
  createdAt: string;
}

// ─── Fetcher ───────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 402) {
    throw new Error('Premium required');
  }
  if (!res.ok) {
    throw new Error(`Analytics API error: ${res.status}`);
  }
  return res.json();
};

// ─── Hook ──────────────────────────────────────────────────────────

interface AnalyticsOptions {
  /** Auto-refresh interval in ms (default: 120_000 = 2 min) */
  refreshInterval?: number;
}

export function useAnalyticsOverview(options?: AnalyticsOptions) {
  const { walletAddress } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<CreatorOverview>(
    walletAddress ? `/api/analytics/creator/${walletAddress}/overview` : null,
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 120_000,
      revalidateOnFocus: true,
      errorRetryCount: 2,
    },
  );

  return {
    overview: data,
    loading: isLoading,
    error: error?.message ?? null,
    isPremiumRequired: error?.message === 'Premium required',
    refresh: mutate,
  };
}

export function useAnalyticsEarnings(options?: AnalyticsOptions) {
  const { walletAddress } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<EarningsBreakdown>(
    walletAddress ? `/api/analytics/creator/${walletAddress}/earnings` : null,
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 120_000,
      revalidateOnFocus: true,
      errorRetryCount: 2,
    },
  );

  return {
    earnings: data,
    loading: isLoading,
    error: error?.message ?? null,
    isPremiumRequired: error?.message === 'Premium required',
    refresh: mutate,
  };
}

export function useAnalyticsCoin(options?: AnalyticsOptions) {
  const { walletAddress } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<CoinAnalytics>(
    walletAddress ? `/api/analytics/creator/${walletAddress}/coin` : null,
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 120_000,
      revalidateOnFocus: true,
      errorRetryCount: 2,
    },
  );

  return {
    coin: data,
    loading: isLoading,
    error: error?.message ?? null,
    isPremiumRequired: error?.message === 'Premium required',
    refresh: mutate,
  };
}

export function useAnalyticsAudience(options?: AnalyticsOptions) {
  const { walletAddress } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<AudienceInsights>(
    walletAddress ? `/api/analytics/creator/${walletAddress}/audience` : null,
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 120_000,
      revalidateOnFocus: true,
      errorRetryCount: 2,
    },
  );

  return {
    audience: data,
    loading: isLoading,
    error: error?.message ?? null,
    isPremiumRequired: error?.message === 'Premium required',
    refresh: mutate,
  };
}

export function useAnalyticsContent(options?: AnalyticsOptions) {
  const { walletAddress } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<ContentPerformance>(
    walletAddress ? `/api/analytics/creator/${walletAddress}/content` : null,
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 120_000,
      revalidateOnFocus: true,
      errorRetryCount: 2,
    },
  );

  return {
    content: data,
    loading: isLoading,
    error: error?.message ?? null,
    isPremiumRequired: error?.message === 'Premium required',
    refresh: mutate,
  };
}

export function usePlatformAnalytics(options?: AnalyticsOptions) {
  useAuth(); // walletAddress unused in this fn
  const { data, error, isLoading, mutate } = useSWR<PlatformOverview>(
    '/api/analytics/platform/overview',
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? 300_000,
      revalidateOnFocus: false,
      errorRetryCount: 2,
    },
  );

  return {
    platform: data,
    loading: isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}
