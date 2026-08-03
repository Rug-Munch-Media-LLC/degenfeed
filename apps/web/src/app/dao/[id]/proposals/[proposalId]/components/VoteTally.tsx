'use client';

export function VoteTally({
  label,
  value,
  pct,
  bg,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-3 w-3 rounded-full ${bg}`} />
      <span className="w-16 text-xs font-medium text-[var(--color-fg)]">{label}</span>
      <div className="flex-1">
        <div className="h-3 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${bg}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="w-20 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
        {value.toLocaleString()}
      </span>
      <span className="w-12 text-right text-[10px] text-[var(--color-muted)]">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
