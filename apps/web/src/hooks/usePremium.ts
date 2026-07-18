'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';

// ─── Types ───────────────────────────────────────────────────────────────

export type PremiumTier = 'free' | 'pro' | 'creator' | 'enterprise';

export interface PremiumStatus {
  tier: PremiumTier;
  isPremium: boolean;
  expiresAt: string | null;
  /** Whether the first-month promo period is active */
  firstMonthPromo: boolean;
  /** Next billing amount in USD cents */
  nextBillingAmount: number | null;
  /** Days remaining in current billing period */
  daysRemaining: number | null;
  loading: boolean;
  error: string | null;
}

// ─── Tier config ─────────────────────────────────────────────────────────

export interface TierConfig {
  id: PremiumTier;
  name: string;
  price: string;
  priceCents: number;
  /** First-month price shown separately */
  firstMonthPrice?: string;
  firstMonthCents?: number;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
  badge?: string;
}

export const TIERS: TierConfig[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceCents: 0,
    description: 'Browse all feeds forever. No account needed.',
    features: [
      'Browse all ranked feeds',
      'Public likes and replies',
      'Basic search',
      '2 custom feeds',
      'Basic tipping',
      'Wallet sign-in (ETH + SOL)',
    ],
    cta: 'Current plan',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$5/mo',
    priceCents: 500,
    firstMonthPrice: '$10',
    firstMonthCents: 1000,
    description: 'Power-user tools for the open social graph.',
    features: [
      'Everything in Free',
      'Unlimited custom feeds',
      'Cross-platform registration (Farcaster included)',
      'Advanced analytics dashboard',
      'Post scheduling',
      'Bookmark sync across devices',
      'Priority support',
    ],
    cta: 'Subscribe',
    popular: true,
    badge: 'RECOMMENDED',
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '$15/mo',
    priceCents: 1500,
    description: 'Monetize and grow your audience across protocols.',
    features: [
      'Everything in Pro',
      'Paywalled premium posts (x402)',
      'Advanced cross-protocol analytics',
      'Token-gated content',
      'Custom domain support',
      'Verified creator badge',
      'Early access to new features',
    ],
    cta: 'Become a Creator',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$50/mo',
    priceCents: 5000,
    description: 'White-label, API access, and custom infrastructure.',
    features: [
      'Everything in Creator',
      'White-label embeddable feed',
      'API access with SLA and rate limits',
      'Custom domains and branding',
      'Dedicated support channel',
      'Team seats (up to 10)',
      'Self-hosted deployment support',
    ],
    cta: 'Contact us',
    popular: false,
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────────

export function usePremium(): PremiumStatus & { refresh: () => Promise<void> } {
  const { walletAddress } = useAuth();
  const [status, setStatus] = useState<PremiumStatus>({
    tier: 'free',
    isPremium: false,
    expiresAt: null,
    firstMonthPromo: false,
    nextBillingAmount: null,
    daysRemaining: null,
    loading: true,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    if (!walletAddress) {
      setStatus((prev) => ({ ...prev, loading: false, tier: 'free', isPremium: false }));
      return;
    }

    try {
      const res = await fetch('/api/billing/my-status', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        if (res.status === 404 || res.status === 401) {
          setStatus((prev) => ({
            ...prev,
            loading: false,
            tier: 'free' as PremiumTier,
            isPremium: false,
            error: null,
          }));
          return;
        }
        throw new Error(`Subscription API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        tier?: string;
        expiresAt?: string;
        firstMonthPromo?: boolean;
        nextBillingAmount?: number;
        daysRemaining?: number;
      };

      const tier = (data.tier as PremiumTier) || 'free';
      setStatus({
        tier,
        isPremium: tier !== 'free',
        expiresAt: data.expiresAt ?? null,
        firstMonthPromo: data.firstMonthPromo ?? false,
        nextBillingAmount: data.nextBillingAmount ?? null,
        daysRemaining: data.daysRemaining ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load subscription',
      }));
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { ...status, refresh: fetchStatus };
}
