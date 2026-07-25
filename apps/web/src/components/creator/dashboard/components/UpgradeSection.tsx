'use client';

import { STORAGE_TIERS } from '../constants';

export function UpgradeSection({ currentPlan }: { currentPlan: string }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Upgrade Storage</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STORAGE_TIERS.map((tier) => {
          const isCurrent = tier.id === currentPlan;
          return (
            <div
              key={tier.id}
              className={`relative rounded-xl border p-4 transition-all ${
                isCurrent
                  ? 'border-degen-500/30 bg-degen-500/5'
                  : tier.popular
                    ? 'border-degen-500/20 bg-[var(--color-card)] hover:border-degen-500/40'
                    : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/20'
              }`}
            >
              {tier.popular && !isCurrent && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-degen-500 px-3 py-0.5 text-[8px] font-bold uppercase tracking-wider text-black">
                  Popular
                </div>
              )}
              <div className="mb-3">
                <h4 className="text-sm font-bold text-[var(--color-fg)]">{tier.name}</h4>
                <div className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
                  {tier.price}
                </div>
                <p className="text-[10px] text-[var(--color-muted)]">{tier.storage}</p>
              </div>

              <div
                className="mb-3 rounded-md px-2 py-1 text-[8px] font-medium"
                style={{
                  backgroundColor: `${tier.color}10`,
                  color: tier.color,
                }}
              >
                {tier.backends}
              </div>

              <ul className="mb-4 space-y-1.5">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-1.5 text-[10px] text-[var(--color-muted)]"
                  >
                    <span className="text-degen-400 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={isCurrent}
                className={`w-full rounded-lg py-2 text-[10px] font-bold transition-all ${
                  isCurrent
                    ? 'bg-[var(--color-glass-border)] text-[var(--color-muted)] cursor-not-allowed'
                    : tier.popular
                      ? 'bg-degen-500/20 text-degen-400 hover:bg-degen-500/30'
                      : 'bg-[var(--color-overlay)] text-[var(--color-fg)] hover:bg-[var(--color-glass-border)]'
                }`}
              >
                {isCurrent ? '✓ Current' : tier.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
