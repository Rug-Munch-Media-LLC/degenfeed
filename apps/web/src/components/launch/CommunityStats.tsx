'use client';

// Local format helper
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/* === Types ============================================ */

interface CommunityStatsProps {
  onlineNow: number;
  lastHourBuys: number;
  totalHolders: number;
  totalRaised?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/* === Component ======================================= */

export default function CommunityStats({
  onlineNow,
  lastHourBuys,
  totalHolders,
  totalRaised,
  loading = false,
  error = null,
  onRetry,
  className = '',
}: CommunityStatsProps) {
  // Loading state
  if (loading) {
    return (
      <div
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}
      >
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          📊 Community Stats
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 sm:h-20 rounded-lg" />
          ))}
        </div>
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

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}
    >
      <h3 className="mb-2 sm:mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        📊 Community Stats
      </h3>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Online now */}
        <div className="rounded-lg bg-[var(--color-overlay)] p-2 sm:p-3">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="relative flex h-1.5 sm:h-2 w-1.5 sm:w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${onlineNow > 0 ? 'bg-degen-400' : 'bg-[var(--color-muted)]'} opacity-75`}
              />
              <span
                className={`relative inline-flex h-full w-full rounded-full ${onlineNow > 0 ? 'bg-degen-500' : 'bg-[var(--color-muted)]'}`}
              />
            </span>
            <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Online Now
            </span>
          </div>
          <p className="mt-0.5 sm:mt-1 text-base sm:text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {formatCompact(onlineNow)}
          </p>
        </div>

        {/* 1h buys */}
        <div className="rounded-lg bg-[var(--color-overlay)] p-2 sm:p-3">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              🔥 1h Buys
            </span>
          </div>
          <p className="mt-0.5 sm:mt-1 text-base sm:text-lg font-bold tabular-nums text-degen-400">
            {formatCompact(lastHourBuys)}
          </p>
        </div>

        {/* Total Holders */}
        <div className="rounded-lg bg-[var(--color-overlay)] p-2 sm:p-3">
          <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            👥 Holders
          </span>
          <p className="mt-0.5 sm:mt-1 text-base sm:text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {formatCompact(totalHolders)}
          </p>
        </div>

        {/* Total Raised */}
        <div className="rounded-lg bg-[var(--color-overlay)] p-2 sm:p-3">
          <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            💰 Raised
          </span>
          <p className="mt-0.5 sm:mt-1 text-base sm:text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {totalRaised !== undefined ? `$${formatCompact(totalRaised)}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
