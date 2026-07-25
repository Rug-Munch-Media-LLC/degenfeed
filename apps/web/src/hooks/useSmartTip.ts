'use client';

/**
 * @degenfeed/web — useSmartTip
 *
 * Enhanced tip hook with multi-chain selection, cross-chain routing,
 * and auto wallet detection. Builds on useTip but adds:
 *   - Smart chain selection (calls /api/tip/smart-chain)
 *   - Cross-chain routing support
 *   - Wallet capability detection
 *   - Fee estimation
 */

import { useCallback, useState, useMemo } from 'react';
import { useSolana } from '../components/SolanaProvider';
import { useWeb3 } from '../components/Web3Provider';
import type { TipMethod, TipIntent, TipState } from './useTip';
import { useTip } from './useTip';

// ─── Types ──────────────────────────────────────────────────────────────

export type SupportedChain = 'lightning' | 'ethereum' | 'base' | 'solana' | 'polygon' | 'optimism' | 'arbitrum';

export interface SmartChainOption {
  chain: SupportedChain;
  rank: number;
  reason: string;
  route: {
    chain: string;
    currency: string;
    tokens: string[];
    avgFeeUsd: number;
    speed: string;
  };
}

export interface CrossChainRequest {
  amountUsd: number;
  fromChain: SupportedChain;
  fromCurrency: string;
  toChain: SupportedChain;
  targetCoinAddress: string;
  creatorAddress: string;
  fromUserId?: string;
  fromLabel?: string;
}

export interface CrossChainResult {
  success: boolean;
  settledAmountUsd: number;
  quoteSteps: Array<{
    type: string;
    fromChain?: string;
    toChain?: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmount: string;
    toAmount: string;
    feeUsd: number;
    actionUrl?: string;
  }>;
  estimatedFeeUsd: number;
  estimatedTime: string;
  activityId?: string;
}

export interface CreatorTipAnalytics {
  totalReceived: number;
  totalReceivedUsd: number;
  tipCount: number;
  uniqueTippers: number;
  byProtocol: Record<string, { totalUsd: number; count: number }>;
  byChain: Record<string, { totalUsd: number; count: number }>;
  topTippers: Array<{ userId: string; totalUsd: number; count: number }>;
  averageAmountUsd: number;
  timeSeries?: Array<{ date: string; amountUsd: number; count: number }>;
  periods: {
    '24h': { totalUsd: number; count: number };
    '7d': { totalUsd: number; count: number };
    '30d': { totalUsd: number; count: number };
    alltime: { totalUsd: number; count: number };
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useSmartTip() {
  const { state, resolveMethods, createTip, fetchLightningInvoice, setTipStatus } = useTip();
  const { account: evmAccount, chainId: evmChainId } = useWeb3();
  const { account: solAccount } = useSolana();

  const [smartChains, setSmartChains] = useState<SmartChainOption[]>([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [crossChainQuote, setCrossChainQuote] = useState<CrossChainResult | null>(null);
  const [analytics, setAnalytics] = useState<CreatorTipAnalytics | null>(null);

  // ── Detect available chains from connected wallets ──────────────────
  const availableChains = useMemo((): SupportedChain[] => {
    const chains: SupportedChain[] = ['lightning']; // Lightning is always available
    if (evmAccount) {
      chains.push('base', 'ethereum', 'polygon', 'optimism', 'arbitrum');
    }
    if (solAccount) {
      chains.push('solana');
    }
    return chains;
  }, [evmAccount, solAccount]);

  /**
   * Fetch smart chain recommendations from the server.
   */
  const fetchSmartChains = useCallback(async (params?: {
    senderChains?: SupportedChain[];
    recipientChains?: SupportedChain[];
    amountUsd?: number;
    recipientHasLightning?: boolean;
    recipientHasSolana?: boolean;
    recipientHasEvm?: boolean;
  }): Promise<SmartChainOption[]> => {
    setChainLoading(true);
    try {
      const searchParams = new URLSearchParams({
        senderChains: (params?.senderChains ?? availableChains).join(','),
        recipientChains: (params?.recipientChains ?? ['base', 'solana']).join(','),
        amountUsd: String(params?.amountUsd ?? 10),
        recipientHasLightning: String(!!params?.recipientHasLightning ?? true),
        recipientHasSolana: String(!!params?.recipientHasSolana ?? true),
        recipientHasEvm: String(!!params?.recipientHasEvm ?? true),
      });

      const res = await fetch(`/api/tip/smart-chain?${searchParams.toString()}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as { chains?: SmartChainOption[] };
      const chains = data.chains ?? [];
      setSmartChains(chains);
      return chains;
    } catch {
      return [];
    } finally {
      setChainLoading(false);
    }
  }, [availableChains]);

  /**
   * Compute a cross-chain tip quote.
   * Tip in ETH on Ethereum, receive SOL on Solana (or any chain combo).
   */
  const getCrossChainQuote = useCallback(async (req: CrossChainRequest): Promise<CrossChainResult | null> => {
    try {
      const res = await fetch('/api/tip/cross-chain', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });
      const data = (await res.json()) as CrossChainResult & { error?: string };
      if (data.error) throw new Error(data.error);
      setCrossChainQuote(data);
      return data;
    } catch (err) {
      console.error('[useSmartTip] cross-chain quote failed:', err);
      return null;
    }
  }, []);

  /**
   * Fetch tip analytics for a creator.
   */
  const fetchAnalytics = useCallback(async (userId: string): Promise<CreatorTipAnalytics | null> => {
    try {
      const res = await fetch(`/api/tip/unified/analytics?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as CreatorTipAnalytics & { error?: string };
      if (data.error) throw new Error(data.error);
      setAnalytics(data);
      return data;
    } catch (err) {
      console.error('[useSmartTip] analytics fetch failed:', err);
      return null;
    }
  }, []);

  /**
   * Send a cross-chain tip.
   */
  const sendCrossChainTip = useCallback(async (req: CrossChainRequest): Promise<CrossChainResult | null> => {
    try {
      const res = await fetch('/api/tip/cross-chain', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...req, execute: true }),
      });
      const data = (await res.json()) as CrossChainResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Cross-chain tip failed');
      return data;
    } catch (err) {
      console.error('[useSmartTip] cross-chain send failed:', err);
      return null;
    }
  }, []);

  return {
    // Inherited from useTip
    state,
    resolveMethods,
    createTip,
    fetchLightningInvoice,
    setTipStatus,

    // Smart chain
    smartChains,
    chainLoading,
    availableChains,
    fetchSmartChains,

    // Cross-chain
    crossChainQuote,
    getCrossChainQuote,
    sendCrossChainTip,

    // Analytics
    analytics,
    fetchAnalytics,
  };
}
