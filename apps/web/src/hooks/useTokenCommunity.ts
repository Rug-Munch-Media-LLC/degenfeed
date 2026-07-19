'use client';

import useSWR from 'swr';
import type { TokenComment } from './useLiveComments';
import type { TokenStream } from './useTokenStreams';

/* ─── Types ──────────────────────────────────────────── */

export interface HolderEntry {
  wallet: string;
  amount: string;
  percentage: number;
  usdValue: number;
  badges: string[];
  isCreator: boolean;
}

export interface TokenMilestone {
  id: string;
  tokenAddress: string;
  type: 'holders' | 'volume' | 'price' | 'graduation' | 'days_alive';
  threshold: string;
  reached: boolean;
  reachedAt?: number;
  reward?: string;
}

export interface CommunityData {
  comments: {
    recent: TokenComment[];
    total: number;
  };
  stream: TokenStream | null;
  leaderboard: HolderEntry[];
  milestones: TokenMilestone[];
  onlineNow: number;
  lastHourBuys: number;
}

export interface UseTokenCommunityResult {
  data: CommunityData | null;
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
}

/* ─── Hook ───────────────────────────────────────────── */

export function useTokenCommunity(tokenAddress: string): UseTokenCommunityResult {
  const { data, error, isLoading, mutate } = useSWR<CommunityData>(
    tokenAddress ? `/api/token/${tokenAddress}/community` : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch community data');
      return res.json() as Promise<CommunityData>;
    },
    {
      refreshInterval: 10000, // Poll every 10s
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    },
  );

  return {
    data: data ?? null,
    isLoading,
    isError: !!error,
    refresh: () => void mutate(),
  };
}

/* ─── Token progress helper for milestones ──────────── */

export function useTokenProgress(tokenAddress: string): {
  stats: { holders: number; volume: number; price: number; daysAlive: number };
  nextMilestone: {
    target: number;
    type: string;
    reward: string;
    progress: number;
  };
  reachedMilestones: TokenMilestone[];
} {
  const { data } = useTokenCommunity(tokenAddress);

  const stats = {
    holders: data?.leaderboard.length ?? 0,
    volume: data?.lastHourBuys ?? 0,
    price: 0, // Filled from curve data
    daysAlive: 0, // Calculated from token creation
  };

  const reachedMilestones = data?.milestones.filter((m) => m.reached) ?? [];

  // Determine the next un-reached milestone
  const milestoneOrder = [
    { type: 'holders' as const, value: 10, reward: 'Early badge unlocked' },
    { type: 'holders' as const, value: 50, reward: 'Trending status' },
    { type: 'holders' as const, value: 100, reward: 'Creator stream unlocked' },
    { type: 'holders' as const, value: 500, reward: 'HD streaming + recording' },
    { type: 'holders' as const, value: 1000, reward: 'Custom token page theme' },
    { type: 'volume' as const, value: 1, reward: 'First ETH raised!' },
    { type: 'volume' as const, value: 10, reward: 'Diamond hands badge' },
    { type: 'volume' as const, value: 50, reward: 'Graduation eligible' },
    { type: 'days_alive' as const, value: 7, reward: 'Week one survivor badge' },
    { type: 'days_alive' as const, value: 30, reward: 'OG status unlocked' },
  ];

  const allReached = reachedMilestones.map((m) => `${m.type}:${m.threshold}`);
  const nextMilestone = milestoneOrder.find(
    (m) => !allReached.includes(`${m.type}:${String(m.value)}`),
  ) ?? { type: 'holders', value: 0, reward: 'All milestones reached!' };

  const currentValue =
    nextMilestone.type === 'holders'
      ? stats.holders
      : nextMilestone.type === 'volume'
        ? stats.volume
        : stats.daysAlive;

  const progress =
    nextMilestone.value > 0
      ? Math.min(100, Math.round((currentValue / nextMilestone.value) * 100))
      : 100;

  return {
    stats,
    nextMilestone: {
      target: nextMilestone.value,
      type: nextMilestone.type,
      reward: nextMilestone.reward,
      progress,
    },
    reachedMilestones,
  };
}
