'use client';

import type { HolderEntry } from '../../hooks/useTokenCommunity';

/* ─── Badge display ─────────────────────────────────── */

const BADGE_ICONS: Record<string, string> = {
  creator: '👑',
  og: '🦅',
  early_bird: '🐦',
  first_buyer: '🥇',
  whale: '🐋',
  superfan: '⭐',
};

/* ─── Component ─────────────────────────────────────── */

interface HolderLeaderboardProps {
  holders: HolderEntry[];
  extended?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export default function HolderLeaderboard({
  holders,
  extended = false,
  loading = false,
  error = null,
  onRetry,
  className = '',
}: HolderLeaderboardProps) {
  const displayHolders = extended ? holders : holders.slice(0, 10);

  // Loading state — mobile friendly
  if (loading) {
    return (
      <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          🏆 Top Holders
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-8 sm:h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center ${className}`}>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          🏆 Top Holders
        </h3>
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
      <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          🏆 Top Holders
        </h3>
        <div className="flex flex-col items-center py-4 sm:py-6 text-center">
          <div className="mb-2 text-2xl opacity-30">👥</div>
          <p className="text-xs text-[var(--color-muted)]">No holders yet.</p>
          <p className="text-[10px] text-[var(--color-muted)]">Be the first to buy!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        🏆 Top Holders
      </h3>

      <div className="space-y-1">
        {displayHolders.map((entry, idx) => (
          <HolderRow key={entry.wallet} entry={entry} rank={idx + 1} />
        ))}
      </div>

      {!extended && holders.length > 10 && (
        <p className="mt-2 text-center text-[10px] text-[var(--color-muted)]">
          +{holders.length - 10} more holders
        </p>
      )}
    </div>
  );
}

/* ─── Holder Row — compact on mobile ─────────────────── */

function HolderRow({ entry, rank }: { entry: HolderEntry; rank: number }) {
  const topBadge = entry.badges[0];
  const badgeIcon = topBadge ? BADGE_ICONS[topBadge] : null;

  const displayName = `${entry.wallet.slice(0, 6)}...${entry.wallet.slice(-4)}`;

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 sm:py-2 transition-colors hover:bg-[var(--color-overlay)]"
      style={{ minHeight: 44 }}
    >
      {/* Rank */}
      <span
        className={`w-5 text-center text-[11px] sm:text-xs font-bold tabular-nums ${
          rank <= 3 ? 'text-degen-400' : 'text-[var(--color-muted)]'
        }`}
      >
        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
      </span>

      {/* Avatar */}
      <div className="flex h-7 w-7 sm:h-6 sm:w-6 items-center justify-center overflow-hidden rounded-full bg-degen-500/20 shrink-0">
        <span className="text-[10px] font-bold text-degen-400">
          {entry.wallet.charAt(2).toUpperCase()}
        </span>
      </div>

      {/* Name + badges */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-xs sm:text-[13px] font-medium text-[var(--color-fg)] truncate">
            {displayName}
          </span>
          {entry.isCreator && (
            <span className="text-[9px] shrink-0" title="Creator">👑</span>
          )}
          {badgeIcon && (
            <span className="text-[9px] shrink-0" title={topBadge}>{badgeIcon}</span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="text-xs sm:text-sm font-bold tabular-nums text-[var(--color-fg)]">
          {formatHolderAmount(entry.amount)}
        </p>
        <p className="text-[8px] sm:text-[9px] text-[var(--color-muted)] tabular-nums">
          {entry.percentage.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────── */

function formatHolderAmount(amount: string): string {
  const n = Number(amount);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
