'use client';

import { CrossPlatformSetup, type PlatformAccount } from '@degenfeed/ui';
import { useCallback, useState } from 'react';
import { usePremium } from '../../hooks/usePremium';
import { useAuth } from '../AuthProvider';
import { useToast } from '../Toast';
import { AccountsCredentialsDisplay } from './AccountsCredentialsDisplay';

interface SubscriptionSectionProps {
  showUpgradeModal: boolean;
  setShowUpgradeModal: (v: boolean) => void;
  refreshPremium: () => Promise<void>;
  crossPlatformKey: number;
  setCrossPlatformKey: (k: number) => void;
}

export function SubscriptionSection({
  showUpgradeModal,
  setShowUpgradeModal,
  refreshPremium,
  crossPlatformKey,
  setCrossPlatformKey,
}: SubscriptionSectionProps) {
  const { walletAddress } = useAuth();
  const { showToast } = useToast();
  const { tier: currentTier, isPremium, expiresAt, loading: premiumLoading } = usePremium();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCrossPlatformRegistered = useCallback(
    (result: PlatformAccount) => {
      const label = result.platform.charAt(0).toUpperCase() + result.platform.slice(1);
      showToast('success', `✓ Created @${result.username} on ${label}`);
      setCrossPlatformKey((k) => k + 1);
    },
    [showToast, setCrossPlatformKey],
  );

  const handleCancelSubscription = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Cancel failed');
      showToast('success', 'Subscription cancelled.');
      setShowCancelConfirm(false);
      await refreshPremium();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }, [showToast, refreshPremium]);

  const crossPlatformContent = (
    <CrossPlatformSetup
      key={crossPlatformKey}
      walletAddress={walletAddress ?? ''}
      isPremium={isPremium}
      onRegistered={handleCrossPlatformRegistered}
      onUpgrade={() => setShowUpgradeModal(true)}
    />
  );

  return (
    <div>
      <a
        href="/settings/subscription"
        className="mb-3 flex items-center gap-2 rounded-lg border border-degen-500/20 bg-degen-500/5 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/10 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13 12H3" />
        </svg>
        Manage subscription details →
      </a>

      {premiumLoading ? (
        <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-overlay)]" />
      ) : isPremium ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/20 text-lg">
              ⚡
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-degen-400 capitalize">{currentTier}</span>
                <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                  Active
                </span>
              </div>
              {expiresAt && (
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  Renews {new Date(expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="btn-primary text-xs"
            >
              Change plan
            </button>
          </div>

          {!showCancelConfirm ? (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Cancel subscription
            </button>
          ) : (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
              <p className="text-xs text-red-400 font-medium">Are you sure?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  className="flex-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  Keep subscription
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--color-glass-border)] pt-4">
            <h4 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              Cross-Platform Accounts
            </h4>
            {crossPlatformContent}
            <div className="mt-6 border-t border-[var(--color-glass-border)] pt-4">
              <h4 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                Your Portable Credentials
              </h4>
              <AccountsCredentialsDisplay walletAddress={walletAddress} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
            <div className="text-xs font-medium text-[var(--color-fg)] mb-1">Free Plan</div>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              Upgrade to Pro for unlimited feeds, analytics, scheduling, and cross-platform
              registration.
            </p>
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="btn-primary text-xs"
            >
              Upgrade to Pro — $10 first month
            </button>
          </div>
          <div className="border-t border-[var(--color-glass-border)] pt-4">
            <h4 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              Cross-Platform Accounts
            </h4>
            {crossPlatformContent}
          </div>
        </div>
      )}
    </div>
  );
}
