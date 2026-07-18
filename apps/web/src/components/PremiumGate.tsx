'use client';

/**
 * PremiumGate — wraps premium features with an upgrade prompt
 *
 * Usage:
 *   <PremiumGate requiredTier="pro" feature="Cross-post">
 *     <YourPremiumFeature />
 *   </PremiumGate>
 */

import { useState } from 'react';
import { type PremiumTier, usePremium } from '../hooks/usePremium';
import { PremiumPaymentModal } from './PremiumPaymentModal';

interface PremiumGateProps {
  /** Minimum tier required to access children */
  requiredTier: PremiumTier;
  /** Human-readable feature name shown in upgrade prompt */
  feature: string;
  /** Detailed description of why the upgrade is needed */
  description?: string;
  /** Children to render when access is granted */
  children: React.ReactNode;
  /** Optional icon to show (emoji) */
  icon?: string;
}

export function PremiumGate({
  requiredTier,
  feature,
  description,
  children,
  icon = '⭐',
}: PremiumGateProps) {
  const { tier, loading } = usePremium();
  const [showModal, setShowModal] = useState(false);

  const tierRank: Record<PremiumTier, number> = {
    free: 0,
    pro: 1,
    creator: 2,
    enterprise: 3,
  };

  const hasAccess = tierRank[tier] >= tierRank[requiredTier];

  if (loading) {
    return (
      <div className="relative" aria-busy="true">
        <div className="pointer-events-none select-none blur-sm">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--color-muted)]/30" />
        </div>
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  const tierNames: Record<PremiumTier, string> = {
    free: 'Free',
    pro: 'Pro',
    creator: 'Creator',
    enterprise: 'Enterprise',
  };

  const tierPricing: Record<PremiumTier, string> = {
    free: '$0',
    pro: '$10 first month, then $5/mo',
    creator: '$15/mo',
    enterprise: 'Custom',
  };

  return (
    <>
      <div className="relative group">
        <div className="pointer-events-none select-none blur-sm opacity-40">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-degen-500/20 bg-[var(--color-card)]/95 backdrop-blur-sm p-5 text-center mx-4 max-w-xs shadow-xl">
            <div className="mb-2 text-2xl">{icon}</div>
            <h3 className="text-sm font-bold text-[var(--color-fg)] mb-1">
              {feature} — Pro feature
            </h3>
            <p className="text-xs text-[var(--color-muted)] mb-3 leading-relaxed">
              {description ?? `Upgrade to ${tierNames[requiredTier]} to unlock ${feature}.`}
            </p>
            <p className="text-[10px] text-amber-400 mb-3">{tierPricing[requiredTier]}</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="w-full rounded-lg bg-degen-500 px-4 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-colors"
            >
              Upgrade to {tierNames[requiredTier]}
            </button>
          </div>
        </div>
      </div>

      <PremiumPaymentModal
        open={showModal}
        onClose={() => setShowModal(false)}
        initialTier={requiredTier}
      />
    </>
  );
}
