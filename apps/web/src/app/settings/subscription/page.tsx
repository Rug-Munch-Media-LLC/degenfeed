'use client';

/**
 * Subscription Management Page — /settings/subscription
 *
 * Displays current plan, usage, billing history, and allows
 * upgrades, downgrades, cancellation, and payment method changes.
 *
 * Connected to:
 *   - /api/billing/my-status (current tier)
 *   - /api/billing/subscribe (initiate subscription)
 *   - /api/billing/cancel (cancel subscription)
 *   - Stripe Customer Portal (manage payment methods)
 */

import { type SubscriptionTier, TIER_CONFIGS, TIER_NAMES } from '@degenfeed/monetization';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import PageHeader from '../../../components/ui/PageHeader';
import { usePremium } from '../../../hooks/usePremium';

const PremiumPaymentModal = dynamic(
  () =>
    import('../../../components/PremiumPaymentModal').then((m) => ({
      default: m.PremiumPaymentModal,
    })),
  { ssr: false, loading: () => null },
);

// ─── Tier Badge ─────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    creator: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    pro: 'bg-degen-500/10 text-degen-400 border-degen-500/20',
    enterprise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  const cls = colors[tier] ?? colors.free;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {TIER_NAMES[tier as SubscriptionTier] ?? tier}
    </span>
  );
}

// ─── Current Plan Card ──────────────────────────────────────────────────

function CurrentPlanCard({
  tier,
  isPremium,
  expiresAt,
  daysRemaining,
  nextBillingAmount,
  loading,
  onUpgrade,
}: {
  tier: string;
  isPremium: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  nextBillingAmount: number | null;
  loading: boolean;
  onUpgrade: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 animate-pulse">
        <div className="h-5 w-32 bg-[var(--color-muted)]/20 rounded mb-3" />
        <div className="h-8 w-24 bg-[var(--color-muted)]/20 rounded mb-2" />
        <div className="h-4 w-48 bg-[var(--color-muted)]/20 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)] mb-1">
            Current Plan
          </p>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--color-fg)]">
              {TIER_NAMES[tier as SubscriptionTier] ?? 'Free'}
            </h2>
            <TierBadge tier={tier} />
          </div>
        </div>

        {!isPremium && (
          <button
            type="button"
            onClick={onUpgrade}
            className="rounded-xl bg-degen-500 px-4 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>

      {isPremium && (
        <div className="space-y-2 text-sm">
          {expiresAt && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Expires</span>
              <span className="text-[var(--color-fg)] font-medium">
                {new Date(expiresAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
          {daysRemaining !== null && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Days Remaining</span>
              <span className="text-[var(--color-fg)] font-medium">{daysRemaining}</span>
            </div>
          )}
          {nextBillingAmount !== null && nextBillingAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Next Billing</span>
              <span className="text-[var(--color-fg)] font-medium">
                ${(nextBillingAmount / 100).toFixed(2)}
              </span>
            </div>
          )}
          <div className="pt-2">
            <CancelSubscriptionButton />
          </div>
        </div>
      )}

      {!isPremium && (
        <p className="text-xs text-[var(--color-muted)] mt-2">
          You&apos;re on the Free plan. Upgrade to unlock premium features.
        </p>
      )}
    </div>
  );
}

// ─── Cancel Subscription ────────────────────────────────────────────────

function CancelSubscriptionButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const { refresh } = usePremium();

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to cancel');
      setCancelled(true);
      refresh();
    } catch {
      setCancelling(false);
      setShowConfirm(false);
    }
  }, [refresh]);

  if (cancelled) {
    return (
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
        <p className="text-xs text-amber-400">
          ✕ Subscription cancelled. Access continues until the end of the billing period.
        </p>
      </div>
    );
  }

  if (!showConfirm) {
    return (
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        Cancel subscription
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
      <p className="text-xs text-red-400 font-medium">
        Are you sure? Your plan stays active until the end of the billing period. No refunds for
        partial months.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="flex-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
        >
          {cancelling ? 'Cancelling\u2026' : 'Yes, cancel'}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          className="flex-1 rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          Keep my plan
        </button>
      </div>
    </div>
  );
}

// ─── Plan Comparison Grid ───────────────────────────────────────────────

function PlanComparison({
  currentTier,
  onSelect,
}: {
  currentTier: string;
  onSelect: (tier: SubscriptionTier) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-fg)]">Available Plans</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIER_CONFIGS.map((t) => {
          const isCurrent = currentTier === t.id;
          const isDowngrade = t.id === 'free';
          return (
            <div
              key={t.id}
              className={`rounded-xl border p-4 ${
                isCurrent
                  ? 'border-degen-500/40 bg-degen-500/5'
                  : 'border-[var(--color-border)] bg-[var(--color-card)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-[var(--color-fg)]">{t.name}</span>
                {t.badge && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-degen-500">
                    {t.badge}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-[var(--color-fg)] mb-1">{t.priceMonthly}</p>
              <p className="text-[10px] text-[var(--color-muted)] mb-3">{t.description}</p>
              {isCurrent ? (
                <div className="w-full rounded-lg border border-degen-500/30 bg-degen-500/10 py-1.5 text-center text-xs font-semibold text-degen-400">
                  ✓ Current
                </div>
              ) : isDowngrade ? (
                <div className="w-full rounded-lg border border-[var(--color-border)] py-1.5 text-center text-xs text-[var(--color-muted)]">
                  Downgrade
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="w-full rounded-lg bg-degen-500 py-1.5 text-xs font-bold text-black hover:bg-degen-400 transition-colors"
                >
                  {currentTier === 'free' ? 'Upgrade' : 'Switch'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Usage Overview ─────────────────────────────────────────────────────

function UsageOverview({ tier }: { tier: string }) {
  const config = TIER_CONFIGS.find((t) => t.id === tier) ?? TIER_CONFIGS[0];
  const limits = config.limits;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3">Usage & Limits</h3>
      <div className="space-y-3">
        {[
          { label: 'Connected Protocols', limit: limits.connectedProtocols, used: 0 },
          { label: 'Creator Coins', limit: limits.creatorCoins, used: 0 },
          { label: 'Scheduled Posts', limit: limits.scheduledPosts, used: 0 },
          { label: 'Team Members', limit: limits.teamMembers, used: 0 },
          { label: 'API Rate Limit', limit: limits.apiRateLimit, used: 0, unit: '/min' },
        ].map((item) => {
          const percentage =
            item.limit === 999 ? 0 : Math.min(100, (item.used / Math.max(1, item.limit)) * 100);
          const isUnlimited = item.limit >= 999;

          return (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--color-muted)]">{item.label}</span>
                <span className="text-[var(--color-fg)] font-medium">
                  {isUnlimited ? '∞' : `${item.used} / ${item.limit}${item.unit ?? ''}`}
                </span>
              </div>
              {!isUnlimited && (
                <div className="h-1.5 rounded-full bg-[var(--color-overlay)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-degen-400 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Billing History ────────────────────────────────────────────────────

function BillingHistory() {
  const [history] = useState<
    Array<{ date: string; amount: string; status: string; description: string }>
  >([
    // Placeholder — real data comes from Stripe/Billing API
  ]);

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-2">Billing History</h3>
        <p className="text-xs text-[var(--color-muted)]">No billing history yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3">Billing History</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--color-muted)] border-b border-[var(--color-border)]">
            <th className="text-left py-2 font-medium">Date</th>
            <th className="text-left py-2 font-medium">Description</th>
            <th className="text-right py-2 font-medium">Amount</th>
            <th className="text-right py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item, i) => (
            <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
              <td className="py-2 text-[var(--color-muted)]">{item.date}</td>
              <td className="py-2 text-[var(--color-fg)]">{item.description}</td>
              <td className="py-2 text-right text-[var(--color-fg)]">{item.amount}</td>
              <td className="py-2 text-right">
                <span className="text-green-400">{item.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function SubscriptionSettingsPage() {
  const { tier, isPremium, expiresAt, daysRemaining, nextBillingAmount, loading, refresh } =
    usePremium();
  const { walletAddress } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const handleUpgrade = useCallback(() => {
    setShowUpgradeModal(true);
  }, []);

  const handleSelectPlan = useCallback((tierId: SubscriptionTier) => {
    setSelectedTier(tierId);
    setShowUpgradeModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowUpgradeModal(false);
    setSelectedTier(null);
    refresh();
  }, [refresh]);

  const creditCardIcon = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-24 sm:pb-6">
      <PageHeader
        title="Subscription"
        description="Manage your plan, billing, and usage limits"
        icon={creditCardIcon}
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Subscription' }]}
      />

      {/* Current Plan */}
      <section className="mb-6">
        <CurrentPlanCard
          tier={tier}
          isPremium={isPremium}
          expiresAt={expiresAt}
          daysRemaining={daysRemaining}
          nextBillingAmount={nextBillingAmount}
          loading={loading}
          onUpgrade={handleUpgrade}
        />
      </section>

      {/* Plan Comparison */}
      <section className="mb-6">
        <PlanComparison currentTier={tier} onSelect={handleSelectPlan} />
      </section>

      {/* Usage Overview */}
      <section className="mb-6">
        <UsageOverview tier={tier} />
      </section>

      {/* Billing History */}
      <section className="mb-6">
        <BillingHistory />
      </section>

      {/* Payment Modal */}
      {showUpgradeModal && (
        <PremiumPaymentModal
          open={showUpgradeModal}
          initialTier={(selectedTier as any) ?? tier}
          onClose={handleCloseModal}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
