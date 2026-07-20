'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';

// === Types ===============================================================

export type PremiumTier = 'basic' | 'pro' | 'platinum' | 'enterprise';

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

// === Tier config =========================================================

export interface TierConfig {
  id: PremiumTier;
  name: string;
  displayName: string;
  price: string;
  priceCents: number;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
  badge?: string;
}

export const TIERS: TierConfig[] = [
  {
    id: 'basic',
    name: 'Basic',
    displayName: 'Basic',
    price: '$0',
    priceCents: 0,
    description: 'Browse everything, join communities, tip creators — free forever.',
    features: [
      'Verified badge',
      'Post to 3 protocols',
      'Browse all content',
      'Join communities',
      'Tip creators (free)',
      'Basic profile',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    price: '$10/mo',
    priceCents: 1000,
    description: 'Full creator toolkit. Post everywhere, launch coins, livestream.',
    features: [
      'Everything in Basic',
      'Post to ALL 12+ protocols',
      'Creator coins (1 free, $20/ea)',
      'Live streaming (solo, spaces)',
      'Basic analytics',
      'Scheduled posts',
      'Feddy Communities (create 3)',
      'Token-gated content',
      'Custom profile',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    displayName: 'Platinum',
    price: '$25/mo',
    priceCents: 2500,
    description: 'Power user. Unlimited coins, advanced analytics, cross-network scheduling.',
    features: [
      'Everything in Pro',
      'UNLIMITED creator coins',
      'Multi-creator collab streams',
      'Advanced analytics dashboard',
      'Cross-network posting (X, YouTube, Reddit)',
      'Buffer-style scheduling (queue, calendar)',
      'Telegram/Discord community integration',
      'UNLIMITED Feddy Communities',
      'Custom community domain',
      'Priority support',
      'API access',
      'Early protocol access',
    ],
    cta: 'Go Platinum',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Enterprise',
    price: 'Custom',
    priceCents: 0,
    description: 'Self-host, white-label, dedicated infrastructure for organizations.',
    features: [
      'Everything in Platinum',
      'Self-host option',
      'White-label',
      'Custom protocol integrations',
      'Dedicated infrastructure',
      'SLA guarantee',
      'Team management',
      'SSO / SAML',
      'Custom contract & pricing',
    ],
    cta: 'Contact us',
    popular: false,
  },
];

// === Hook =================================================================

export function usePremium(): PremiumStatus & { refresh: () => Promise<void> } {
  const { walletAddress } = useAuth();
  const [status, setStatus] = useState<PremiumStatus>({
    tier: 'basic',
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
      setStatus((prev) => ({ ...prev, loading: false, tier: 'basic', isPremium: false }));
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
            tier: 'basic' as PremiumTier,
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

      const tier = (data.tier as PremiumTier) || 'basic';
      setStatus({
        tier,
        isPremium: tier !== 'basic',
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
