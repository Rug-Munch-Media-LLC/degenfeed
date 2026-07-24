'use client';

import { formatCompact } from './utils';

export function MiniBar({
  value,
  max,
  color,
  label,
  sub,
}: {
  value: number;
  max: number;
  color: string;
  label?: string;
  sub?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      {label && <span className="w-20 shrink-0 text-xs text-[var(--color-muted)]">{label}</span>}
      <div
        className="flex-1 overflow-hidden rounded-full bg-[var(--color-overlay)]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || `${value} of ${max}`}
      >
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
        {formatCompact(value)}
      </span>
      {sub && <span className="w-16 text-right text-[10px] text-[var(--color-muted)]">{sub}</span>}
    </div>
  );
}
