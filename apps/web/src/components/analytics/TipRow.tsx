'use client';

import { formatTimeAgo, protocolBadge } from './utils';

export function TipRow({
  tip,
}: {
  tip: { amount: string; currency: string; protocol: string; createdAt: number };
}) {
  const badge = protocolBadge(tip.protocol);
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-degen-400">✦</span>
        <span className="text-xs font-medium text-[var(--color-fg)]">
          {tip.amount} {tip.currency}
        </span>
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px]"
          style={{ backgroundColor: badge.bg, color: badge.fg }}
        >
          {badge.label}
        </span>
      </div>
      <span className="text-[10px] text-[var(--color-muted)]">{formatTimeAgo(tip.createdAt)}</span>
    </div>
  );
}
