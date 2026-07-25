'use client';

/**
 * @degenfeed/web — Membership hook
 *
 * Connects to /api/membership/* for tier management.
 * Provides tier status, feature list, upgrade flow.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';

// ─── Types ─────────────────────────────────────────────────────────────────

export type Tier = 'free' | 'pro' | 'creator' | 'enterprise';

export interface TierInfo {
  id: Tier;
  name: string;
  price: number;
  annualPrice: number;
  description: string;
  badge?: string;
}

export interface FeatureItem {
  key: string;
  label: string;
  description: string;
  minTier: string;
  unlocked: boolean;
}

export interface FeatureGroup {
  category: string;
  features: FeatureItem[];
}

export interface TierLimits {
  protocols: number;
  scheduledPosts: number;
  creatorCoins: number;
  teamMembers: number;
  newsletterSubscribers: number;
}

export interface MembershipStatus {
  tier: Tier;
  tierInfo: TierInfo;
  isPremium: boolean;
  status: 'active' | 'cancelled' | 'expired';
  expiresAt: string | null;
  activatedAt: string | null;
  autoRenew: boolean;
  billingMethod: string;
  limits: TierLimits;
  canUpgrade: boolean;
  nextTier: { tier: Tier; info: TierInfo } | null;
  loading: boolean;
  error: string | null;
}

export interface MembershipFeatures {
  tier: Tier;
  tierInfo: TierInfo;
  features: FeatureGroup[];
  unlockedCount: number;
  totalCount: number;
  lockedCount: number;
  lockedFeatures: Array<{
    key: string;
    label: string;
    minTier: string;
    upgradeTo: { tier: Tier; info: TierInfo } | null;
  }>;
}

export interface PaymentRecord {
  txHash: string;
  amount: number;
  currency: string;
  timestamp: number;
  tier: string;
  period: 'monthly' | 'annual';
  status: 'confirmed' | 'pending' | 'failed';
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useMembership() {
  const { session, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<MembershipStatus>({
    tier: 'free',
    tierInfo: {} as TierInfo,
    isPremium: false,
    status: 'active',
    expiresAt: null,
    activatedAt: null,
    autoRenew: false,
    billingMethod: 'none',
    limits: {} as TierLimits,
    canUpgrade: true,
    nextTier: null,
    loading: true,
    error: null,
  });
  const [features, setFeatures] = useState<MembershipFeatures | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);

  const fetchTier = useCallback(async () => {
    if (!isAuthenticated || !session?.address) {
      setStatus((s) => ({ ...s, loading: false }));
      return;
    }

    try {
      const res = await fetch('/api/membership/tier');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus({
        ...data,
        loading: false,
        error: null,
      });
    } catch (err) {
      setStatus((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch tier',
      }));
    }
  }, [isAuthenticated, session?.address]);

  const fetchFeatures = useCallback(async () => {
    if (!isAuthenticated || !session?.address) return;

    try {
      const res = await fetch('/api/membership/features');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFeatures(data);
    } catch {
      // Silently fail — features are optional display
    }
  }, [isAuthenticated, session?.address]);

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated || !session?.address) return;

    try {
      const res = await fetch('/api/membership/history');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPaymentHistory(data.payments ?? []);
    } catch {
      // Silently fail
    }
  }, [isAuthenticated, session?.address]);

  const upgrade = useCallback(
    async (targetTier: Tier, txHash?: string, period: 'monthly' | 'annual' = 'monthly') => {
      if (!session?.address) throw new Error('Not authenticated');

      const res = await fetch('/api/membership/upgrade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier: targetTier, txHash, period }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upgrade failed');

      // Refresh tier status
      await fetchTier();
      return data;
    },
    [session?.address, fetchTier],
  );

  const cancel = useCallback(async () => {
    if (!session?.address) throw new Error('Not authenticated');

    const res = await fetch('/api/membership/cancel', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Cancel failed');

    await fetchTier();
    return data;
  }, [session?.address, fetchTier]);

  useEffect(() => {
    fetchTier();
    fetchFeatures();
    fetchHistory();
  }, [fetchTier, fetchFeatures, fetchHistory]);

  return {
    status,
    features,
    paymentHistory,
    fetchTier,
    fetchFeatures,
    fetchHistory,
    upgrade,
    cancel,
  };
}

// ─── Tier Config (Client-side fallback) ───────────────────────────────────

export const TIER_CONFIGS: Record<
  Tier,
  { name: string; price: string; annualPrice: string; description: string; color: string }
> = {
  free: {
    name: 'Free',
    price: '$0',
    annualPrice: '$0',
    description: 'Browse everything. Connect 1 protocol. Start exploring.',
    color: 'from-gray-500/10 to-transparent',
  },
  pro: {
    name: 'Pro',
    price: '$5',
    annualPrice: '$4',
    description: 'Unlock all protocols, cross-network messaging, and verification badge.',
    color: 'from-blue-500/[0.07] to-transparent',
  },
  creator: {
    name: 'Creator',
    price: '$10',
    annualPrice: '$8',
    description: 'Launch creator coins, unlimited scheduling, full analytics, newsletters.',
    color: 'from-amber-500/[0.07] to-transparent',
  },
  enterprise: {
    name: 'Enterprise',
    price: '$20',
    annualPrice: '$16',
    description: 'Self-host, white-label, API access, team accounts, priority support.',
    color: 'from-purple-500/[0.07] to-transparent',
  },
};
