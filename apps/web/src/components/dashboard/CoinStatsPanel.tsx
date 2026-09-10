'use client';

/**
 * CoinStatsPanel — Creator coin bonding curve progress, holders, volume
 *
 * Shows the bonding curve progress bar, key coin metrics, and top holder
 * distribution when a creator has deployed a coin.
 */

import type { CoinAnalytics } from '../../hooks/useAnalytics';

interface CoinStatsPanelProps {
  coin: CoinAnalytics | null | undefined;
  loading?: boolean;
}

/** Protocol colors reused for chain badges */
const CHAIN_COLORS: Record<string, string> = {
  base: '#0052FF',
  solana: '#9945FF',
  ethereum: '#627EEA',
};

export function CoinStatsPanel({ coin, loading = false }: CoinStatsPanelProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-[var(--color-muted)]/20 mb-4" />
        <div className="space-y-3">
          <div className="h-3 w-full rounded bg-[var(--color-muted)]/10" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 rounded bg-[var(--color-muted)]/10" />
            <div className="h-12 rounded bg-[var(--color-muted)]/10" />
            <div className="h-12 rounded bg-[var(--color-muted)]/10" />
            <div className="h-12 rounded bg-[var(--color-muted)]/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!coin || !coin.exists) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">Creator Coin</h3>
        <p className="text-xs text-[var(--color-muted)]">
          No creator coin deployed yet.{' '}
          <a href="/creator?tab=coin" className="text-[var(--color-accent)] hover:underline">
            Launch your coin
          </a>{' '}
          to unlock bonding curve analytics.
        </p>
      </div>
    );
  }

  const curvePercent = coin.bondingCurveProgress ?? 0;
  const graduated = coin.graduated ?? false;

  function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  }

  function formatUsd(n: number | null): string {
    if (n === null || n === undefined) return '—';
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }

  // Determine curve color
  const curveColor = graduated
    ? '#16a34a'
    : curvePercent >= 80
      ? '#eab308'
      : curvePercent >= 50
        ? '#3b82f6'
        : '#8b5cf6';

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-2">
          <span>{coin.name ?? coin.symbol ?? 'Creator Coin'}</span>
          {coin.symbol && (
            <span className="text-xs text-[var(--color-muted)] font-mono">${coin.symbol}</span>
          )}
        </h3>

        {/* Chain badges */}
        <div className="flex gap-1.5">
          {coin.chains.map((chain) => (
            <span
              key={chain.chain}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${CHAIN_COLORS[chain.chain] ?? '#888'}20`,
                color: CHAIN_COLORS[chain.chain] ?? '#888',
              }}
            >
              {chain.chain === 'base' ? 'Base' : chain.chain === 'solana' ? 'Solana' : chain.chain}
            </span>
          ))}
        </div>
      </div>

      {/* Bonding curve progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Bonding Curve
          </span>
          <span className="text-[11px] font-mono text-[var(--color-fg)]">
            {graduated ? 'GRADUATED' : `${curvePercent.toFixed(0)}%`}
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${graduated ? 100 : Math.min(curvePercent, 100)}%`,
              backgroundColor: curveColor,
            }}
          />
        </div>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          {graduated
            ? 'This coin has graduated and is now trading on a DEX with full liquidity.'
            : `The bonding curve is ${curvePercent.toFixed(0)}% complete. At 100%, liquidity migrates to a DEX.`}
        </p>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricBox label="Holders" value={formatCompact(coin.holders)} />
        <MetricBox
          label="24h Volume"
          value={formatUsd(coin.volume24h)}
          tooltip="Total trading volume in the last 24 hours across all chains"
        />
        <MetricBox
          label="Market Cap"
          value={formatUsd(coin.marketCap)}
          tooltip="Current market capitalization based on token price and circulating supply"
        />
        <MetricBox label="Price" value={coin.priceUsd !== null ? formatUsd(coin.priceUsd) : '—'} />
      </div>

      {/* Top holders */}
      {coin.topHolders.length > 0 && (
        <div className="mt-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Top Holders
          </span>
          <div className="mt-1.5 space-y-1">
            {coin.topHolders.slice(0, 5).map((holder, i) => (
              <div key={holder.address} className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[var(--color-muted)] truncate max-w-[140px]">
                  {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                </span>
                <span className="text-[var(--color-fg)] font-medium">
                  {holder.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade velocity */}
      {coin.tradeVelocity24h > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-muted)]">Trade Velocity</span>
            <span className="font-mono text-[var(--color-fg)]">
              {coin.tradeVelocity24h.toFixed(2)}x
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
            Ratio of 24h volume to market cap. Higher = more active trading.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Metric sub-component ──────────────────────────────────────────

function MetricBox({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/50 p-2.5">
      <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-1">
        {label}
        {tooltip && (
          <span
            className="relative flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-[var(--color-muted)]/10 text-[8px] text-[var(--color-muted)]"
            tabIndex={0}
            role="tooltip"
            aria-label={tooltip}
          >
            ?
            <span className="invisible group-hover:visible absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 w-36 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 text-[10px] leading-relaxed text-[var(--color-muted)] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              {tooltip}
            </span>
          </span>
        )}
      </span>
      <span className="text-sm font-bold text-[var(--color-fg)] font-mono">{value}</span>
    </div>
  );
}
