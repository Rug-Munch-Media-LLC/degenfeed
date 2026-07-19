'use client';

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

/* ─── Types ──────────────────────────────────────────── */

export interface TradeEvent {
  id: string;
  type: 'buy' | 'sell';
  wallet: string;
  amount: string;
  usdValue: number;
  tokenAmount: string;
  timestamp: string;
  txHash?: string;
}

export interface CurveData {
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
  graduationTarget: number; // total needed to graduate
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
}

/* ─── Simple fetch wrapper ───────────────────────────── */

const fetcher = async (url: string): Promise<CurveData> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<CurveData>;
};

/* ─── Type guard ─────────────────────────────────────── */

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

/* ─── Hook ───────────────────────────────────────────── */

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
}

export function useBondingCurve(coinAddress: string | undefined): UseBondingCurveResult {
  const url = coinAddress ? `/api/creator/coin/${encodeURIComponent(coinAddress)}/curve` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<CurveData>(url, fetcher, {
    refreshInterval: 3000, // Poll every 3s for real-time feel
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
  };
}

/* ─── Stablecoin price helper ────────────────────────── */

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
