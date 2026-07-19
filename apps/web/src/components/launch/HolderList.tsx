'use client';

interface Holder {
  address: string;
  percentage: number;
  usdValue: number;
}

interface HolderListProps {
  holders: Holder[];
  totalHolders?: number;
  loading?: boolean;
  maxItems?: number;
  className?: string;
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(n: number): string {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function HolderList({
  holders,
  totalHolders,
  loading = false,
  maxItems = 10,
  className = '',
}: HolderListProps) {
  const displayHolders = holders.sort((a, b) => b.percentage - a.percentage).slice(0, maxItems);

  // Loading state
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Top Holders
          </span>
          <span className="skeleton h-3 w-10 rounded" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-8 rounded-lg" />
        ))}
      </div>
    );
  }

  // Empty state
  if (holders.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center ${className}`}
      >
        <p className="text-xs text-[var(--color-muted)]">No holders yet</p>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">Buy in to become one!</p>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Top Holders
        </span>
        {totalHolders !== undefined && (
          <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
            {totalHolders} holder{totalHolders !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Holder rows */}
      <div className="space-y-0.5">
        {displayHolders.map((holder, i) => {
          const barColor =
            i === 0
              ? 'from-degen-500 to-degen-400'
              : i === 1
                ? 'from-degen-400 to-degen-300'
                : i === 2
                  ? 'from-degen-300 to-degen-200'
                  : 'from-[var(--color-muted)] to-transparent';

          return (
            <div
              key={holder.address}
              className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--color-overlay)]"
            >
              {/* Background bar */}
              <div
                className={`absolute bottom-0 left-0 top-0 rounded-lg bg-gradient-to-r opacity-10 ${barColor}`}
                style={{ width: `${holder.percentage}%` }}
              />

              {/* Rank */}
              <span className="relative w-4 text-center text-[10px] font-bold text-[var(--color-muted)]">
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
              </span>

              {/* Address */}
              <span className="relative min-w-0 flex-1 font-mono text-xs tabular-nums text-[var(--color-fg)]">
                {shortenAddress(holder.address)}
              </span>

              {/* Percentage */}
              <span className="relative text-xs font-semibold tabular-nums text-degen-400">
                {holder.percentage.toFixed(1)}%
              </span>

              {/* USD value — hidden on mobile */}
              <span className="relative hidden text-[10px] tabular-nums text-[var(--color-muted)] md:block">
                {formatUsd(holder.usdValue)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
