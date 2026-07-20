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
    id: 'free',
    name: 'Free',
    displayName: 'Free',
    price: '$0',
    priceCents: 0,
    description: 'Browse everything, join communities, and tip across protocols.',
    features: [
      'Browse all protocols',
      'Post to 3 protocols',
      'Join Feddy Communities',
      'Comment, like, repost everywhere',
      'Cross-protocol tipping',
      'GoToSocial (Fediverse) account',
      'AT Protocol / Bluesky account',
      'Nostr keypair',
      'RSS feed',
      'Read-only creator coin access',
      'Tip widget embedding',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Premium',
    displayName: 'Premium',
    price: '$10/mo',
    priceCents: 1000,
    description: 'Full cross-protocol power. Post everywhere, launch coins, livestream.',
    features: [
      'Everything in Free',
      'Post to ALL 12 protocols',
      'Launch Creator Coins (Base + Solana)',
      'Create Feddy Communities',
      'Customizable vesting schedules',
      'Revenue sharing (multiple recipients)',
      'PeerTube livestreaming',
      'Community analytics',
      'Scheduled posts',
      'NFT gallery on profile',
      'Ad-free experience',
      'Priority support',
    ],
    cta: 'Upgrade to Premium',
    popular: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'creator',
    name: 'Creator',
    displayName: 'Creator',
    price: '$25/mo',
    priceCents: 2500,
    description: 'Build your brand. Custom domains, analytics, API access, and team tools.',
    features: [
      'Everything in Premium',
      'Custom community domain (degenfeed.xyz)',
      'Advanced analytics dashboard',
      'API access (bots & apps)',
      'Up to 10 communities',
      'Custom branding on community page',
      'Team management (add moderators)',
      'Data export (GDPR-ready)',
      'Early access to new protocols',
    ],
    cta: 'Go Creator',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Enterprise',
    price: 'Custom',
    priceCents: 0,
    description: 'White-label, API access, and custom infrastructure for organizations.',
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
