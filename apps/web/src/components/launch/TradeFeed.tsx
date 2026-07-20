'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TradeEvent } from '../../hooks/useBondingCurve';
import { useIsMobile } from '../../hooks/useMobileResponsive';

interface TradeFeedProps {
  trades: TradeEvent[];
  maxItems?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;

  // == New Features ======================================

  /** Number of people who bought in the last 60 seconds */
  boughtLast60s?: number;
  /** Number of people currently viewing this page */
  viewersNow?: number;
  /** Number of people who hold this on Farcaster */
  farcasterHolders?: number;
  /** Whether this coin is trending on Zora/Base */
  isTrending?: boolean;
  /** Activity heatmap data (0-23) */
  activityHeatmap?: number[];
  /** User's streak days */
  userStreakDays?: number;
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

// == Whale Alert Component ================================

function WhaleAlertBanner({ usdValue, wallet }: { usdValue: number; wallet: string }) {
  const isMega = usdValue >= 10_000;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1 animate-whale-alert ${
        isMega
          ? 'bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 border border-purple-500/30'
          : 'bg-gradient-to-r from-degen-500/10 via-yellow-500/10 to-degen-500/10 border border-degen-500/20'
      }`}
    >
      <span className={`text-lg ${isMega ? 'animate-pulse' : ''}`}>
        {isMega ? '🐋💎' : '🐋'}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${isMega ? 'text-purple-400' : 'text-degen-400'}`}>
          {isMega ? 'MEGA WHALE ALERT' : 'WHALE ALERT'}
        </p>
        <p className="text-[10px] text-[var(--color-muted)] truncate">
          {shortenAddress(wallet)} bought {formatAmount(usdValue)}
        </p>
      </div>
      {isMega && (
        <span className="text-[8px] font-bold text-purple-400 animate-pulse">● LIVE</span>
      )}
    </div>
  );
}

// == Social proof bar ====================================

function SocialProofBar({
  boughtLast60s,
  viewersNow,
  farcasterHolders,
  isTrending,
}: {
  boughtLast60s?: number;
  viewersNow?: number;
  farcasterHolders?: number;
  isTrending?: boolean;
}) {
  const hasAny = boughtLast60s || viewersNow || farcasterHolders || isTrending;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 py-1.5 border-b border-[var(--color-border)]">
      {boughtLast60s !== undefined && boughtLast60s > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium text-degen-400">
          <span className="h-1.5 w-1.5 rounded-full bg-degen-500 animate-pulse" />
          {boughtLast60s} bought in 60s
        </span>
      )}
      {viewersNow !== undefined && viewersNow > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium text-blue-400">
          👁️ {viewersNow} watching
        </span>
      )}
      {farcasterHolders !== undefined && farcasterHolders > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium text-purple-400">
          🌐 {farcasterHolders} on FC
        </span>
      )}
      {isTrending && (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium text-orange-400">
          📈 Trending
        </span>
      )}
    </div>
  );
}

// == Activity heatmap =====================================

function ActivityHeatmap({ data }: { data?: number[] }) {
  if (!data?.length) return null;

  const maxVal = Math.max(...data, 1);
  const hours = ['12a', '', '2a', '', '4a', '', '6a', '', '8a', '', '10a', '', '12p', '', '2p', '', '4p', '', '6p', '', '8p', '', '10p', ''];

  return (
    <div className="flex items-end gap-[1px] px-1 py-1">
      {data.slice(0, 24).map((val, i) => (
        <div
          key={`hm-${i}`}
          className="group relative flex-1"
        >
          <div
            className="w-full rounded-sm transition-all duration-300"
            style={{
              height: `${Math.max(2, (val / maxVal) * 16)}px`,
              backgroundColor: val > maxVal * 0.7
                ? 'var(--color-accent)'
                : val > maxVal * 0.3
                  ? 'var(--color-accent-dim)'
                  : 'var(--color-muted-bg)',
              opacity: val > 0 ? 0.7 : 0.3,
            }}
          />
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[var(--color-card)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[7px] whitespace-nowrap z-20">
            {hours[i]}: {val} trades
          </div>
        </div>
      ))}
    </div>
  );
}

// == Main Component =======================================

export default function TradeFeed({
  trades,
  maxItems,
  loading = false,
  error = null,
  onRetry,
  className = '',
  boughtLast60s,
  viewersNow,
  farcasterHolders,
  isTrending,
  activityHeatmap,
  userStreakDays,
}: TradeFeedProps) {
  const isMobile = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(trades.length);
  const [lastWhaleAlert, setLastWhaleAlert] = useState<TradeEvent | null>(null);
  const [showWhaleAnim, setShowWhaleAnim] = useState(false);

  // Responsive max items
  const responsiveMax = maxItems ?? (isMobile ? 10 : 50);

  // Auto-scroll to top when new trades arrive
  useEffect(() => {
    if (trades.length > prevLengthRef.current && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevLengthRef.current = trades.length;
  }, [trades.length]);

  // Detect whale trades
  useEffect(() => {
    if (trades.length === 0) return;
    const latest = trades[0];
    if (!latest) return;

    const usdVal = latest.usdValue;
    if (usdVal >= 1000 && latest.type === 'buy') {
      setLastWhaleAlert(latest);
      setShowWhaleAnim(true);
      const timer = setTimeout(() => setShowWhaleAnim(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [trades]);

  // Separate whale trades for display
  const { whaleTrades, normalTrades } = useMemo(() => {
    const whales: TradeEvent[] = [];
    const normal: TradeEvent[] = [];
    for (const t of trades) {
      if (t.usdValue >= 1000 && t.type === 'buy') {
        whales.push(t);
      } else {
        normal.push(t);
      }
    }
    return { whaleTrades: whales.slice(0, 3), normalTrades: normal };
  }, [trades]);

  const displayTrades = normalTrades.slice(0, responsiveMax);

  // Loading skeleton
  if (loading && trades.length === 0) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="flex items-center gap-2 px-1 py-2">
          <span className="h-2 w-2 rounded-full bg-degen-500 animate-pulse" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Live Trades
          </span>
          <span className="text-[10px] text-[var(--color-muted)]">(loading...)</span>
        </div>
        <div className="space-y-1">
          {Array.from({ length: isMobile ? 3 : 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 sm:h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center ${className}`}>
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

  // Empty state
  if (trades.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-6 text-center ${className}`}>
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-glow)]">
          <svg
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className="text-degen-400"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <p className="text-xs text-[var(--color-muted)]">No trades yet</p>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">Be the first to buy!</p>
        {/* Show social proof even in empty state */}
        <SocialProofBar
          boughtLast60s={boughtLast60s}
          viewersNow={viewersNow}
          farcasterHolders={farcasterHolders}
          isTrending={isTrending}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Whale alert overlay */}
      {showWhaleAnim && lastWhaleAlert && (
        <div className="px-1 mb-1">
          <WhaleAlertBanner usdValue={lastWhaleAlert.usdValue} wallet={lastWhaleAlert.wallet} />
        </div>
      )}

      {/* Whale trade summaries */}
      {whaleTrades.length > 0 && (
        <div className="px-1 space-y-0.5 mb-1">
          {whaleTrades.map((wt, i) => (
            <div
              key={`whale-${wt.id || i}`}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-degen-500/5 to-transparent px-2 py-1"
            >
              <span className="text-sm">🐋</span>
              <span className="font-mono text-[10px] text-degen-400 font-bold">
                {shortenAddress(wt.wallet)}
              </span>
              <span className="text-xs font-bold text-degen-400 ml-auto">
                +{formatAmount(wt.usdValue)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Social proof bar */}
      <SocialProofBar
        boughtLast60s={boughtLast60s}
        viewersNow={viewersNow}
        farcasterHolders={farcasterHolders}
        isTrending={isTrending}
      />

      {/* Activity heatmap */}
      {activityHeatmap && !isMobile && (
        <ActivityHeatmap data={activityHeatmap} />
      )}

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

        {/* Streak badge */}
        {userStreakDays !== undefined && userStreakDays >= 2 && (
          <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[7px] sm:text-[8px] font-medium text-orange-400">
            🔥 {userStreakDays}d
          </span>
        )}

        {/* Bought last 60s badge */}
        {boughtLast60s !== undefined && boughtLast60s > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-degen-500/10 px-1.5 py-0.5 text-[7px] sm:text-[8px] font-medium text-degen-400">
            ⚡ {boughtLast60s}/60s
          </span>
        )}
      </div>

      {/* Trade list */}
      <div
        ref={listRef}
        className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain"
        style={{ maxHeight: isMobile ? '40vh' : 400 }}
      >
        {displayTrades.map((trade, i) => {
          const usdVal = trade.usdValue;
          const isWhale = usdVal >= 1000;
          const isMegaWhale = usdVal >= 10000;
          const hasDiscount = trade.flashSaleDiscount || trade.creatorEventDiscount;

          return (
            <div
              key={trade.id || `${trade.txHash}-${i}`}
              className={`group flex items-center gap-2 rounded-lg px-2 py-2 sm:py-2.5 transition-colors hover:bg-[var(--color-overlay)] ${
                isWhale ? 'bg-degen-500/5 border-l-2 border-degen-400' : ''
              } ${isMegaWhale ? 'bg-purple-500/5 border-l-2 border-purple-400' : ''}`}
              style={{ minHeight: 44 }}
            >
              {/* Buy/sell indicator */}
              <span
                className={`flex h-7 w-7 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                  trade.type === 'buy'
                    ? isWhale
                      ? 'bg-degen-500/20 text-degen-400'
                      : 'bg-degen-500/15 text-degen-400'
                    : 'bg-red-500/15 text-red-400'
                }`}
              >
                {trade.type === 'buy' ? (isWhale ? '🐋' : '↑') : '↓'}
              </span>

              {/* Wallet address */}
              <span className="min-w-0 flex-1 font-mono text-xs tabular-nums text-[var(--color-fg)] truncate">
                {shortenAddress(trade.wallet)}
              </span>

              {/* Discount badges */}
              {hasDiscount && (
                <span className="shrink-0 rounded bg-yellow-500/10 px-1 py-0.5 text-[7px] font-medium text-yellow-400">
                  ⚡{trade.flashSaleDiscount ?? trade.creatorEventDiscount}%
                </span>
              )}

              {/* Amount */}
              <span
                className={`shrink-0 text-right text-xs font-medium tabular-nums ${
                  trade.type === 'buy' ? 'text-degen-400' : 'text-red-400'
                } ${isWhale ? 'font-bold' : ''}`}
              >
                {formatAmount(trade.usdValue)}
              </span>

              {/* Token amount */}
              <span className="hidden sm:block w-20 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-muted)]">
                {Number.parseFloat(trade.tokenAmount).toFixed(2)}
              </span>

              {/* Time + streak */}
              <span className="hidden md:flex w-16 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-muted)] items-center justify-end gap-1">
                {formatTime(trade.timestamp)}
                {trade.streakDays && trade.streakDays >= 2 && (
                  <span className="text-[7px] text-orange-400">🔥{trade.streakDays}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live indicator */}
      <div
        className={`flex items-center gap-1.5 border-t border-[var(--color-border)] px-1 py-1.5 ${
          isMobile ? 'sticky-bottom-mobile' : ''
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-degen-500 animate-pulse" />
        <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Real-time
        </span>
        <span className="text-[9px] text-[var(--color-muted)]">· updated 3s</span>

        {/* Viewers count */}
        {viewersNow !== undefined && viewersNow > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[8px] text-blue-400">
            👁️ {viewersNow}
          </span>
        )}

        {/* Farcaster count */}
        {farcasterHolders !== undefined && farcasterHolders > 0 && (
          <span className="inline-flex items-center gap-1 text-[8px] text-purple-400">
            🌐 {farcasterHolders}
          </span>
        )}
      </div>
    </div>
  );
}
