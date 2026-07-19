'use client';

import type { CoinCardData } from './CoinCard';
import CoinCard from './CoinCard';

interface PrebondingLeaderboardProps {
  coins: CoinCardData[];
  loading?: boolean;
  error?: string | null;
  title?: string;
  maxItems?: number;
  showRank?: boolean;
  className?: string;
}

export default function PrebondingLeaderboard({
  coins,
  loading = false,
  error = null,
  title = '🔥 Trending Prebonding Coins',
  maxItems = 10,
  showRank = true,
  className = '',
}: PrebondingLeaderboardProps) {
  // Loading skeleton
  if (loading) {
    return (
      <section className={className}>
        <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">{title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className={className}>
        <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">{title}</h2>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </section>
    );
  }

  // Empty state
  if (coins.length === 0) {
    return (
      <section className={className}>
        <h2 className="mb-4 text-lg font-bold text-[var(--color-fg)]">{title}</h2>
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-glow)]">
            <span className="text-lg">🚀</span>
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">No coins yet</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Be the first to launch a creator coin!
          </p>
        </div>
      </section>
    );
  }

  const displayCoins = coins.slice(0, maxItems);

  return (
    <section className={className}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--color-fg)]">{title}</h2>
        <span className="text-[11px] tabular-nums text-[var(--color-muted)]">
          {coins.length} coin{coins.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayCoins.map((coin, i) => (
          <CoinCard
            key={coin.address}
            coin={coin}
            rank={showRank ? i : undefined}
            featured={i === 0}
          />
        ))}
      </div>
    </section>
  );
}
