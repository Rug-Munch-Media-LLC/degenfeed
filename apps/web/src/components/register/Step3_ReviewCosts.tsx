'use client';

import type { ChargeBreakdown, PlanId } from './types';

function CostRow({ label, cost, covered }: { label: string; cost: string; covered: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm text-[var(--color-fg)]">{label}</span>
      <span
        className={`text-sm font-semibold ${covered ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
      >
        {covered && cost !== '$0' ? '✓ Covered' : cost}
      </span>
    </div>
  );
}

export function Step3_ReviewCosts({
  plan,
  isPremium,
  charges,
  farcasterUsername,
  lensHandle,
  ensName,
  handleGasCost,
  confirmedOverage,
  onBack,
  onConfirm,
  onConfirmOverage,
}: {
  plan: PlanId;
  isPremium: boolean;
  charges: ChargeBreakdown;
  farcasterUsername: string;
  lensHandle: string;
  ensName: string;
  handleGasCost: number;
  confirmedOverage: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onConfirmOverage: () => void;
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
                cost={`$${handleGasCost} gas`}
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
          {charges.breakdown.map((item) => (
            <CostRow key={item.item} label={item.item} cost={item.cost} covered={item.covered} />
          ))}
        </div>
        <div className="border-t border-[var(--color-border)] bg-degen-500/[0.03] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--color-fg)]">
              {isPremium && plan !== 'free' ? 'Total (covered by Premium)' : 'Total one-time'}
            </span>
            <span
              className={`text-sm font-bold ${isPremium ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
            >
              {charges.total}
            </span>
          </div>
        </div>
      </div>

      {/* Profit guarantee */}
      {plan !== 'free' && !isPremium && (
        <div className="mb-4 rounded-xl border border-degen-500/10 bg-degen-500/[0.03] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">💰</span>
            <h4 className="text-sm font-bold text-[var(--color-fg)]">
              Our Profit: ${charges.ourProfit}
            </h4>
          </div>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            {charges.requiresConfirmation
              ? `⚠️ Gas costs exceed plan budget. +$${charges.overage?.toFixed(2)} extra required.`
              : '✅ Gas costs within plan budget. No extra charges.'}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--color-muted)] leading-relaxed">
            We charge a flat ${charges.ourProfit} service fee for handling all 5 protocol
            registrations. Gas is pass-through — we don&apos;t mark it up.
          </p>
        </div>
      )}

      {/* Overage confirmation */}
      {charges.requiresConfirmation && !confirmedOverage && (
        <div className="mb-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] px-4 py-4">
          <p className="mb-3 text-sm font-medium text-orange-400">
            ⚠️ Current gas costs are higher than usual
          </p>
          <p className="mb-3 text-xs text-[var(--color-muted)] leading-relaxed">
            The combined on-chain gas costs (${(charges.overage || 0) + 7} total) exceed the
            plan&apos;s gas budget ($7). We need your approval to charge an additional{' '}
            <strong className="text-orange-400">+${charges.overage?.toFixed(2)}</strong>.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onConfirmOverage}
              className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-orange-400"
            >
              Proceed anyway (+${charges.overage?.toFixed(2)})
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
            >
              Wait for lower gas
            </button>
          </div>
        </div>
      )}

      {/* Free alternatives */}
      {plan !== 'free' && !charges.requiresConfirmation && (
        <div className="mb-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="text-xs text-[var(--color-muted)]">
            <span className="font-medium text-amber-400">💰 Want to save money?</span>
            <br />
            <strong>Farcaster:</strong>{' '}
            <a
              href="https://warpcast.com/~/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              warpcast.com
            </a>{' '}
            — free signup, then link here.
            <br />
            <strong>Lens:</strong>{' '}
            <a
              href="https://lens.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-degen-400 hover:underline"
            >
              lens.xyz
            </a>{' '}
            — free profile, then link.
            <br />
            <strong>ENS:</strong>{' '}
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
          disabled={charges.requiresConfirmation && !confirmedOverage}
          className="rounded-lg bg-degen-500 px-6 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPremium && plan !== 'free'
            ? 'Confirm Registration ($0)'
            : charges.requiresConfirmation && !confirmedOverage
              ? 'Confirm overage above'
              : `Confirm — ${charges.total}`}
        </button>
      </div>
    </div>
  );
}
