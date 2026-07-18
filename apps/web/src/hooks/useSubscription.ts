'use client';

import { useCallback } from 'react';
import { retryFetch } from '../lib/retryFetch';

export interface TierInfo {
  id: string;
  name: string;
  price: number;
  benefits: readonly string[];
}

export interface SubscriptionStatus {
  active: boolean;
  creator: string;
  subscription: {
    tier: string;
    amount: string;
    method: string;
    startDate: number;
    expiryDate: number;
  } | null;
  daysRemaining: number;
}

const BENEFIT_LABELS: Record<string, string> = {
  badge: 'Subscriber badge on DegenFeed',
  early_access: 'Early access to posts',
  exclusive_content: 'Exclusive subscriber-only content',
  discord: 'Discord role [COMING SOON]',
  '1on1': '1-on-1 access [COMING SOON]',
  voting: 'Voting on content [COMING SOON]',
};

export function formatBenefit(key: string): string {
  return BENEFIT_LABELS[key] ?? key;
}

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await retryFetch(url, {
    maxRetries: 2,
    fetchOptions: { credentials: 'include', ...options },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useSubscription() {
  const subscribeToCreator = useCallback(
    async (
      creator: string,
      creatorChain: string,
      tier: string,
      amount: number,
      method: string,
    ): Promise<{ success: boolean; nonce?: string; paymentIntent?: unknown; error?: string }> => {
      try {
        const res = await fetcher<{ success: boolean; nonce?: string; paymentIntent?: unknown }>(
          '/api/subscription/subscribe',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ creator, creatorChain, tier, amount: String(amount), method }),
          },
        );
        return { success: true, nonce: res.nonce, paymentIntent: res.paymentIntent };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [],
  );

  const confirmSubscription = useCallback(
    async (
      creator: string,
      txHash: string,
      nonce?: string,
    ): Promise<{ success: boolean; expiryDate?: number; error?: string }> => {
      try {
        const res = await fetcher<{ success: boolean; expiryDate?: number }>(
          '/api/subscription/confirm',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ creator, txHash, nonce }),
          },
        );
        return { success: true, expiryDate: res.expiryDate };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [],
  );

  const cancelSubscription = useCallback(
    async (creator: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await fetcher('/api/subscription/cancel', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ creator }),
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [],
  );

  const checkContentAccess = useCallback(
    async (creator: string): Promise<{ hasAccess: boolean; tier?: string }> => {
      try {
        const res = await fetcher<{ hasAccess: boolean; tier?: string }>(
          '/api/subscription/check-content',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ creator }),
          },
        );
        return { hasAccess: res.hasAccess, tier: res.tier };
      } catch {
        return { hasAccess: false };
      }
    },
    [],
  );

  const getSubscriptionStatus = useCallback(
    async (
      creator: string,
    ): Promise<{ active: boolean; subscription?: SubscriptionStatus['subscription']; daysRemaining?: number }> => {
      try {
        const res = await fetcher<SubscriptionStatus>(
          `/api/subscription/status?creator=${encodeURIComponent(creator)}`,
        );
        return {
          active: res.active,
          subscription: res.subscription,
          daysRemaining: res.daysRemaining,
        };
      } catch {
        return { active: false };
      }
    },
    [],
  );

  const getCreatorTiers = useCallback(
    async (creator: string): Promise<{ tiers: TierInfo[]; configured: boolean }> => {
      try {
        const res = await fetcher<{ tiers?: TierInfo[]; configured?: boolean }>(
          `/api/subscription/${encodeURIComponent(creator)}`,
        );
        return {
          tiers: res.tiers ?? [],
          configured: res.configured ?? false,
        };
      } catch {
        return { tiers: [], configured: false };
      }
    },
    [],
  );

  const setupCreatorTiers = useCallback(
    async (
      wallet: string,
      chain: string,
      tiers: string[],
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await fetcher('/api/subscription/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ wallet, chain, tiers }),
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [],
  );

  return {
    subscribeToCreator,
    confirmSubscription,
    cancelSubscription,
    checkContentAccess,
    getSubscriptionStatus,
    getCreatorTiers,
    setupCreatorTiers,
    formatBenefit,
  };
}
