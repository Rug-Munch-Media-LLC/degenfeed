'use client';

import { PLANS } from './constants';
import type { PlanId, PlanInfo } from './types';

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

export function Step1_PickPlan({
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
            registration gas fees (Farcaster $5 + Lens $2) are covered every month.
          </p>
        </div>
      )}
    </div>
  );
}
