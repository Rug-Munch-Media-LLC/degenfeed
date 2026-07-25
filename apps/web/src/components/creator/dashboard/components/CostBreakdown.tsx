'use client';

import { BACKEND_EMOJIS, BACKEND_LABELS } from '../constants';

export function CostBreakdown({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number;
}) {
  if (Object.keys(breakdown).length === 0) {
    return (
      <div className="text-[10px] text-[var(--color-muted)] text-center py-2">
        Your storage is currently free! 🎉
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--color-fg)]">
        <span className="font-semibold">Monthly Cost</span>
        <span className="font-bold tabular-nums">${total.toFixed(2)}</span>
      </div>
      <div className="space-y-1">
        {Object.entries(breakdown).map(([backend, cost]) => {
          if (cost === 0) return null;
          const emoji = BACKEND_EMOJIS[backend] ?? '📁';
          const label = BACKEND_LABELS[backend] ?? backend;
          return (
            <div
              key={backend}
              className="flex items-center justify-between text-[10px] text-[var(--color-muted)]"
            >
              <span>
                {emoji} {label}
              </span>
              <span className="tabular-nums">${cost.toFixed(4)}/mo</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
