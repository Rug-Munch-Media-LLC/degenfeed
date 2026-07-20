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
  error?: string | null;
  onRetry?: () => void;
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
  error = null,
  onRetry,
  maxItems = 10,
  className = '',
}: HolderListProps) {
  const displayHolders = [...holders]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, maxItems);

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
          <div key={i} className="skeleton h-8 sm:h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center ${className}`}
      >
        <p className="text-xs text-red-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-medium text-red-400 hover:bg-red-500/30 touch-target"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Empty state — mobile friendly
  if (holders.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-6 text-center ${className}`}
      >
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-glow)]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-degen-400"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
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

      {/* Holder rows — compact on mobile */}
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
              className="group relative flex items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-2 transition-colors hover:bg-[var(--color-overlay)]"
              style={{ minHeight: 40 }}
            >
              {/* Background bar */}
              <div
                className={`absolute bottom-0 left-0 top-0 rounded-lg bg-gradient-to-r opacity-10 ${barColor}`}
                style={{ width: `${holder.percentage}%` }}
              />

              {/* Rank */}
              <span className="relative w-4 text-center text-[9px] sm:text-[10px] font-bold text-[var(--color-muted)]">
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
              </span>

              {/* Address */}
              <span className="relative min-w-0 flex-1 font-mono text-[11px] sm:text-xs tabular-nums text-[var(--color-fg)] truncate">
                {shortenAddress(holder.address)}
              </span>

              {/* Percentage */}
              <span className="relative text-[11px] sm:text-xs font-semibold tabular-nums text-degen-400 shrink-0">
                {holder.percentage.toFixed(1)}%
              </span>

              {/* USD value — hidden on mobile */}
              <span className="relative hidden text-[10px] tabular-nums text-[var(--color-muted)] sm:block w-16 text-right">
                {formatUsd(holder.usdValue)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
