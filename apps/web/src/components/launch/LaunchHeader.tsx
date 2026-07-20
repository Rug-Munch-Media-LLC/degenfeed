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

/* === Stat Card Subcomponent ============================ */

interface StatCardProps {
  label: string;
  value: string | null;
  accent?: boolean;
  color?: string;
  loading?: boolean;
  skeletonWidth?: string;
}

function StatCard({ label, value, accent, color, loading, skeletonWidth = 'w-16' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2.5 sm:p-4 touch-target">
      <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)] sm:text-[10px]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-base font-bold tabular-nums sm:text-2xl sm:mt-1 ${
          accent ? 'text-degen-400' : color || 'text-[var(--color-fg)]'
        }`}
      >
        {loading ? (
          <span className={`skeleton inline-block h-5 sm:h-7 ${skeletonWidth} rounded`} />
        ) : value !== null ? (
          value
        ) : (
          '—'
        )}
      </div>
    </div>
  );
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
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-fg)] sm:text-3xl">
          🚀 Creator Coins
        </h1>
        <p className="mt-1 text-xs text-[var(--color-muted)] sm:text-sm">
          Launch your own coin with a fair prebonding curve. Community buys in, price rises, and
          when it hits the target — it graduates to a real trading pair.
        </p>
      </div>

      {/* Stats bar — 3 col grid but touch-friendly */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Total Launched"
          value={loading ? null : totalLaunched !== undefined ? formatCompact(totalLaunched) : '—'}
          accent
          loading={loading}
          skeletonWidth="w-16"
        />

        <StatCard
          label="Total Volume"
          value={loading ? null : totalVolume !== undefined ? formatUsd(totalVolume) : '—'}
          loading={loading}
          skeletonWidth="w-20"
        />

        <StatCard
          label="Active Prebonding"
          value={loading ? null : activePrebonding !== undefined ? String(activePrebonding) : '—'}
          color="text-yellow-400"
          loading={loading}
          skeletonWidth="w-12"
        />
      </div>
    </div>
  );
}

