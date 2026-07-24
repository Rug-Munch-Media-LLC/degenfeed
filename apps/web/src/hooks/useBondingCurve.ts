'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

/* === Types ============================================ */

export interface TradeEvent {
  id: string;
  type: 'buy' | 'sell';
  wallet: string;
  amount: string;
  usdValue: number;
  tokenAmount: string;
  timestamp: string;
  txHash?: string;
  /** Whether this trade triggered a whale alert */
  isWhale?: boolean;
  /** Whether this trade was during a flash sale */
  flashSaleDiscount?: number;
  /** Whether this trade was during a creator event */
  creatorEventDiscount?: number;
  /** Streak days at time of buy */
  streakDays?: number;
}

export interface FlashSaleInfo {
  active: boolean;
  discountBps: number;
  endTimestamp: number; // unix ms
  remainingBuys: number;
  maxBuys: number;
}

export interface CreatorEventInfo {
  active: boolean;
  discountBps: number;
  remainingBuys: number;
  totalBuys: number;
  message: string;
}

export interface CurveData {
  // Core curve data
  price: number;
  priceChange24h: number;
  progress: number; // 0–100
  totalRaised: number; // in ETH/USD
  totalSupply: number;
  marketCap: number;
  holderCount: number;
  holderList: Array<{
    address: string;
    percentage: number;
    usdValue: number;
  }>;
  recentTrades: TradeEvent[];
  graduationTarget: number;
  graduationPrice: number;
  remainingToGraduate: number;
  phase: 'early' | 'growth' | 'late' | 'graduated';
  phaseLabel: string;
  socialProof: number; // "X people bought in last 5 min"
  creatorAllocation: number;
  creatorLocked: boolean;
  creator: {
    address: string;
    name: string;
    reputation: number;
    avatar?: string;
    socials?: Record<string, string>;
  };
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  coingeckoId?: string;

  // == Dynamic Curve Fields =============================
  era: number; // 0-4
  eraName: string; // "Steal Deal" | "Early Bird" | ...
  eraColor: string;

  // == Flash Sale =======================================
  flashSale: FlashSaleInfo | null;

  // == Creator Event ====================================
  creatorEvent: CreatorEventInfo | null;

  // == Gamification =====================================
  first100Remaining: number; // slots remaining for "first 100 buyers" badge
  topHolders: Array<{
    address: string;
    amount: string;
    percentage: number;
    badges: string[];
  }>;

  // == Social Proof =====================================
  boughtLast60s: number;
  viewersNow: number;
  farcasterHolders: number;
  isTrending: boolean;
  activityHeatmap: number[]; // 24 entries (0-23 hours)

  // == Post-Graduation ==================================
  isVerified: boolean;
  uniswapPoolAddress?: string;
  burnTotal: number;

  // == Price Prediction =================================
  priceAfter10Buys: number;
  priceAfter50Buys: number;
}

/* === Simple fetch wrapper ============================= */

const fetcher = async (url: string): Promise<CurveData> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<CurveData>;
};

/* === Type guard ======================================= */

function isValidCurveData(data: unknown): data is CurveData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.price === 'number' &&
    typeof d.progress === 'number' &&
    typeof d.totalRaised === 'number' &&
    typeof d.tokenAddress === 'string'
  );
}

/* === Hook ============================================= */

export interface UseBondingCurveResult {
  curve: CurveData | null;
  price: number | null;
  progress: number | null;
  totalRaised: number | null;
  recentTrades: TradeEvent[];
  holderCount: number | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | undefined;
  isLive: boolean;
  refresh: () => void;

  // == New fields =======================================
  flashSale: FlashSaleInfo | null;
  creatorEvent: CreatorEventInfo | null;
  era: number | null;
  eraName: string | null;
  first100Remaining: number;
  boughtLast60s: number;
  viewersNow: number;
  farcasterHolders: number;
  isTrending: boolean;
  isVerified: boolean;
  priceAfter10Buys: number;
  priceAfter50Buys: number;

  // == Client-side gamification tracking ================
  streakDays: number;
  walletBadges: string[];
  walletBuyCount: number;
  walletRank: number | null;
}

export function useBondingCurve(coinAddress: string | undefined): UseBondingCurveResult {
  const url = coinAddress ? `/api/creator/coin/${encodeURIComponent(coinAddress)}/curve` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<CurveData>(url, fetcher, {
    refreshInterval: 3000,
    errorRetryCount: 3,
    dedupingInterval: 1000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const validatedData = useMemo(() => {
    if (!data || !isValidCurveData(data)) return null;
    return data;
  }, [data]);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  // == Client-side streak tracking ======================

  const [streakDays, setStreakDays] = useState(0);
  const streakRef = useRef<{ lastBuyDay: number; streak: number }>({
    lastBuyDay: 0,
    streak: 0,
  });

  // Track buys to update streak
  useEffect(() => {
    if (!validatedData?.recentTrades?.length) return;

    // Check if the user made a buy (simplified — in real app, get from auth context)
    const today = Math.floor(Date.now() / 86400000);
    const lastDay = streakRef.current.lastBuyDay;

    if (lastDay === 0) {
      streakRef.current = { lastBuyDay: today, streak: 1 };
    } else if (today > lastDay) {
      if (today === lastDay + 1) {
        streakRef.current.streak++;
      } else {
        streakRef.current.streak = 1;
      }
      streakRef.current.lastBuyDay = today;
    }

    setStreakDays(streakRef.current.streak);
  }, [validatedData?.recentTrades]);

  // == Wallet badges (computed from trade data) =========

  const walletBadges = useMemo(() => {
    if (!validatedData) return [];
    const badges: string[] = [];

    // Check if user is a first-100 buyer
    if (validatedData.holderCount <= 100) {
      badges.push('first_buyer');
    }

    // Check streak
    if (streakDays >= 7) badges.push('streak_7');
    if (streakDays >= 30) badges.push('streak_30');

    return badges;
  }, [validatedData, streakDays]);

  const walletBuyCount = validatedData?.recentTrades.filter((t) => t.type === 'buy').length ?? 0;

  // == Wallet rank (simplified) =========================
  const walletRank = useMemo(() => {
    if (!validatedData?.holderList?.length) return null;
    // In real app, get from user context
    return null;
  }, [validatedData]);

  return {
    curve: validatedData,
    price: validatedData?.price ?? null,
    progress: validatedData?.progress ?? null,
    totalRaised: validatedData?.totalRaised ?? null,
    recentTrades: validatedData?.recentTrades ?? [],
    holderCount: validatedData?.holderCount ?? null,
    isLoading,
    isError: !!error,
    error,
    isLive: isValidating,
    refresh,

    // == New fields =====================================
    flashSale: validatedData?.flashSale ?? null,
    creatorEvent: validatedData?.creatorEvent ?? null,
    era: validatedData?.era ?? null,
    eraName: validatedData?.eraName ?? null,
    first100Remaining: validatedData?.first100Remaining ?? 100,
    boughtLast60s: validatedData?.boughtLast60s ?? 0,
    viewersNow: validatedData?.viewersNow ?? 0,
    farcasterHolders: validatedData?.farcasterHolders ?? 0,
    isTrending: validatedData?.isTrending ?? false,
    isVerified: validatedData?.isVerified ?? false,
    priceAfter10Buys: validatedData?.priceAfter10Buys ?? 0,
    priceAfter50Buys: validatedData?.priceAfter50Buys ?? 0,

    // == Client-side gamification =======================
    streakDays,
    walletBadges,
    walletBuyCount,
    walletRank,
  };
}

/* === Formatting helpers =============================== */

export function formatBondingPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

export function formatBondingUsd(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Format era name with color emoji.
 */
export function formatEraDisplay(eraName: string): string {
  const emojis: Record<string, string> = {
    'Steal Deal': '💎',
    'Early Bird': '🐦',
    Cruise: '🚗',
    'FOMO Zone': '🔥',
    Finale: '🚀',
  };
  return `${emojis[eraName] ?? '⚡'} ${eraName}`;
}

/**
 * Format flash sale countdown.
 */
export function formatFlashSaleTime(msRemaining: number): string {
  const seconds = Math.floor(msRemaining / 1000);
  if (seconds <= 0) return 'Ended';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
