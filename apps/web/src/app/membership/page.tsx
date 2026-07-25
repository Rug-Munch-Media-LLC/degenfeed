'use client';

/**
 * @degenfeed/web — Membership page
 *
 * Shows current tier, feature comparison table, upgrade flow.
 * Free → Pro ($5) → Creator ($10) → Enterprise ($20)
 */

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { TIER_CONFIGS, type Tier, useMembership } from '../../hooks/useMembership';

// ─── Types ─────────────────────────────────────────────────────────────────

const TIER_ORDER: Tier[] = ['free', 'pro', 'creator', 'enterprise'];

// ─── Icons ─────────────────────────────────────────────────────────────────

function CheckIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={muted ? 'text-[var(--color-muted)]/40' : 'text-green-400'}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-[var(--color-muted)]/30"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-amber-400"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ─── Feature value cell ────────────────────────────────────────────────────

function ValueCell({ val }: { val: boolean | string }) {
  if (val === true) return <CheckIcon />;
  if (val === false) return <DashIcon />;
  return <span className="text-[10px] font-semibold text-green-400">{val}</span>;
}

// ─── Feature data ─────────────────────────────────────────────────────────

interface FeatureRow {
  category?: string;
  name: string;
  free: boolean | string;
  pro: boolean | string;
  creator: boolean | string;
  enterprise: boolean | string;
}

const FEATURE_TABLE: FeatureRow[] = [
  {
    category: 'Core',
    name: 'Browse all public feeds',
    free: true,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: 'Connect 1 protocol identity', free: true, pro: true, creator: true, enterprise: true },
  {
    name: 'Connect ALL protocol identities',
    free: false,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: 'Profile verification badge', free: false, pro: true, creator: true, enterprise: true },

  {
    category: 'Publishing',
    name: 'Basic posts on 3 protocols',
    free: true,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: 'Cross-post to 10 protocols', free: false, pro: true, creator: true, enterprise: true },
  {
    name: 'Cross-post to ALL protocols (unlimited)',
    free: false,
    pro: false,
    creator: true,
    enterprise: true,
  },
  {
    name: 'External platforms (LinkedIn, Facebook, X)',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },

  {
    category: 'Scheduling',
    name: '10 scheduled posts',
    free: true,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: '100 scheduled posts', free: false, pro: true, creator: true, enterprise: true },
  {
    name: 'Unlimited scheduled posts + Buffer calendar',
    free: false,
    pro: false,
    creator: true,
    enterprise: true,
  },
  { name: 'AI-optimized posting times', free: false, pro: false, creator: true, enterprise: true },

  {
    category: 'Monetization',
    name: 'Creator coin creation',
    free: false,
    pro: false,
    creator: true,
    enterprise: true,
  },
  { name: 'Newsletter creation', free: false, pro: false, creator: true, enterprise: true },
  { name: 'Newsletter monetization', free: false, pro: false, creator: true, enterprise: true },
  { name: 'Revenue tracking dashboard', free: false, pro: false, creator: true, enterprise: true },

  {
    category: 'Messaging',
    name: 'Cross-network messaging (DMs)',
    free: false,
    pro: true,
    creator: true,
    enterprise: true,
  },

  {
    category: 'Analytics',
    name: 'Basic analytics',
    free: true,
    pro: true,
    creator: true,
    enterprise: true,
  },
  { name: 'Full analytics suite', free: false, pro: false, creator: true, enterprise: true },
  { name: 'Creator dashboard', free: false, pro: false, creator: true, enterprise: true },
  {
    name: 'White-label analytics reports',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },

  {
    category: 'Enterprise',
    name: 'Self-hosted creator page (custom domain)',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },
  { name: 'API access', free: false, pro: false, creator: false, enterprise: true },
  { name: 'Team accounts (up to 5)', free: false, pro: false, creator: false, enterprise: true },
  {
    name: 'Priority support (4h response)',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },
  {
    name: 'Early access to new features',
    free: false,
    pro: false,
    creator: false,
    enterprise: true,
  },
];

// ─── Pricing Card ──────────────────────────────────────────────────────────

function PricingCard({
  tier,
  currentTier,
  onUpgrade,
}: {
  tier: Tier;
  currentTier: string;
  onUpgrade: (tier: Tier) => void;
}) {
  const config = TIER_CONFIGS[tier];
  const isCurrent = currentTier === tier;
  const isUpgrade = TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(currentTier as Tier);
  const isPopular = tier === 'creator' || tier === 'pro';

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
        isCurrent
          ? 'border-green-500/40 bg-gradient-to-b from-green-500/[0.06] to-transparent shadow-[0_0_40px_-8px_rgba(34,197,94,0.12)]'
          : isPopular
            ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/[0.06] to-transparent shadow-[0_0_40px_-8px_rgba(245,158,11,0.12)]'
            : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-amber-500/20'
      }`}
    >
      {/* Current badge */}
      {isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-green-500 px-3 py-0.5 text-[10px] font-bold text-black shadow-lg">
          CURRENT PLAN
        </div>
      )}

      {/* Popular badge */}
      {isPopular && !isCurrent && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-0.5 text-[10px] font-bold text-black shadow-lg">
          POPULAR
        </div>
      )}

      <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        {config.name}
      </div>

      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-4xl font-black tracking-tight ${
            isCurrent ? 'text-green-400' : isPopular ? 'text-amber-400' : 'text-[var(--color-fg)]'
          }`}
        >
          {config.price}
        </span>
        {tier !== 'free' && <span className="text-xs text-[var(--color-muted)]">/mo</span>}
        {tier === 'free' && (
          <span className="text-xs text-green-400 ml-1 font-medium">Forever</span>
        )}
      </div>

      {tier !== 'free' && (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            ~
            {Math.round(
              (1 -
                Number(config.price.replace('$', '')) /
                  Number(config.annualPrice.replace('$', ''))) *
                100,
            )}
            % off
          </span>
          <span className="text-[10px] text-[var(--color-muted)] line-through">
            {config.annualPrice}/mo annual
          </span>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">{config.description}</p>

      <div className="mt-5 mb-5">
        {isCurrent ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-green-500/30 bg-green-500/10 py-2.5 text-sm font-bold text-green-400">
            <CheckIcon />
            Active
          </div>
        ) : tier === 'free' ? (
          <Link
            href="/feed"
            className="flex w-full items-center justify-center rounded-xl border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] py-2.5 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-amber-500/30"
          >
            Get Started Free
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onUpgrade(tier)}
            className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all ${
              isPopular
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:shadow-[0_0_24px_rgba(245,158,11,0.35)]'
                : 'border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] text-[var(--color-fg)] hover:border-amber-500/30'
            }`}
          >
            {isUpgrade ? 'Upgrade' : 'Downgrade'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Comparison Table ──────────────────────────────────────────────────────

function ComparisonTable({ currentTier }: { currentTier: string }) {
  const groups: { category: string; rows: FeatureRow[] }[] = [];
  let currentGroup: { category: string; rows: FeatureRow[] } | null = null;

  for (const row of FEATURE_TABLE) {
    if (row.category) {
      currentGroup = { category: row.category, rows: [] };
      groups.push(currentGroup);
    }
    if (currentGroup) currentGroup.rows.push(row);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)]">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-[var(--color-glass-border)]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Feature
            </th>
            {TIER_ORDER.map((tier) => {
              const isCurrent = currentTier === tier;
              return (
                <th
                  key={tier}
                  className={`px-4 py-3 text-center text-xs font-semibold ${
                    isCurrent ? 'text-green-400' : 'text-[var(--color-muted)]'
                  }`}
                >
                  {TIER_CONFIGS[tier].name}
                  {isCurrent && <span className="ml-1 text-[10px]">✓</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.category}>
              <td
                colSpan={5}
                className="bg-[var(--color-overlay)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]"
              >
                {group.category}
              </td>
            </tr>
          ))}
          {groups.flatMap((group) =>
            group.rows.map((row) => (
              <tr
                key={row.name}
                className="border-b border-[var(--color-glass-border)] last:border-0"
              >
                <td className="px-4 py-2.5 text-xs text-[var(--color-fg)]">{row.name}</td>
                {TIER_ORDER.map((tier) => (
                  <td key={tier} className="px-4 py-2.5 text-center">
                    <div className="flex justify-center">
                      <ValueCell val={row[tier]} />
                    </div>
                  </td>
                ))}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Upgrade Modal ─────────────────────────────────────────────────────────

function UpgradeModal({
  tier,
  onClose,
  onConfirm,
  loading,
}: {
  tier: Tier;
  onClose: () => void;
  onConfirm: (tier: Tier, period: 'monthly' | 'annual') => void;
  loading: boolean;
}) {
  const config = TIER_CONFIGS[tier];
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-[var(--color-fg)] mb-1">Upgrade to {config.name}</h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">{config.description}</p>

        {/* Period toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
              period === 'monthly'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-[var(--color-overlay)] text-[var(--color-muted)] border border-transparent'
            }`}
          >
            Monthly
            <div className="text-lg font-black">{config.price}/mo</div>
          </button>
          <button
            type="button"
            onClick={() => setPeriod('annual')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
              period === 'annual'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-[var(--color-overlay)] text-[var(--color-muted)] border border-transparent'
            }`}
          >
            Annual
            <div className="text-lg font-black">{config.annualPrice}/mo</div>
            <div className="text-[10px] text-green-400">Save ~20%</div>
          </button>
        </div>

        {/* Payment options */}
        <div className="space-y-2 mb-4">
          <button
            type="button"
            onClick={() => onConfirm(tier, period)}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3 text-sm font-bold text-black transition-all hover:shadow-[0_0_24px_rgba(245,158,11,0.35)] disabled:opacity-50"
          >
            {loading
              ? 'Processing...'
              : `Pay with Crypto • ${period === 'monthly' ? config.price : config.annualPrice}/mo`}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(tier, period)}
            disabled={loading}
            className="w-full rounded-xl border-2 border-[var(--color-glass-border)] py-3 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-amber-500/30 disabled:opacity-50"
          >
            Pay with Card
          </button>
        </div>

        <p className="text-[10px] text-center text-[var(--color-muted)]">
          Your plan starts immediately. Cancel anytime. No questions asked.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Current Tier Banner ───────────────────────────────────────────────────

function CurrentTierBanner({
  tier,
  name,
  isPremium,
  expiresAt,
}: {
  tier: string;
  name: string;
  isPremium: boolean;
  expiresAt: string | null;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isPremium
          ? 'border-green-500/20 bg-green-500/5'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isPremium
              ? 'bg-green-500/15 text-green-400'
              : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
          }`}
        >
          {isPremium ? <CheckIcon /> : <LockIcon />}
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--color-fg)]">
            {isPremium ? `${name} Plan` : 'Free Tier'}
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            {isPremium
              ? expiresAt
                ? `Active until ${new Date(expiresAt).toLocaleDateString()}`
                : 'Lifetime access'
              : 'Explore all features. Upgrade anytime.'}
          </div>
        </div>
        {isPremium && (
          <span className="ml-auto rounded-full bg-green-500/15 px-3 py-1 text-[10px] font-semibold text-green-400">
            Active
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Unlock Prompts ────────────────────────────────────────────────────────

function UnlockPrompts({
  currentTier,
  onUpgrade,
}: {
  currentTier: string;
  onUpgrade: (tier: Tier) => void;
}) {
  const prompts: { feature: string; requiredTier: Tier; description: string }[] = [];

  if (currentTier === 'free') {
    prompts.push(
      {
        feature: 'Cross-network Messaging',
        requiredTier: 'pro',
        description: 'Send DMs across Farcaster, Lens, Bluesky, and more.',
      },
      {
        feature: 'Profile Verification Badge',
        requiredTier: 'pro',
        description: 'Get the verified checkmark on your profile.',
      },
      {
        feature: 'All Protocol Identities',
        requiredTier: 'pro',
        description: 'Connect unlimited protocol accounts.',
      },
    );
  }

  if (currentTier === 'free' || currentTier === 'pro') {
    prompts.push(
      {
        feature: 'Creator Coin Launch',
        requiredTier: 'creator',
        description: 'Deploy your own token on Base or Solana.',
      },
      {
        feature: 'Unlimited Scheduling',
        requiredTier: 'creator',
        description: 'Buffer-style calendar with AI-optimized times.',
      },
      {
        feature: 'Newsletter Monetization',
        requiredTier: 'creator',
        description: 'Create and monetize your newsletter.',
      },
      {
        feature: 'Full Analytics Suite',
        requiredTier: 'creator',
        description: 'Advanced engagement and audience metrics.',
      },
    );
  }

  if (currentTier === 'free' || currentTier === 'pro' || currentTier === 'creator') {
    prompts.push(
      {
        feature: 'Self-Hosted Creator Page',
        requiredTier: 'enterprise',
        description: 'Deploy on your custom domain.',
      },
      {
        feature: 'API Access',
        requiredTier: 'enterprise',
        description: 'Programmatic access to the DegenFeed API.',
      },
      {
        feature: 'Team Accounts',
        requiredTier: 'enterprise',
        description: 'Add up to 5 team members.',
      },
      {
        feature: 'External Platform Posting',
        requiredTier: 'enterprise',
        description: 'Post to LinkedIn, Facebook, X, and more.',
      },
    );
  }

  if (prompts.length === 0) return null;

  return (
    <div className="mt-12">
      <h2
        className="mb-4 text-lg font-bold text-[var(--color-fg)]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Unlock More Features
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {prompts.map((prompt) => (
          <div
            key={prompt.feature}
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4"
          >
            <div className="flex items-start gap-3">
              <LockIcon />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--color-fg)]">{prompt.feature}</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">{prompt.description}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpgrade(prompt.requiredTier)}
              className="mt-3 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-[11px] font-semibold text-amber-400 transition-all hover:bg-amber-500/20"
            >
              Upgrade to {TIER_CONFIGS[prompt.requiredTier].name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────

export default function MembershipPage() {
  const { status, features, upgrade, cancel } = useMembership();
  const [showUpgrade, setShowUpgrade] = useState<Tier | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [upgradeSuccess, _setUpgradeSuccess] = useState<string | null>(null);

  const handleUpgrade = useCallback(async (tier: Tier, period: 'monthly' | 'annual') => {
    setUpgradeLoading(true);
    try {
      // In production, this would trigger a payment flow first
      // For now, we redirect to billing checkout
      window.location.href = `/api/billing/checkout?tier=${tier}&period=${period}`;
    } catch (err) {
      console.error('Upgrade failed:', err);
    } finally {
      setUpgradeLoading(false);
      setShowUpgrade(null);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    try {
      await cancel();
      setShowCancel(false);
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  }, [cancel]);

  if (status.loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="mt-4 text-sm text-[var(--color-muted)]">Loading your membership...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16 animate-page-enter">
      {/* Header */}
      <div className="mb-4 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-amber-400">
            {status.tier === 'free'
              ? 'Free forever — no credit card required'
              : `${status.tierInfo?.name || 'Premium'} plan active`}
          </span>
        </div>
        <h1
          className="mb-4 text-5xl font-black tracking-tight sm:text-6xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <span className="gradient-text-green">Your Membership.</span>
          <br />
          <span className="text-[var(--color-fg)]">Your Terms.</span>
        </h1>
        <p className="mx-auto max-w-xl text-base text-[var(--color-muted)]">
          Start free. Upgrade when you grow.{' '}
          <strong className="text-[var(--color-fg)]">Zero platform fees on tips</strong> — always.
        </p>
      </div>

      {/* Current tier banner */}
      <div className="mb-10">
        <CurrentTierBanner
          tier={status.tier}
          name={status.tierInfo?.name || 'Free'}
          isPremium={status.isPremium}
          expiresAt={status.expiresAt}
        />
      </div>

      {/* Pricing Cards */}
      <div className="mb-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TIER_ORDER.map((tier) => (
          <PricingCard
            key={tier}
            tier={tier}
            currentTier={status.tier}
            onUpgrade={(t) => setShowUpgrade(t)}
          />
        ))}
      </div>

      {/* Feature comparison table */}
      <div className="mb-16">
        <div className="mb-6 text-center">
          <h2
            className="text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Compare Plans
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Everything you get, across every tier. Free → Pro ($5) → Creator ($10) → Enterprise
            ($20).
          </p>
        </div>
        <ComparisonTable currentTier={status.tier} />
      </div>

      {/* Unlock prompts for locked features */}
      <UnlockPrompts currentTier={status.tier} onUpgrade={(t) => setShowUpgrade(t)} />

      {/* Cancel section */}
      {status.isPremium && (
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="text-sm text-[var(--color-muted)] hover:text-red-400 transition-colors"
          >
            Cancel Subscription
          </button>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgrade && (
        <UpgradeModal
          tier={showUpgrade}
          onClose={() => setShowUpgrade(null)}
          onConfirm={handleUpgrade}
          loading={upgradeLoading}
        />
      )}

      {/* Cancel Confirmation */}
      {showCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowCancel(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--color-fg)] mb-2">Cancel Subscription?</h2>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Your {status.tierInfo?.name} plan stays active until{' '}
              {status.expiresAt
                ? new Date(status.expiresAt).toLocaleDateString()
                : 'the end of the billing period'}
              . You won&apos;t be charged again.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="flex-1 rounded-xl border-2 border-[var(--color-glass-border)] py-2.5 text-sm font-semibold text-[var(--color-fg)]"
              >
                Keep Plan
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-xl bg-red-500/20 border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {upgradeSuccess && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-green-500/20 border border-green-500/30 px-6 py-3 text-sm font-semibold text-green-400 shadow-2xl backdrop-blur-sm">
          {upgradeSuccess}
        </div>
      )}
    </div>
  );
}
