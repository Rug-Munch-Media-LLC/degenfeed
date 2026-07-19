'use client';

import type { HolderEntry } from '../../hooks/useTokenCommunity';

// Local format helper
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* ─── Types ──────────────────────────────────────────── */

interface CommunityStatsProps {
  onlineNow: number;
  lastHourBuys: number;
  totalHolders: number;
  totalRaised?: number;
  className?: string;
}

/* ─── Component ─────────────────────────────────────── */

export default function CommunityStats({
  onlineNow,
  lastHourBuys,
  totalHolders,
  totalRaised,
  className = '',
}: CommunityStatsProps) {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 ${className}`}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        📊 Community Stats
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Online now */}
        <div className="rounded-lg bg-[var(--color-overlay)] p-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${onlineNow > 0 ? 'bg-degen-400' : 'bg-[var(--color-muted)]'} opacity-75`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${onlineNow > 0 ? 'bg-degen-500' : 'bg-[var(--color-muted)]'}`}
              />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Online Now
            </span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {formatCompact(onlineNow)}
          </p>
        </div>

        {/* 24h buys */}
        <div className="rounded-lg bg-[var(--color-overlay)] p-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              🔥 1h Buys
            </span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-degen-400">
            {formatCompact(lastHourBuys)}
          </p>
        </div>

        {/* Total Holders */}
        <div className="rounded-lg bg-[var(--color-overlay)] p-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            👥 Holders
          </span>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {formatCompact(totalHolders)}
          </p>
        </div>

        {/* Total Raised */}
        <div className="rounded-lg bg-[var(--color-overlay)] p-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            💰 Raised
          </span>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {totalRaised !== undefined ? `$${formatCompact(totalRaised)}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
