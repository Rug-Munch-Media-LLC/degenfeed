'use client';

import { useEffect, useRef } from 'react';
import type { TradeEvent } from '../../hooks/useBondingCurve';

interface TradeFeedProps {
  trades: TradeEvent[];
  maxItems?: number;
  loading?: boolean;
  className?: string;
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function formatAmount(usd: number): string {
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(2)}`;
}

export default function TradeFeed({
  trades,
  maxItems = 50,
  loading = false,
  className = '',
}: TradeFeedProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(trades.length);

  // Auto-scroll to top when new trades arrive
  useEffect(() => {
    if (trades.length > prevLengthRef.current && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevLengthRef.current = trades.length;
  }, [trades.length]);

  const displayTrades = trades.slice(0, maxItems);

  // Loading skeleton
  if (loading && trades.length === 0) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center gap-2 px-1 py-2">
          <span className="h-2 w-2 rounded-full bg-degen-500 animate-pulse" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Live Trades
          </span>
          <span className="text-[10px] text-[var(--color-muted)]">(loading...)</span>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  // Empty state
  if (trades.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center ${className}`}
      >
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-glow)]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-degen-400"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <p className="text-xs text-[var(--color-muted)]">No trades yet</p>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">Be the first to buy!</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-1 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-degen-500" />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Live Trades
        </span>
        <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
          ({trades.length})
        </span>
      </div>

      {/* Trade list — scrollable */}
      <div
        ref={listRef}
        className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain"
        style={{ maxHeight: 400 }}
      >
        {displayTrades.map((trade, i) => (
          <div
            key={trade.id || `${trade.txHash}-${i}`}
            className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--color-overlay)]"
          >
            {/* Buy/sell indicator */}
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                trade.type === 'buy'
                  ? 'bg-degen-500/15 text-degen-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {trade.type === 'buy' ? '↑' : '↓'}
            </span>

            {/* Wallet address */}
            <span className="min-w-0 flex-1 font-mono text-xs tabular-nums text-[var(--color-fg)]">
              {shortenAddress(trade.wallet)}
            </span>

            {/* Amount */}
            <span
              className={`shrink-0 text-right text-xs font-medium tabular-nums ${
                trade.type === 'buy' ? 'text-degen-400' : 'text-red-400'
              }`}
            >
              {formatAmount(trade.usdValue)}
            </span>

            {/* Token amount */}
            <span className="hidden w-20 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-muted)] sm:block">
              {Number.parseFloat(trade.tokenAmount).toFixed(2)}
            </span>

            {/* Time */}
            <span className="hidden w-14 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-muted)] md:block">
              {formatTime(trade.timestamp)}
            </span>
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 border-t border-[var(--color-border)] px-1 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-degen-500 animate-pulse" />
        <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Real-time
        </span>
        <span className="text-[9px] text-[var(--color-muted)]">· updated 3s</span>
      </div>
    </div>
  );
}
