'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

interface CoinData {
  symbol: string;
  name: string;
  description: string;
  marketCap: number;
  fdv: number;
  volume24h: number;
  holders: number;
  holderGrowth24h: number;
  buySellRatio: number;
  concentrationIndex: number;
  price: number;
  priceChange24h: number;
  phase: string;
  phaseProgress: number;
  supplyBurned: number;
  creatorAllocation: number;
  creatorVested: number;
  chain: string;
  createdAt: string;
  color: string;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  wallet: string;
  amount: number;
  valueUsd: number;
  time: string;
  isLarge: boolean;
}

interface HolderBucket {
  label: string;
  count: number;
  pct: number;
  color: string;
}

interface TopHolder {
  rank: number;
  address: string;
  balance: number;
  pct: number;
  isCreator: boolean;
  isBurned: boolean;
}

/* ─── Mock Data ────────────────────────────────────────────────── */

const COIN_DATABASE: Record<string, CoinData> = {
  TICKER: {
    symbol: 'TICKER',
    name: 'Token Ticker',
    description:
      'The ultimate degen creator coin on Base. Low tax, anti-whale, built for the community.',
    marketCap: 2450000,
    fdv: 10000000,
    volume24h: 142000,
    holders: 1876,
    holderGrowth24h: 34,
    buySellRatio: 1.42,
    concentrationIndex: 18.5,
    price: 0.0245,
    priceChange24h: 12.3,
    phase: 'Moonshot',
    phaseProgress: 72,
    supplyBurned: 125000,
    creatorAllocation: 5,
    creatorVested: 60,
    chain: 'Base',
    createdAt: '2025-03-15',
    color: 'var(--color-accent)',
  },
  DEGEN: {
    symbol: 'DEGEN',
    name: 'DegenFeed Token',
    description: 'Platform token powering the DegenFeed ecosystem. Earn, tip, and trade.',
    marketCap: 5200000,
    fdv: 20000000,
    volume24h: 310000,
    holders: 4200,
    holderGrowth24h: 89,
    buySellRatio: 1.18,
    concentrationIndex: 12.1,
    price: 0.052,
    priceChange24h: -2.4,
    phase: 'Moonshot',
    phaseProgress: 94,
    supplyBurned: 450000,
    creatorAllocation: 8,
    creatorVested: 75,
    chain: 'Base',
    createdAt: '2025-01-10',
    color: 'var(--color-accent-secondary)',
  },
  CRE8: {
    symbol: 'CRE8',
    name: 'Create Coin',
    description:
      'Creator-focused token enabling cross-protocol tipping and gated content on Solana.',
    marketCap: 890000,
    fdv: 5000000,
    volume24h: 44000,
    holders: 624,
    holderGrowth24h: 12,
    buySellRatio: 1.65,
    concentrationIndex: 25.3,
    price: 0.0089,
    priceChange24h: 5.7,
    phase: 'Launch',
    phaseProgress: 34,
    supplyBurned: 25000,
    creatorAllocation: 10,
    creatorVested: 40,
    chain: 'Solana',
    createdAt: '2025-06-01',
    color: 'var(--color-protocol-nostr)',
  },
};

/* ─── Candlestick Charts ───────────────────────────────────────── */

function generateCandles(price: number, volatility: number, count: number): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = price * 0.9;
  for (let i = 0; i < count; i++) {
    const open = currentPrice;
    const change = (Math.random() - 0.48) * volatility * open;
    const close = open + change;
    const high = Math.max(open, close) + Math.abs(change) * Math.random() * 0.5;
    const low = Math.min(open, close) - Math.abs(change) * Math.random() * 0.5;
    const volume = 10000 + Math.random() * 90000;
    candles.push({
      time: `${i}h`,
      open,
      high,
      low,
      close,
      volume,
    });
    currentPrice = close;
  }
  return candles;
}

/* ─── Protocol / Chain Helpers ────────────────────────────────── */

function chainColor(c: string): string {
  return c === 'Solana' ? '#9945ff' : 'var(--color-accent)';
}

/* ─── Sub-Components ──────────────────────────────────────────── */

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20">
      {accent && (
        <div
          className="absolute right-0 top-0 h-0.5 w-full opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accent})` }}
        />
      )}
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-black tabular-nums ${accent ? '' : 'text-[var(--color-fg)]'}`}
        style={accent ? { color: accent } : {}}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[9px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

function CandlestickChart({ candles }: { candles: Candle[]; color?: string }) {
  const w = 600;
  const h = 200;
  const pad = { top: 12, right: 8, bottom: 20, left: 40 };

  const maxPrice = Math.max(...candles.map((c) => c.high));
  const minPrice = Math.min(...candles.map((c) => c.low));
  const range = maxPrice - minPrice || 1;
  const _maxVol = Math.max(...candles.map((c) => c.volume), 1);

  const xScale = (i: number) => pad.left + (i / candles.length) * (w - pad.left - pad.right);
  const yScale = (v: number) =>
    pad.top + h - pad.bottom - ((v - minPrice) / range) * (h - pad.top - pad.bottom);
  const candleW = Math.max(3, ((w - pad.left - pad.right) / candles.length) * 0.6);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Candlestick chart with ${candles.length} periods`}
    >
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={pad.left}
            y1={pad.top + (1 - f) * (h - pad.top - pad.bottom)}
            x2={w - pad.right}
            y2={pad.top + (1 - f) * (h - pad.top - pad.bottom)}
            stroke="var(--color-glass-border)"
            strokeWidth="0.5"
            opacity="0.4"
          />
          <text
            x={pad.left - 4}
            y={pad.top + (1 - f) * (h - pad.top - pad.bottom) + 3}
            textAnchor="end"
            fill="var(--color-muted)"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            ${(minPrice + f * range).toFixed(4)}
          </text>
        </g>
      ))}

      {/* Candles */}
      {candles.map((c, i) => {
        const x = xScale(i);
        const isUp = c.close >= c.open;
        const candleColor = isUp ? 'var(--color-accent)' : 'var(--color-danger)';
        const bodyTop = yScale(Math.max(c.open, c.close));
        const bodyBottom = yScale(Math.min(c.open, c.close));
        const bodyH = Math.max(bodyBottom - bodyTop, 1);

        return (
          <g key={i}>
            {/* Wick */}
            <line
              x1={x + candleW / 2}
              y1={yScale(c.high)}
              x2={x + candleW / 2}
              y2={yScale(c.low)}
              stroke={candleColor}
              strokeWidth="1"
            />
            {/* Body */}
            <rect x={x} y={bodyTop} width={candleW} height={bodyH} fill={candleColor} rx="0.5" />
          </g>
        );
      })}
    </svg>
  );
}

function VolumeChart({ candles }: { candles: Candle[] }) {
  const w = 600;
  const h = 50;
  const pad = { left: 40, right: 8 };
  const maxVol = Math.max(...candles.map((c) => c.volume), 1);
  const barW = Math.max(2, ((w - pad.left - pad.right) / candles.length) * 0.6);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Volume chart"
    >
      {candles.map((c, i) => {
        const hPx = (c.volume / maxVol) * (h - 4);
        return (
          <rect
            key={i}
            x={pad.left + i * ((w - pad.left - pad.right) / candles.length)}
            y={h - 2 - hPx}
            width={barW}
            height={hPx}
            fill="var(--color-accent-secondary)"
            opacity={0.5}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

/* ─── Trading Activity ────────────────────────────────────────── */

const RECENT_TRADES: Trade[] = [
  {
    id: '1',
    type: 'buy',
    wallet: '0x1234...5678',
    amount: 5000,
    valueUsd: 122,
    time: '2m ago',
    isLarge: false,
  },
  {
    id: '2',
    type: 'sell',
    wallet: '5Yw4...H3mN',
    amount: 1200,
    valueUsd: 29,
    time: '5m ago',
    isLarge: false,
  },
  {
    id: '3',
    type: 'buy',
    wallet: '0xabcd...ef01',
    amount: 25000,
    valueUsd: 612,
    time: '8m ago',
    isLarge: true,
  },
  {
    id: '4',
    type: 'buy',
    wallet: '0x9876...5432',
    amount: 800,
    valueUsd: 19,
    time: '12m ago',
    isLarge: false,
  },
  {
    id: '5',
    type: 'sell',
    wallet: 'bc1q...9xyz',
    amount: 3500,
    valueUsd: 85,
    time: '15m ago',
    isLarge: false,
  },
  {
    id: '6',
    type: 'buy',
    wallet: '0x2468...1357',
    amount: 100000,
    valueUsd: 2450,
    time: '22m ago',
    isLarge: true,
  },
  {
    id: '7',
    type: 'sell',
    wallet: '0x5678...9012',
    amount: 1800,
    valueUsd: 44,
    time: '30m ago',
    isLarge: false,
  },
];

/* ─── Holder Distribution ──────────────────────────────────────── */

const HOLDER_BUCKETS: HolderBucket[] = [
  { label: '0-100', count: 892, pct: 47.5, color: 'var(--color-accent)' },
  { label: '100-1K', count: 624, pct: 33.3, color: 'var(--color-accent-secondary)' },
  { label: '1K-10K', count: 284, pct: 15.1, color: 'var(--color-protocol-farcaster)' },
  { label: '10K+', count: 76, pct: 4.1, color: 'var(--color-protocol-nostr)' },
];

const TOP_HOLDERS: TopHolder[] = [
  {
    rank: 1,
    address: '0x1234...5678',
    balance: 850000,
    pct: 8.5,
    isCreator: true,
    isBurned: false,
  },
  {
    rank: 2,
    address: '0xdead...0000',
    balance: 125000,
    pct: 1.25,
    isCreator: false,
    isBurned: true,
  },
  {
    rank: 3,
    address: '0xabcd...ef01',
    balance: 92000,
    pct: 0.92,
    isCreator: false,
    isBurned: false,
  },
  { rank: 4, address: '5Yw4...H3mN', balance: 78400, pct: 0.78, isCreator: false, isBurned: false },
  {
    rank: 5,
    address: '0x9876...5432',
    balance: 65000,
    pct: 0.65,
    isCreator: false,
    isBurned: false,
  },
  { rank: 6, address: 'bc1q...9xyz', balance: 51000, pct: 0.51, isCreator: false, isBurned: false },
  {
    rank: 7,
    address: '0x2468...1357',
    balance: 42000,
    pct: 0.42,
    isCreator: false,
    isBurned: false,
  },
  {
    rank: 8,
    address: '0x5678...9012',
    balance: 38000,
    pct: 0.38,
    isCreator: false,
    isBurned: false,
  },
  {
    rank: 9,
    address: '0xfedc...ba98',
    balance: 29000,
    pct: 0.29,
    isCreator: false,
    isBurned: false,
  },
  {
    rank: 10,
    address: '0x1111...2222',
    balance: 24500,
    pct: 0.25,
    isCreator: false,
    isBurned: false,
  },
];

/* ─── Bonding Curve ───────────────────────────────────────────── */

function BondingCurveViz({
  phase,
  progress,
  supplyBurned,
  creatorAllocation,
  creatorVested,
}: {
  phase: string;
  progress: number;
  supplyBurned: number;
  creatorAllocation: number;
  creatorVested: number;
}) {
  const phases = ['Seed', 'Launch', 'Growth', 'Moonshot', 'Maturity'];
  const currentIdx = phases.indexOf(phase);

  return (
    <div className="space-y-6">
      {/* Phase track */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {phases.map((p, i) => {
            const isComplete = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={p} className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all
                  ${isComplete ? 'bg-degen-500 text-black' : isCurrent ? 'border-2 border-degen-500 bg-degen-500/20 text-degen-400' : 'border border-[var(--color-glass-border)] text-[var(--color-muted)]'}`}
                >
                  {isComplete ? '✓' : i + 1}
                </div>
                <span
                  className={`mt-1 text-[9px] font-medium ${isCurrent ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
                >
                  {p}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-degen-500 to-emerald-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] text-[var(--color-muted)]">
          <span>Progress to next phase</span>
          <span className="font-mono font-semibold text-degen-400">{progress}% complete</span>
        </div>
      </div>

      {/* Price estimates */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Current', price: '$0.0245', color: 'var(--color-accent)' },
          { label: 'Next Phase', price: '$0.048', color: 'var(--color-accent-secondary)' },
          { label: 'Target (FDV)', price: '$0.10', color: 'var(--color-protocol-farcaster)' },
        ].map((p) => (
          <div
            key={p.label}
            className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 text-center"
          >
            <div className="text-[9px] text-[var(--color-muted)]">{p.label}</div>
            <div className="mt-1 text-sm font-bold tabular-nums" style={{ color: p.color }}>
              {p.price}
            </div>
          </div>
        ))}
      </div>

      {/* Supply burned + Creator vesting */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-muted)]">Supply Burned</span>
            <span className="text-xs font-bold text-degen-400">
              {supplyBurned.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
            <div
              className="h-full rounded-full bg-red-500"
              style={{ width: `${(supplyBurned / 10000000) * 100}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-muted)]">Creator Vesting</span>
            <span className="text-xs font-bold text-degen-400">{creatorVested}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-degen-500"
              style={{ width: `${creatorVested}%` }}
            />
          </div>
          <div className="mt-1 text-[9px] text-[var(--color-muted)]">
            {creatorAllocation}% allocation · linear vesting
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────── */

type Timeframe = '1h' | '4h' | '1d';

export default function CoinAnalyticsPage() {
  const params = useParams();
  const symbol = (params?.symbol as string)?.toUpperCase() || 'TICKER';
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const coin = COIN_DATABASE[symbol];

  // Generate different candle counts per timeframe
  const candleCount = timeframe === '1h' ? 24 : timeframe === '4h' ? 30 : 30;
  const volatility = timeframe === '1h' ? 0.02 : timeframe === '4h' ? 0.05 : 0.08;
  const candles = useMemo(
    () => generateCandles(coin?.price || 0.02, volatility, candleCount),
    [coin, volatility, candleCount],
  );

  const recentLargeTrades = RECENT_TRADES.filter((t) => t.isLarge);

  if (!coin) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-glass-border)]">
          <span className="text-2xl">🪙</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Coin not found</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          No analytics available for ${symbol}
        </p>
        <Link href="/creator/coins" className="btn-primary mt-6 inline-flex text-sm">
          View Your Coins
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* ── Breadcrumb + Header ─────────────────────────────── */}
      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/creator" className="hover:text-degen-400 transition-colors">
          Creator Studio
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <Link href="/creator/coins" className="hover:text-degen-400 transition-colors">
          Coins
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-degen-400">${coin.symbol}</span>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
            style={{ backgroundColor: `${coin.color}18` }}
          >
            🪙
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-2xl font-black tracking-tight text-[var(--color-fg)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {coin.name} (${coin.symbol})
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-glass-border)] px-2.5 py-0.5 text-[9px] font-medium text-[var(--color-muted)]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: chainColor(coin.chain) }}
                />
                {coin.chain}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{coin.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-lg font-black tabular-nums ${coin.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
          >
            ${coin.price.toFixed(4)}
          </span>
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${coin.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
              className={coin.priceChange24h >= 0 ? '' : 'rotate-180'}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {coin.priceChange24h >= 0 ? '+' : ''}
            {coin.priceChange24h}%
          </span>
        </div>
      </div>

      {/* ── Coin Health Stats ───────────────────────────────── */}
      <section aria-label="Coin health metrics" className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatTile
            label="Market Cap"
            value={`$${(coin.marketCap / 1e6).toFixed(2)}M`}
            accent={coin.color}
          />
          <StatTile label="FDV" value={`$${(coin.fdv / 1e6).toFixed(2)}M`} />
          <StatTile
            label="24h Volume"
            value={`$${(coin.volume24h / 1e3).toFixed(0)}K`}
            accent="var(--color-accent-tertiary)"
          />
          <StatTile
            label="Holders"
            value={coin.holders.toLocaleString()}
            sub={`+${coin.holderGrowth24h} today`}
            accent="var(--color-protocol-bluesky)"
          />
          <StatTile
            label="Buy/Sell"
            value={coin.buySellRatio.toFixed(2)}
            sub="Buy pressure"
            accent="var(--color-accent)"
          />
          <StatTile
            label="Top 10 Conc."
            value={`${coin.concentrationIndex}%`}
            sub="Holder concentration"
            accent="var(--color-protocol-farcaster)"
          />
        </div>
      </section>

      {/* ── Trading Activity ────────────────────────────────── */}
      <section aria-label="Trading activity" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Trading Activity</h2>
              <div
                className="flex gap-1 rounded-lg border border-[var(--color-glass-border)] p-0.5"
                role="tablist"
                aria-label="Timeframe"
              >
                {(['1h', '4h', '1d'] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    role="tab"
                    aria-selected={timeframe === tf}
                    onClick={() => setTimeframe(tf)}
                    className={`rounded-md px-3 py-1 text-[10px] font-semibold transition-all ${timeframe === tf ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[200px]">
              <CandlestickChart candles={candles} color={coin.color} />
            </div>
            <div className="mt-1 h-[50px]">
              <VolumeChart candles={candles} />
            </div>
          </div>

          {/* Recent trades */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Recent Trades</h2>
              <span className="text-[9px] text-[var(--color-muted)]">Live</span>
            </div>
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto scrollbar-none">
              {RECENT_TRADES.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-[10px]"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[8px] font-bold
                    ${trade.type === 'buy' ? 'bg-degen-500/15 text-degen-400' : 'bg-red-500/15 text-red-400'}`}
                  >
                    {trade.type === 'buy' ? 'B' : 'S'}
                  </span>
                  <span className="font-mono text-[var(--color-muted)]">{trade.wallet}</span>
                  <span
                    className={`tabular-nums font-semibold ${trade.type === 'buy' ? 'text-degen-400' : 'text-red-400'}`}
                  >
                    {trade.type === 'buy' ? '+' : '-'}
                    {trade.amount.toLocaleString()}
                  </span>
                  <span className="text-[var(--color-muted)]">$${trade.valueUsd}</span>
                  <span className="ml-auto text-[var(--color-muted)]">{trade.time}</span>
                  {trade.isLarge && (
                    <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[7px] font-semibold text-yellow-400">
                      1%+
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Large transactions alert */}
            {recentLargeTrades.length > 0 && (
              <div className="mt-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🚨</span>
                  <div>
                    <div className="text-[10px] font-semibold text-yellow-400">
                      Large Transactions
                    </div>
                    <div className="text-[9px] text-[var(--color-muted)]">
                      {recentLargeTrades.length} trades &gt;1% supply in last hour
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Holder Analytics ────────────────────────────────── */}
      <section aria-label="Holder analytics" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Holder Distribution */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Holder Distribution</h2>
            <div className="space-y-3">
              {HOLDER_BUCKETS.map((bucket) => (
                <div key={bucket.label} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-[var(--color-muted)]">{bucket.label}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                    <div
                      className="h-3 rounded-full transition-all duration-700"
                      style={{
                        width: `${bucket.pct}%`,
                        background: `linear-gradient(90deg, ${bucket.color}, ${bucket.color}66)`,
                      }}
                    />
                  </div>
                  <span className="w-14 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
                    {bucket.count.toLocaleString()}
                  </span>
                  <span className="w-10 text-right text-[9px] text-[var(--color-muted)]">
                    {bucket.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Holders */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Top Holders</h2>
              <span className="text-[9px] text-[var(--color-muted)]">
                Top 10 own {coin.concentrationIndex}%
              </span>
            </div>
            <div className="space-y-1.5">
              {TOP_HOLDERS.map((h) => (
                <div
                  key={h.rank}
                  className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-[10px]"
                >
                  <span className="w-4 text-center text-[var(--color-muted)] font-bold">
                    #{h.rank}
                  </span>
                  <span className="font-mono text-[var(--color-muted)] flex-1">
                    {h.address}
                    {h.isCreator && (
                      <span className="ml-1.5 rounded-full bg-degen-500/15 px-1.5 py-0.5 text-[7px] font-bold text-degen-400">
                        YOU
                      </span>
                    )}
                    {h.isBurned && (
                      <span className="ml-1.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[7px] font-bold text-red-400">
                        BURNED
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums font-semibold text-[var(--color-fg)]">
                    {h.balance.toLocaleString()}
                  </span>
                  <span className="text-[var(--color-muted)]">{h.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Additional holder stats */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
            <div className="text-xs mb-1" aria-hidden="true">
              🆕
            </div>
            <div className="text-lg font-black tabular-nums text-[var(--color-fg)]">
              +{coin.holderGrowth24h}
            </div>
            <div className="text-[9px] text-[var(--color-muted)]">New holders (24h)</div>
          </div>
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
            <div className="text-xs mb-1" aria-hidden="true">
              🚪
            </div>
            <div className="text-lg font-black tabular-nums text-[var(--color-fg)]">-8</div>
            <div className="text-[9px] text-[var(--color-muted)]">Churned holders (24h)</div>
          </div>
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
            <div className="text-xs mb-1" aria-hidden="true">
              ⏱️
            </div>
            <div className="text-lg font-black tabular-nums text-[var(--color-fg)]">42 days</div>
            <div className="text-[9px] text-[var(--color-muted)]">Avg holding time</div>
          </div>
        </div>
      </section>

      {/* ── Bonding Curve ───────────────────────────────────── */}
      <section aria-label="Bonding curve" className="mb-8">
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Bonding Curve</h2>
          <div className="max-w-xl">
            <BondingCurveViz
              phase={coin.phase}
              progress={coin.phaseProgress}
              supplyBurned={coin.supplyBurned}
              creatorAllocation={coin.creatorAllocation}
              creatorVested={coin.creatorVested}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
