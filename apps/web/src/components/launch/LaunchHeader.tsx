'use client';

interface LaunchHeaderProps {
  /** Total coins launched */
  totalLaunched?: number;
  /** Total volume across all prebonding coins */
  totalVolume?: number;
  /** Active prebonding coins */
  activePrebonding?: number;
  loading?: boolean;
  className?: string;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function LaunchHeader({
  totalLaunched,
  totalVolume,
  activePrebonding,
  loading = false,
  className = '',
}: LaunchHeaderProps) {
  return (
    <div className={`${className}`}>
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
          🚀 Creator Coins
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Launch your own coin with a fair prebonding curve. Community buys in, price rises, and
          when it hits the target — it graduates to a real trading pair.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Total Launched
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-degen-400 sm:text-2xl">
            {loading ? (
              <span className="skeleton inline-block h-7 w-16 rounded" />
            ) : totalLaunched !== undefined ? (
              formatCompact(totalLaunched)
            ) : (
              '—'
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Total Volume
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-[var(--color-fg)] sm:text-2xl">
            {loading ? (
              <span className="skeleton inline-block h-7 w-20 rounded" />
            ) : totalVolume !== undefined ? (
              formatUsd(totalVolume)
            ) : (
              '—'
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Active Prebonding
          </div>
          <div className="mt-1 text-xl font-bold tabular-nums text-yellow-400 sm:text-2xl">
            {loading ? (
              <span className="skeleton inline-block h-7 w-12 rounded" />
            ) : activePrebonding !== undefined ? (
              String(activePrebonding)
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
