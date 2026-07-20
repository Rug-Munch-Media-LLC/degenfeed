'use client';

/**
 * @components/RegisterFlow — Concierge registration wizard.
 *
 * 6-step flow: Plan → Usernames → Review → Sign → Processing → Success
 *
 * Handles ALL protocol registrations in one bundle, shows transparent
 * pricing at every step, and generates a recovery package on completion.
 *
 * Free alternatives (Warpcast redirect, Lens.xyz) are always shown.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import { usePremium } from '../hooks/usePremium';
import { useToast } from './Toast';
import { PremiumPaymentModal } from './PremiumPaymentModal';

// ─── Types ────────────────────────────────────────────────────────────────

type PlanId = 'free' | 'standard' | 'complete';

interface PlanInfo {
  id: PlanId;
  label: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}

interface AccountResult {
  ok: boolean;
  identifier?: string;
  handle?: string;
  username?: string;
  error?: string;
  redirectUrl?: string;
}

interface ChargeBreakdown {
  total: string;
  totalCents: number;
  breakdown: { item: string; cost: string; covered: boolean }[];
  serviceFeeCents: number;
}

interface RecoveryAccount {
  protocol: string;
  identifier?: string;
  recoveryMethod: string;
}

interface RecoveryPackage {
  message: string;
  accounts: RecoveryAccount[];
  exportDate: string;
  dataExportUrl: string;
}

interface RegistrationResponse {
  success: boolean;
  plan: string;
  wasPremium: boolean;
  accounts: Record<string, AccountResult>;
  charges: ChargeBreakdown;
  recoveryInfo: RecoveryPackage;
  nextSteps: string[];
}

interface RegistrationStatus {
  accounts: Record<
    string,
    { registered: boolean; handle?: string; did?: string; npub?: string; fid?: number; username?: string; profileId?: string; feedUrl?: string }
  >;
  isPremium: boolean;
  premiumTier: string | null;
}

// ─── Plan data ────────────────────────────────────────────────────────────

const PLANS: PlanInfo[] = [
  {
    id: 'free',
    label: 'Free',
    price: '$0',
    description: 'Self-service — we create free accounts, you do Farcaster/Lens yourself',
    features: [
      'GoToSocial (Fediverse) — auto-created',
      'AT Protocol PDS (Bluesky) — auto-created',
      'Nostr keypair — generated for you',
      'RSS feed — public URL',
      'Farcaster free via Warpcast redirect',
      'Lens free via Lens.xyz redirect',
    ],
  },
  {
    id: 'standard',
    label: 'Standard',
    price: '$10',
    description: 'We create everything including on-chain accounts',
    features: [
      'Everything in Free, plus:',
      'Farcaster ID registered ($5 gas — we pay)',
      'Lens Profile created ($2 gas — we pay)',
      'Service fee: $1',
      '~30 seconds automated',
    ],
    popular: true,
  },
  {
    id: 'complete',
    label: 'Complete',
    price: '$20',
    description: 'Everything + custom Lens handle + ENS domain',
    features: [
      'Everything in Standard, plus:',
      'Custom Lens handle ($10 value)',
      'ENS domain registration ($10 value)',
      'Bundle discount: -$10',
      '~2 minutes including ENS confirmation',
    ],
  },
];

// ─── Step indicator ───────────────────────────────────────────────────────

function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i === current
                ? 'bg-degen-500 text-black shadow-[0_0_8px_var(--color-accent-glow)]'
                : i < current
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'border border-[var(--color-glass-border)] text-[var(--color-muted)]'
            }`}
          >
            {i < current ? '✓' : i + 1}
          </div>
          <span
            className={`hidden text-xs sm:inline ${
              i === current ? 'font-medium text-[var(--color-fg)]' : 'text-[var(--color-muted)]'
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`mx-1 h-px w-6 ${
                i < current ? 'bg-degen-500/40' : 'bg-[var(--color-glass-border)]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  selected,
  onSelect,
  premiumActive,
}: {
  plan: PlanInfo;
  selected: boolean;
  onSelect: () => void;
  premiumActive: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col rounded-xl border p-5 text-left transition-all ${
        selected
          ? 'border-degen-500 bg-degen-500/[0.05] shadow-[0_0_16px_var(--color-accent-glow)]'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-[var(--color-muted)]'
      }`}
    >
      {plan.popular && !premiumActive && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-degen-500 px-2.5 py-0.5 text-[10px] font-bold text-black">
          POPULAR
        </span>
      )}
      {premiumActive && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-black">
          COVERED
        </span>
      )}
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-[var(--color-fg)]">{plan.label}</span>
        <span className="text-xl font-black text-degen-400">
          {premiumActive && plan.id !== 'free' ? '$0 *' : plan.price}
        </span>
        {plan.id === 'free' && <span className="text-xs text-[var(--color-muted)]">one-time</span>}
      </div>
      <p className="mb-3 text-xs text-[var(--color-muted)]">{plan.description}</p>
      <ul className="space-y-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-[11px] text-[var(--color-muted)]">
            <span className="mt-0.5 shrink-0 text-degen-400">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {premiumActive && plan.id !== 'free' && (
        <p className="mt-3 text-[10px] text-amber-400">
          * Covered by your $10/mo Premium subscription
        </p>
      )}
    </button>
  );
}

// ─── Step 1: Pick plan ────────────────────────────────────────────────────

function Step1_PickPlan({
  selectedPlan,
  onSelect,
  premiumActive,
}: {
  selectedPlan: PlanId | null;
  onSelect: (id: PlanId) => void;
  premiumActive: boolean;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Choose Your Plan</h2>
      <p className="mb-5 text-sm text-[var(--color-muted)]">
        {premiumActive
          ? 'Premium covers all registration costs. You pay $0 in gas fees.'
          : 'We handle everything — you get all accounts and keys. Gas fees bundled.'}
      </p>

      {premiumActive && (
        <div className="mb-5 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <p className="text-sm font-medium text-[var(--color-fg)]">
              Premium active — all registration costs covered
            </p>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            No one-time fees. Farcaster ($5 gas) and Lens ($2 gas) are covered by your Premium
            subscription. Even the Complete plan is $0 for you.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={selectedPlan === plan.id}
            onSelect={() => onSelect(plan.id)}
            premiumActive={premiumActive}
          />
        ))}
      </div>

      {!premiumActive && (
        <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">
            <span className="font-medium text-amber-400">💡 Premium tip:</span> For $10/mo, all
            registration gas fees (Farcaster $5 + Lens $2) are covered every month. You save $7 in
            one-time fees.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Choose usernames ─────────────────────────────────────────────

function Step2_ChooseUsernames({
  plan,
  farcasterUsername,
  lensHandle,
  ensName,
  onFarcasterChange,
  onLensChange,
  onEnsChange,
}: {
  plan: PlanId;
  farcasterUsername: string;
  lensHandle: string;
  ensName: string;
  onFarcasterChange: (v: string) => void;
  onLensChange: (v: string) => void;
  onEnsChange: (v: string) => void;
}) {
  const showFarcaster = plan !== 'free';
  const showLens = plan !== 'free';
  const showEns = plan === 'complete';

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Choose Your Usernames</h2>
      <p className="mb-5 text-sm text-[var(--color-muted)]">
        Pick your preferred usernames, or leave blank for auto-generated ones (derived from your
        wallet address).
      </p>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
            GoToSocial (Fediverse)
          </label>
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Auto-generated from your wallet address. No input needed.
          </p>
          <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-xs text-[var(--color-muted)]">
            <code>{'{wallet-short}'}@social.degenfeed.xyz</code>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]">
            Bluesky PDS Handle
          </label>
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Auto-generated on our PDS. No input needed.
          </p>
          <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-xs text-[var(--color-muted)]">
            <code>{'{wallet-short}'}.pds.degenfeed.xyz</code>
          </div>
        </div>

        {showFarcaster && (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <label
              htmlFor="fc-username"
              className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
            >
              Farcaster Username
            </label>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Leave blank for auto-generated (wallet-derived). Costs $5 gas to register on Base.
            </p>
            <input
              id="fc-username"
              type="text"
              value={farcasterUsername}
              onChange={(e) => onFarcasterChange(e.target.value)}
              placeholder="Auto-generated (or pick one)"
              maxLength={30}
              pattern="[a-zA-Z0-9_]{2,30}"
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
            />
          </div>
        )}

        {showLens && (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <label
              htmlFor="lens-handle"
              className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
            >
              Lens Handle
            </label>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Leave blank for auto-generated. Standard plan = basic handle. Complete plan = custom
              handle.
            </p>
            <input
              id="lens-handle"
              type="text"
              value={lensHandle}
              onChange={(e) => onLensChange(e.target.value)}
              placeholder="Auto-generated (or pick a custom handle)"
              maxLength={31}
              pattern="[a-zA-Z0-9_\-.]{2,31}"
              className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
            />
          </div>
        )}

        {showEns && (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <label
              htmlFor="ens-name"
              className="mb-1.5 block text-sm font-medium text-[var(--color-fg)]"
            >
              ENS Domain Name
            </label>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              Enter the ENS name you want. We register it for you ($10 gas included in Complete
              plan).
            </p>
            <div className="flex items-center gap-2">
              <input
                id="ens-name"
                type="text"
                value={ensName}
                onChange={(e) => onEnsChange(e.target.value)}
                placeholder="yourname"
                maxLength={64}
                className="flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
              />
              <span className="text-sm text-[var(--color-muted)]">.eth</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cost breakdown row ───────────────────────────────────────────────────

function CostRow({
  label,
  cost,
  covered,
}: {
  label: string;
  cost: string;
  covered: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm text-[var(--color-fg)]">{label}</span>
      <span
        className={`text-sm font-semibold ${
          covered ? 'text-degen-400' : 'text-[var(--color-fg)]'
        }`}
      >
        {covered && cost !== '$0' ? '✓ Covered' : cost}
      </span>
    </div>
  );
}

// ─── Step 3: Review costs ─────────────────────────────────────────────────

function Step3_ReviewCosts({
  plan,
  isPremium,
  charges,
  farcasterUsername,
  lensHandle,
  ensName,
  onBack,
  onConfirm,
}: {
  plan: PlanId;
  isPremium: boolean;
  charges: ChargeBreakdown;
  farcasterUsername: string;
  lensHandle: string;
  ensName: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Review Your Registration</h2>
      <p className="mb-5 text-sm text-[var(--color-muted)]">
        Review what we&apos;ll create and the costs before you confirm.
      </p>

      {/* What we'll create */}
      <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
            What we&apos;ll create for you
          </h3>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          <CostRow label="GoToSocial (Fediverse)" cost="Free" covered={true} />
          <CostRow label="AT Protocol PDS (Bluesky)" cost="Free" covered={true} />
          <CostRow label="Nostr keypair" cost="Free" covered={true} />
          <CostRow label="RSS Feed" cost="Free" covered={true} />
          {plan !== 'free' && (
            <>
              <CostRow
                label={`Farcaster: @${farcasterUsername || 'auto'}`}
                cost="$5 gas"
                covered={isPremium}
              />
              <CostRow
                label={`Lens: @${lensHandle || 'auto'}.lens`}
                cost="$2 gas"
                covered={isPremium}
              />
            </>
          )}
          {plan === 'complete' && ensName && (
            <CostRow label={`ENS: ${ensName}.eth`} cost="$10" covered={false} />
          )}
        </div>
      </div>

      {/* Cost summary */}
      <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-fg)]">
            Cost Summary
          </h3>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {charges.breakdown.map((item, i) => (
            <CostRow key={i} label={item.item} cost={item.cost} covered={item.covered} />
          ))}
        </div>
        <div className="border-t border-[var(--color-border)] bg-degen-500/[0.03] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--color-fg)]">
              {isPremium && plan !== 'free' ? 'Total (covered by Premium)' : 'Total one-time'}
            </span>
            <span className={`text-sm font-bold ${isPremium ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}>
              {charges.total}
            </span>
          </div>
        </div>
      </div>

      {/* Free alternatives reminder */}
      {plan !== 'free' && (
        <div className="mb-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">
            <span className="font-medium text-amber-400">💰 Want to save money?</span>
            <br />
            <strong>Farcaster:</strong> Register free at{' '}
            <a
              href="https://warpcast.com/~/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              warpcast.com
            </a>{' '}
            — then sign in with us. No gas fees.
            <br />
            <strong>Lens:</strong> Create profile free at{' '}
            <a
              href="https://lens.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              lens.xyz
            </a>{' '}
            — then link it here. No gas fees.
            <br />
            <strong>ENS:</strong> Register at{' '}
            <a
              href="https://app.ens.domains"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              app.ens.domains
            </a>{' '}
            (~$10/yr).
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-degen-500 px-6 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)]"
        >
          {isPremium && plan !== 'free'
            ? 'Confirm Registration ($0)'
            : `Confirm — ${charges.total}`}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Wallet signature ─────────────────────────────────────────────

function Step4_WalletSignature({
  onBack,
  onSign,
  signing,
}: {
  onBack: () => void;
  onSign: () => void;
  signing: boolean;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Authorize Registration</h2>
      <p className="mb-5 text-sm text-[var(--color-muted)]">
        Sign one message with your wallet to authorize all registrations. This is a message, not a
        transaction — no gas fee for the signature itself.
      </p>

      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-2 text-sm font-medium text-[var(--color-fg)]">
          You are authorizing DegenFeed to:
        </h3>
        <ul className="space-y-2 text-sm text-[var(--color-muted)]">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-degen-400">1.</span>
            Create accounts on your behalf on supported protocols
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-degen-400">2.</span>
            Pay gas fees (Farcaster on Base, Lens on Polygon) using our premium wallet
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-degen-400">3.</span>
            Transfer all account ownership and keys to your wallet
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-degen-400">4.</span>
            Store your encrypted credentials (recoverable by you only)
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSign}
          disabled={signing}
          className="rounded-lg bg-degen-500 px-6 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)] disabled:opacity-40"
        >
          {signing ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black/80" />
              Signing...
            </span>
          ) : (
            'Sign with Wallet'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Step 5: Processing animation ─────────────────────────────────────────

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
}

const PROCESSING_STEPS: { id: string; label: string }[] = [
  { id: 'activitypub', label: 'Creating GoToSocial account' },
  { id: 'atproto', label: 'Creating AT Protocol PDS account' },
  { id: 'nostr', label: 'Generating Nostr keypair' },
  { id: 'rss', label: 'Setting up RSS feed' },
  { id: 'farcaster', label: 'Registering Farcaster ID (Base tx)' },
  { id: 'lens', label: 'Creating Lens profile (Polygon tx)' },
  { id: 'ens', label: 'Registering ENS domain' },
  { id: 'storage', label: 'Storing credentials & recovery keys' },
];

function Step5_Processing({
  results,
  plan,
}: {
  results: Record<string, AccountResult>;
  plan: PlanId;
}) {
  const steps: ProcessingStep[] = useMemo(() => {
    const doneKeys = new Set(Object.keys(results));
    return PROCESSING_STEPS.map((step) => {
      if (results[step.id]) {
        return {
          ...step,
          status: results[step.id].ok ? ('done' as const) : ('failed' as const),
        };
      }
      // Skip ENS if not in complete plan
      if (step.id === 'ens' && plan !== 'complete') {
        return { ...step, status: 'done' as const };
      }
      // Skip farcaster/lens for free plan
      if ((step.id === 'farcaster' || step.id === 'lens') && plan === 'free') {
        return { ...step, status: 'done' as const };
      }
      return { ...step, status: doneKeys.has(step.id) ? ('done' as const) : ('processing' as const) };
    });
  }, [results, plan]);

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Creating Your Accounts</h2>
      <p className="mb-5 text-sm text-[var(--color-muted)]">
        We&apos;re setting everything up. This usually takes about 30 seconds.
      </p>

      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${
              step.status === 'done'
                ? 'bg-degen-500/[0.04]'
                : step.status === 'failed'
                  ? 'bg-red-500/[0.04]'
                  : 'bg-[var(--color-card)]'
            }`}
          >
            {step.status === 'done' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-degen-500 text-[10px] text-black font-bold">
                ✓
              </span>
            )}
            {step.status === 'processing' && (
              <div className="flex h-5 w-5 items-center justify-center">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
              </div>
            )}
            {step.status === 'failed' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] text-red-400 font-bold">
                !
              </span>
            )}
            {step.status === 'pending' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-glass-border)] text-[10px] text-[var(--color-muted)]">
                &middot;
              </span>
            )}
            <span
              className={`text-sm ${
                step.status === 'done'
                  ? 'text-degen-400'
                  : step.status === 'failed'
                    ? 'text-red-400'
                    : step.status === 'processing'
                      ? 'text-[var(--color-fg)]'
                      : 'text-[var(--color-muted)]'
              }`}
            >
              {step.label}
              {step.status === 'done' && ' ✓'}
              {step.status === 'failed' && ` — ${results[step.id]?.error || 'failed'}`}
            </span>
          </div>
        ))}
      </div>

      {Object.values(results).some((r) => !r.ok) && (
        <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">
            Some accounts couldn&apos;t be created automatically.{' '}
            <a
              href="https://warpcast.com/~/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              Farcaster: Warpcast free signup
            </a>{' '}
            &middot;{' '}
            <a
              href="https://lens.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              Lens: lens.xyz free signup
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Recovery account card ────────────────────────────────────────────────

function RecoveryCard({ account }: { account: RecoveryAccount }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-bold text-[var(--color-fg)]">{account.protocol}</span>
      </div>
      {account.identifier && (
        <p className="mb-1 text-xs text-[var(--color-muted)] font-mono truncate">
          {account.identifier}
        </p>
      )}
      <p className="text-[10px] text-degen-400">{account.recoveryMethod}</p>
    </div>
  );
}

// ─── Step 6: Success + Recovery keys ──────────────────────────────────────

function Step6_Success_RecoveryKeys({
  results,
  recoveryInfo,
  nextSteps,
  onRestart,
}: {
  results: Record<string, AccountResult>;
  recoveryInfo: RecoveryPackage;
  nextSteps: string[];
  onRestart: () => void;
}) {
  const successCount = Object.values(results).filter((r) => r.ok).length;
  const failCount = Object.values(results).filter((r => !r.ok)).length;

  return (
    <div>
      {/* Success header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500 text-sm text-black font-bold">
          ✓
        </span>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">
          {successCount} Account{failCount > 0 ? '+' : ''} Created!
        </h2>
      </div>
      {failCount > 0 && (
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          {successCount} succeeded, {failCount} had issues (check alternatives below).
        </p>
      )}

      <div className="mb-6 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
        <p className="text-xs font-medium text-amber-400">⚠️ Save your recovery information</p>
        <p className="text-[11px] text-[var(--color-muted)]">
          {recoveryInfo.message}
        </p>
      </div>

      {/* Recovery cards */}
      <h3 className="mb-2 text-sm font-bold text-[var(--color-fg)]">
        Your Accounts &amp; Recovery
      </h3>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {recoveryInfo.accounts.map((acct) => (
          <RecoveryCard key={acct.protocol} account={acct} />
        ))}
      </div>

      {/* Next steps */}
      <h3 className="mb-2 text-sm font-bold text-[var(--color-fg)]">Next Steps</h3>
      <ul className="mb-6 space-y-1.5">
        {nextSteps.map((step, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <span className="text-degen-400">{'→'}</span>
            {step}
          </li>
        ))}
      </ul>

      {/* Free alternatives help */}
      {failCount > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="mb-1 text-xs font-medium text-amber-400">Free registration alternatives</p>
          <div className="space-y-1 text-[11px] text-[var(--color-muted)]">
            <p>
              🔗{' '}
              <a
                href="https://warpcast.com/~/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-degen-400 hover:underline"
              >
                Farcaster (free on Warpcast)
              </a>{' '}
              — then sign in with us to link.
            </p>
            <p>
              ◎{' '}
              <a
                href="https://lens.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-degen-400 hover:underline"
              >
                Lens (free on lens.xyz)
              </a>{' '}
              — create a profile, then link it here.
            </p>
          </div>
        </div>
      )}

      {/* Export button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
        >
          Register Another Wallet
        </button>
        <a
          href="/settings"
          className="rounded-lg bg-degen-500 px-6 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)]"
        >
          Go to Settings
        </a>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

const STEPS = ['Plan', 'Usernames', 'Review', 'Sign', 'Processing', 'Success'];

interface RegisterFlowProps {
  /** Called after successful registration */
  onComplete?: () => void;
  /** If true, shows compact version with minimal steps */
  compact?: boolean;
}

export function RegisterFlow({ onComplete, compact = false }: RegisterFlowProps) {
  const { walletAddress, signMessage } = useAuth();
  const { isPremium, loading: premiumLoading } = usePremium();
  const { showToast } = useToast();

  // ── State ───────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [farcasterUsername, setFarcasterUsername] = useState('');
  const [lensHandle, setLensHandle] = useState('');
  const [ensName, setEnsName] = useState('');
  const [signing, setSigning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<Record<string, AccountResult>>({});
  const [charges, setCharges] = useState<ChargeBreakdown | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryPackage | null>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<PlanInfo[]>(PLANS);

  // Fetch pricing on mount
  useEffect(() => {
    fetch('/api/register/plans', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { plans?: PlanInfo[] }) => {
        if (data.plans?.length) {
          setPlans(data.plans);
        }
      })
      .catch(() => {
        // Use static plan data
      });
  }, []);

  // ── Computed charges ────────────────────────────────
  const computedCharges = useMemo((): ChargeBreakdown | null => {
    if (!selectedPlan) return null;

    if (isPremium) {
      return {
        total: '$0 (covered by Premium subscription)',
        totalCents: 0,
        breakdown: [
          { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: true },
          { item: 'Lens Profile ($2 gas)', cost: '$2', covered: true },
          { item: 'GoToSocial account', cost: '$0', covered: true },
          { item: 'AT Protocol PDS', cost: '$0', covered: true },
          { item: 'Nostr keypair', cost: '$0', covered: true },
          { item: 'RSS feed', cost: '$0', covered: true },
        ],
        serviceFeeCents: 0,
      };
    }

    switch (selectedPlan) {
      case 'standard':
        return {
          total: '$8',
          totalCents: 800,
          breakdown: [
            { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: false },
            { item: 'Lens Profile ($2 gas)', cost: '$2', covered: false },
            { item: 'Service fee', cost: '$1', covered: false },
            { item: 'GoToSocial + PDS + Nostr + RSS', cost: '$0', covered: true },
          ],
          serviceFeeCents: 100,
        };
      case 'complete':
        return {
          total: '$15',
          totalCents: 1500,
          breakdown: [
            { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: false },
            { item: 'Lens + custom handle ($10 gas)', cost: '$10', covered: false },
            { item: 'ENS domain ($10)', cost: '$10', covered: false },
            { item: 'Bundle discount', cost: '-$10', covered: false },
            { item: 'GoToSocial + PDS + Nostr + RSS', cost: '$0', covered: true },
          ],
          serviceFeeCents: 100,
        };
      default:
        return {
          total: '$0',
          totalCents: 0,
          breakdown: [
            { item: 'GoToSocial account', cost: '$0', covered: true },
            { item: 'AT Protocol PDS', cost: '$0', covered: true },
            { item: 'Nostr keypair', cost: '$0', covered: true },
            { item: 'RSS feed', cost: '$0', covered: true },
          ],
          serviceFeeCents: 0,
        };
    }
  }, [selectedPlan, isPremium]);

  // ── Handle plan selection ───────────────────────────
  const handlePlanSelect = useCallback(
    (id: PlanId) => {
      setSelectedPlan(id);
      if (compact && id === 'free') {
        // In compact mode, free goes straight to processing
        handleConfirm(id);
        return;
      }
      setStep(1);
    },
    [compact],
  );

  // ── Handle confirm (moves to sign step) ─────────────
  const handleConfirm = useCallback(
    async (planOverride?: PlanId) => {
      const plan = planOverride || selectedPlan;
      if (!plan) return;

      if (!compact) {
        setStep(3); // Sign step
        return;
      }
      // In compact mode, skip sign and go straight to processing
      await executeRegistration(plan, true);
    },
    [selectedPlan, compact, walletAddress],
  );

  // ── Execute registration ────────────────────────────
  const executeRegistration = useCallback(
    async (plan: PlanId, skipSign: boolean = false) => {
      if (!walletAddress) {
        showToast('error', 'Connect your wallet first');
        return;
      }

      setProcessing(true);
      setStep(4); // Processing
      setError('');

      // If not skipping sign, do the wallet signature
      if (!skipSign) {
        setSigning(true);
        try {
          const sig = await signMessage(
            `Authorize DegenFeed to create all protocol accounts (plan: ${plan}). This is a free signature — no gas fee.`,
          );
          if (!sig) {
            setSigning(false);
            setProcessing(false);
            showToast('error', 'Signature cancelled');
            return;
          }
        } catch {
          setSigning(false);
          setProcessing(false);
          showToast('error', 'Signature failed — try again');
          return;
        }
        setSigning(false);
      }

      // Submit registration
      try {
        const body: Record<string, string> = { plan };
        if (farcasterUsername) body.farcasterUsername = farcasterUsername;
        if (lensHandle) body.lensHandle = lensHandle;
        if (ensName && plan === 'complete') body.ensName = ensName;

        const res = await fetch('/api/register/all', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as RegistrationResponse;

        if (!res.ok) {
          throw new Error((data as unknown as { error?: string }).error || 'Registration failed');
        }

        // Store results
        setResults(data.accounts);
        setCharges(data.charges);
        setRecoveryInfo(data.recoveryInfo);
        setNextSteps(data.nextSteps);
        setStep(5); // Success
        onComplete?.();
        showToast('success', `🎉 ${data.accounts ? Object.values(data.accounts).filter((a) => a.ok).length : 0} accounts created!`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setError(msg);
        showToast('error', msg);
        // Go back to review
        if (!compact) setStep(2);
      } finally {
        setProcessing(false);
      }
    },
    [walletAddress, farcasterUsername, lensHandle, ensName, signMessage, showToast, onComplete, compact],
  );

  // ── Handle sign + submit ────────────────────────────
  const handleSign = useCallback(async () => {
    if (!selectedPlan) return;
    await executeRegistration(selectedPlan, false);
  }, [selectedPlan, executeRegistration]);

  // ── Reset ───────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setStep(0);
    setSelectedPlan(null);
    setFarcasterUsername('');
    setLensHandle('');
    setEnsName('');
    setResults({});
    setCharges(null);
    setRecoveryInfo(null);
    setError('');
  }, []);

  // ── Not connected ──────────────────────────────────
  if (!walletAddress) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 text-center">
        <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">
          Create Your Universal Social Identity
        </h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          Connect your wallet to get started. One registration. All protocols. You own everything.
        </p>
        <div className="rounded-lg bg-[var(--color-overlay)] px-4 py-3 text-xs text-[var(--color-muted)]">
          Connect wallet above to continue
        </div>
      </div>
    );
  }

  // ── Compact mode (just plan selection + result) ─────
  if (compact) {
    return (
      <div className="space-y-4">
        {step === 0 && (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">
              Quick Registration
            </h3>
            <div className="grid gap-2">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handlePlanSelect(plan.id)}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] px-3 py-2.5 text-left hover:bg-[var(--color-overlay)] transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium text-[var(--color-fg)]">
                      {plan.label}
                    </span>
                    <p className="text-[10px] text-[var(--color-muted)]">{plan.description}</p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      isPremium && plan.id !== 'free' ? 'text-degen-400' : ''
                    }`}
                  >
                    {isPremium && plan.id !== 'free' ? '$0' : plan.price}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && results && Object.keys(results).length > 0 && (
          <div>
            <Step5_Processing results={results} plan={selectedPlan || 'free'} />
          </div>
        )}

        {step === 5 && recoveryInfo && (
          <Step6_Success_RecoveryKeys
            results={results}
            recoveryInfo={recoveryInfo}
            nextSteps={nextSteps}
            onRestart={handleRestart}
          />
        )}
      </div>
    );
  }

  // ── Full flow ───────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl">
      {/* Premium status note */}
      {!premiumLoading && isPremium && (
        <div className="mb-6 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-sm font-medium text-amber-400">
            ⚡ Premium Active — Registration gas costs covered
          </p>
        </div>
      )}

      {/* Steps indicator */}
      {step <= 3 && <StepIndicator steps={STEPS} current={step} />}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/10 bg-red-500/[0.03] px-4 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Step content */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {step === 0 && (
          <Step1_PickPlan
            selectedPlan={selectedPlan}
            onSelect={handlePlanSelect}
            premiumActive={isPremium}
          />
        )}

        {step === 1 && selectedPlan && (
          <Step2_ChooseUsernames
            plan={selectedPlan}
            farcasterUsername={farcasterUsername}
            lensHandle={lensHandle}
            ensName={ensName}
            onFarcasterChange={setFarcasterUsername}
            onLensChange={setLensHandle}
            onEnsChange={setEnsName}
          />
        )}

        {step === 1 && selectedPlan && (
          <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg bg-degen-500 px-6 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)]"
            >
              Review Costs →
            </button>
          </div>
        )}

        {step === 2 && selectedPlan && computedCharges && (
          <Step3_ReviewCosts
            plan={selectedPlan}
            isPremium={isPremium}
            charges={computedCharges}
            farcasterUsername={farcasterUsername}
            lensHandle={lensHandle}
            ensName={ensName}
            onBack={() => setStep(1)}
            onConfirm={() => handleConfirm()}
          />
        )}

        {step === 3 && selectedPlan && (
          <Step4_WalletSignature
            onBack={() => setStep(2)}
            onSign={handleSign}
            signing={signing}
          />
        )}

        {step === 4 && (
          <Step5_Processing results={results} plan={selectedPlan || 'free'} />
        )}

        {step === 5 && recoveryInfo && (
          <Step6_Success_RecoveryKeys
            results={results}
            recoveryInfo={recoveryInfo}
            nextSteps={nextSteps}
            onRestart={handleRestart}
          />
        )}
      </div>

      {/* Free alternatives footer */}
      {selectedPlan !== 'free' && step < 2 && (
        <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">
            <span className="font-medium text-amber-400">💡 Free alternatives:</span>
            <br />
            <a
              href="https://warpcast.com/~/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              Farcaster (free on Warpcast)
            </a>{' '}
            &middot;{' '}
            <a
              href="https://lens.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              Lens (free on lens.xyz)
            </a>{' '}
            &middot; Sign up free, then link your accounts here.
          </p>
        </div>
      )}
    </div>
  );
}
