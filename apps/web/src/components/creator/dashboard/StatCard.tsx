'use client';

import { formatCompact } from './types';

export function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: string;
}) {
  return (
    <div className="card relative overflow-hidden border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl transition-all hover:border-degen-500/20">
      {accent && (
        <div
          className="absolute right-0 top-0 h-0.5 w-full opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accent})` }}
        />
      )}
      {icon && <div className="mb-1 text-lg">{icon}</div>}
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-[var(--color-fg)]">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}
