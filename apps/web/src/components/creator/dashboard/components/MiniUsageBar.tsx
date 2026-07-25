'use client';

export function MiniUsageBar({
  label,
  value,
  max,
  color,
  sub,
  count,
  cost,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  sub: string;
  count: number;
  cost?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs text-[var(--color-fg)] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(pct, 1)}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}40`,
          }}
        />
      </div>
      <span className="w-20 text-right text-xs tabular-nums text-[var(--color-fg)] shrink-0">
        {sub}
      </span>
      <span className="w-10 text-right text-[10px] text-[var(--color-muted)] shrink-0">
        {count}
      </span>
      {cost && (
        <span className="w-16 text-right text-[10px] tabular-nums shrink-0" style={{ color }}>
          {cost}
        </span>
      )}
    </div>
  );
}
