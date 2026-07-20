'use client';

import Link from 'next/link';
import { formatBondingPrice, formatBondingUsd } from '../../hooks/useBondingCurve';

export interface CoinCardData {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h?: number;
  progress: number;
  totalRaised: number;
  holderCount: number;
  marketCap?: number;
  phase: 'early' | 'growth' | 'late' | 'graduated';
  creator: {
    name: string;
    avatar?: string;
    reputation: number;
  };
  image?: string;
  socialProof?: number;
}

interface CoinCardProps {
  coin: CoinCardData;
  rank?: number;
  featured?: boolean;
  className?: string;
}

const PHASE_BADGES: Record<string, { label: string; color: string }> = {
  early: { label: '🟢 Early', color: 'text-degen-400 bg-degen-500/10' },
  growth: { label: '🟡 Growth', color: 'text-yellow-400 bg-yellow-500/10' },
  late: { label: '🔴 Late', color: 'text-orange-400 bg-orange-500/10' },
  graduated: { label: '✅ Graduated', color: 'text-fuchsia-400 bg-fuchsia-500/10' },
};

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function CoinCard({ coin, rank, featured = false, className = '' }: CoinCardProps) {
  const phaseBadge = (PHASE_BADGES[coin.phase as keyof typeof PHASE_BADGES] ?? PHASE_BADGES.early)!;
  const priceUp = (coin.priceChange24h ?? 0) >= 0;
  const clampedProgress = Math.min(100, Math.max(0, coin.progress));

  return (
    <Link
      href={`/launch/${coin.symbol.toLowerCase()}`}
      className={`group block rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all duration-200 hover:border-degen-500/30 hover:shadow-[0_0_24px_rgba(0,255,65,0.08)] active:scale-[0.99] ${
        featured ? 'border-degen-500/30 bg-degen-500/5' : ''
      } ${className}`}
    >
      <div className="p-3 sm:p-4">
        {/* Top row */}
        <div className="flex items-start gap-2 sm:gap-3">
          {/* Rank badge */}
          {rank !== undefined && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-overlay)] text-[10px] font-bold tabular-nums text-[var(--color-muted)]">
              {rank < 3 ? ['🥇', '🥈', '🥉'][rank] : `#${rank + 1}`}
            </span>
          )}

          {/* Coin image */}
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] bg-gradient-to-br from-degen-500/20 to-purple-500/20">
            {coin.image ? (
              <img
                src={coin.image}
                alt={coin.symbol}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-sm font-bold text-degen-400">{coin.symbol.charAt(0)}</span>
            )}
          </div>

          {/* Name + symbol */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="truncate text-sm font-semibold text-[var(--color-fg)]">{coin.name}</h3>
              <span className="shrink-0 rounded bg-[var(--color-overlay)] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-medium text-[var(--color-muted)]">
                ${coin.symbol}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-[var(--color-muted)]">by {coin.creator.name}</p>
          </div>

          {/* Phase badge */}
          <span
            className={`shrink-0 rounded-full px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-semibold ${phaseBadge.color}`}
          >
            {phaseBadge.label}
          </span>
        </div>

        {/* Price row */}
        <div className="mt-2 sm:mt-3 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold tabular-nums text-[var(--color-fg)]">
              {formatBondingPrice(coin.price)}
            </span>
            {coin.priceChange24h !== undefined && (
              <span
                className={`text-[10px] sm:text-[11px] font-medium tabular-nums ${
                  priceUp ? 'text-degen-400' : 'text-red-400'
                }`}
              >
                {priceUp ? '+' : ''}
                {coin.priceChange24h.toFixed(2)}%
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] tabular-nums text-[var(--color-muted)]">
            {coin.holderCount} holder{coin.holderCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 sm:mt-2.5">
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-[var(--color-muted)]">
            <span>{Math.round(clampedProgress)}% to graduation</span>
            <span>{formatBondingUsd(coin.totalRaised)} raised</span>
          </div>
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted-bg)]"
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(clampedProgress)}% to graduation`}
          >
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                coin.phase === 'early'
                  ? 'from-degen-500 to-degen-400'
                  : coin.phase === 'growth'
                    ? 'from-degen-400 to-yellow-400'
                    : coin.phase === 'late'
                      ? 'from-yellow-400 to-orange-500'
                      : 'from-degen-500 via-purple-500 to-fuchsia-500'
              }`}
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
        </div>

        {/* Social proof */}
        {coin.socialProof !== undefined && coin.socialProof > 0 && (
          <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-[9px] sm:text-[10px] text-degen-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-degen-500" />
            </span>
            {coin.socialProof} people bought recently
          </div>
        )}

        {/* Market cap */}
        {coin.marketCap !== undefined && coin.marketCap > 0 && (
          <div className="mt-0.5 text-[9px] sm:text-[10px] text-[var(--color-muted)]">
            MC: {formatBondingUsd(coin.marketCap)}
          </div>
        )}
      </div>
    </Link>
  );
}
