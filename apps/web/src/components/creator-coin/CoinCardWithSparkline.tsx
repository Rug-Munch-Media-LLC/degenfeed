'use client';

/**
 * CoinCard with sparkline chart — enhanced version of the basic CoinCard.
 * Shows: sparkline, price, 24h change, market cap, holders, bonding progress.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import { Sparkline } from './Sparkline';

export interface CoinDisplayData {
  address: string;
  name: string;
  symbol: string;
  chain: 'solana' | 'base';
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  holderCount: number;
  totalSupply: number;
  graduated: boolean;
  bondingPhase: number;
  createdAt: number;
  creator?: string;
  isLive?: boolean;
}

export function CoinCardWithSparkline({ coin }: { coin: CoinDisplayData }) {
  // Generate mock sparkline data based on price change direction
  const sparklineData = useMemo(() => {
    const trend = coin.priceChange24h >= 0 ? 1 : -1;
    const volatility = Math.abs(coin.priceChange24h) / 100;
    let price = 50;
    return Array.from({ length: 24 }, () => {
      const drift = trend * volatility * 10 + (Math.random() - 0.5) * volatility * 20;
      price = Math.max(5, Math.min(95, price + drift));
      return price;
    });
  }, [coin.priceChange24h]);

  const isUp = coin.priceChange24h >= 0;
  const sparkColor = isUp ? '#00ff41' : '#ff4444';
  const sparkFill = isUp ? '#00ff41' : '#ff4444';

  return (
    <Link
      href={`/coins/${coin.symbol}`}
      className="group block rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.06)]"
    >
      {/* Header: symbol + chain badge */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xs font-bold text-degen-400">
            {coin.symbol.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--color-fg)]">${coin.symbol}</div>
            <div className="text-[10px] text-[var(--color-muted)] truncate max-w-[120px]">
              {coin.name}
            </div>
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

      {/* Sparkline + Price */}
      <div className="mb-2 flex items-center justify-between">
        <Sparkline
          data={sparklineData}
          width={80}
          height={28}
          color={sparkColor}
          fillColor={sparkFill}
        />
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
            ${coin.price < 0.0001 ? '<0.0001' : coin.price.toFixed(6)}
          </div>
          <div className={`text-[10px] font-semibold ${isUp ? 'text-degen-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}
            {coin.priceChange24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-2 grid grid-cols-3 gap-1 text-[9px] text-[var(--color-muted)]">
        <div>
          <div className="font-medium">MCap</div>
          <div className="tabular-nums text-[var(--color-fg)]">
            {coin.marketCap >= 1_000_000
              ? `$${(coin.marketCap / 1_000_000).toFixed(1)}M`
              : coin.marketCap >= 1_000
                ? `$${(coin.marketCap / 1_000).toFixed(1)}K`
                : `$${coin.marketCap.toFixed(0)}`}
          </div>
        </div>
        <div>
          <div className="font-medium">Volume</div>
          <div className="tabular-nums text-[var(--color-fg)]">
            {coin.volume24h >= 1_000_000
              ? `$${(coin.volume24h / 1_000_000).toFixed(1)}M`
              : coin.volume24h >= 1_000
                ? `$${(coin.volume24h / 1_000).toFixed(1)}K`
                : `$${coin.volume24h.toFixed(0)}`}
          </div>
        </div>
        <div>
          <div className="font-medium">Holders</div>
          <div className="tabular-nums text-[var(--color-fg)]">{coin.holderCount}</div>
        </div>
      </div>

      {/* Bonding progress bar */}
      <div>
        <div className="flex items-center justify-between text-[8px] text-[var(--color-muted)]">
          <span>Bonding</span>
          <span>{coin.graduated ? '100%' : `${(coin.bondingPhase + 1) * 20}%`}</span>
        </div>
        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
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

      {/* Live badge */}
      {coin.isLive && (
        <div className="mt-2 flex items-center gap-1 text-[9px] text-red-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          Creator is LIVE — 2% off!
        </div>
      )}
    </Link>
  );
}
