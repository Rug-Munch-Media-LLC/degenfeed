'use client';

/**
 * CoinCard — unified entry point for creator coin cards.
 *
 * Re-exports both the base card and the sparkline-enhanced variant.
 * Both use the shared CoinDisplayData type for consistency.
 *
 * - CoinCardWithSparkline: Enhanced card with price sparkline chart
 * - CoinCardSimple: Basic card for use in dashboard/grid contexts
 */

import type { CoinDisplayData } from './CoinCardWithSparkline';

export type { CoinDisplayData } from './CoinCardWithSparkline';
export { CoinCardWithSparkline } from './CoinCardWithSparkline';

/* ─── CoinCardSimple — basic card for dashboard/grid ─── */

export interface CoinCardSimpleProps {
  coin: CoinDisplayData;
  onClick?: () => void;
}

export function CoinCardSimple({ coin, onClick }: CoinCardSimpleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block w-full cursor-pointer rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-800 p-4 text-left transition-all duration-200 hover:border-degen-500/50 hover:shadow-lg hover:shadow-degen-500/10"
    >
      {/* Title row */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xs font-bold text-degen-400">
            {coin.symbol.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-bold text-white">${coin.symbol}</div>
            <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{coin.name}</div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
            coin.graduated ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {coin.graduated ? 'DEX' : `Phase ${coin.bondingPhase + 1}`}
        </span>
      </div>

      {/* Price row */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-left">
          <div className="text-lg font-bold text-white">
            ${coin.price < 0.0001 ? '<0.0001' : coin.price.toFixed(6)}
          </div>
          <div
            className={`text-[10px] font-semibold ${coin.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
          >
            {coin.priceChange24h >= 0 ? '+' : ''}
            {coin.priceChange24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Mini stats */}
      <div className="mb-2 grid grid-cols-3 gap-1 text-[9px] text-gray-500">
        <div>
          <div>MCap</div>
          <div className="tabular-nums text-gray-300">
            {coin.marketCap >= 1_000_000
              ? `$${(coin.marketCap / 1_000_000).toFixed(1)}M`
              : coin.marketCap >= 1_000
                ? `$${(coin.marketCap / 1_000).toFixed(1)}K`
                : `$${coin.marketCap.toFixed(0)}`}
          </div>
        </div>
        <div>
          <div>Volume</div>
          <div className="tabular-nums text-gray-300">{coin.volume24h.toLocaleString()}</div>
        </div>
        <div>
          <div>Holders</div>
          <div className="tabular-nums text-gray-300">{coin.holderCount}</div>
        </div>
      </div>

      {/* Bonding progress */}
      <div>
        <div className="flex items-center justify-between text-[8px] text-gray-500">
          <span>Bonding</span>
          <span>{coin.graduated ? '100%' : `${(coin.bondingPhase + 1) * 20}%`}</span>
        </div>
        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${
              coin.graduated
                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                : 'bg-gradient-to-r from-degen-500 to-yellow-500'
            }`}
            style={{ width: coin.graduated ? '100%' : `${(coin.bondingPhase + 1) * 20}%` }}
          />
        </div>
      </div>
    </button>
  );
}
