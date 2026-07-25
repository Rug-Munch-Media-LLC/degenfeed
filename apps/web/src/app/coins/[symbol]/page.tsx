'use client';

/**
 * Coin Detail Page — Price chart, Buy/Sell, Transparency Tools (TASK 5)
 *
 * Features:
 * - Price chart with timeframes (1h, 24h, 7d, 30d, all)
 * - Buy/Sell interface with slippage configuration
 * - Wallet connection requirement for trading
 * - Trading confirmation modal with gas estimate
 * - Holder leaderboard with wallet labels
 * - Transparency Tools: vesting tracker, fee breakdown, supply pie chart,
 *   bundling detection, lock proof, audit trail
 * - Community Trust: fair launch badge, pre-bonding timer, creator verification
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════

interface CoinDetail {
  address: string;
  name: string;
  symbol: string;
  chain: 'solana' | 'base';
  description: string;
  image?: string;
  price: number;
  priceChange24h: number;
  priceChange7d: number;
  priceChange30d: number;
  marketCap: number;
  volume24h: number;
  totalSupply: number;
  holderCount: number;
  graduated: boolean;
  bondingPhase: number;
  creator: string;
  creatorName: string;
  createdAt: number;
  isLive: boolean;
  tags: string[];
  links: { label: string; url: string }[];
}

interface HolderEntry {
  address: string;
  balance: number;
  percentage: number;
  rank: number;
  label?: 'creator' | 'team' | 'lp' | 'dao' | 'community' | 'bundled';
  isBundled?: boolean;
}

interface TradeEntry {
  txHash: string;
  type: 'buy' | 'sell';
  trader: string;
  amount: number;
  price: number;
  timestamp: number;
  usdValue: number;
  traderLabel?: 'creator' | 'team' | 'lp' | 'dao' | 'community' | 'bundled';
}

interface VestingInfo {
  totalLocked: number;
  totalUnlocked: number;
  unlockedPct: number;
  cliffEndDate: string;
  vestingEndDate: string;
  nextUnlockDate: string;
  nextUnlockAmount: number;
}

interface TransparencyScore {
  walletLabeling: number;
  vestingClarity: number;
  feeDisclosure: number;
  supplyAudit: number;
  bundlingDisclosure: number;
  lockProof: number;
  overall: number;
}

// ══════════════════════════════════════════════════════════════════════
// MOCK DATA GENERATORS
// ══════════════════════════════════════════════════════════════════════

function generateMockDetail(symbol: string): CoinDetail {
  return {
    address: `0x${symbol
      .toLowerCase()
      .split('')
      .map((c) => c.charCodeAt(0).toString(16))
      .join('')
      .slice(0, 40)
      .padEnd(40, '0')}`,
    name: `${symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase()} Token`,
    symbol: symbol.toUpperCase(),
    chain: Math.random() > 0.5 ? 'base' : 'solana',
    description: `A community-driven creator coin launching on DegenFeed with a fair bonding curve. Join the pre-bonding phase and be part of the journey to graduation!`,
    price: Math.random() * 0.05 + 0.0001,
    priceChange24h: -20 + Math.random() * 50,
    priceChange7d: -30 + Math.random() * 60,
    priceChange30d: -50 + Math.random() * 100,
    marketCap: 10000 + Math.random() * 5000000,
    volume24h: 1000 + Math.random() * 500000,
    totalSupply: 1_000_000_000,
    holderCount: Math.floor(Math.random() * 500) + 10,
    graduated: Math.random() > 0.7,
    bondingPhase: Math.floor(Math.random() * 5),
    creator: `0x${Math.random().toString(16).slice(2, 42)}`,
    creatorName: `${symbol.toLowerCase()}.eth`,
    createdAt: Date.now() - Math.random() * 86400000 * 30,
    isLive: Math.random() > 0.9,
    tags: ['meme', 'social', 'defi'].slice(0, Math.floor(Math.random() * 3) + 1),
    links: [
      { label: 'Website', url: '#' },
      { label: 'Twitter', url: '#' },
      { label: 'Discord', url: '#' },
    ],
  };
}

function generateMockHoldersWithLabels(): HolderEntry[] {
  const creators = [
    { addr: `0x${'c'.repeat(40)}`, label: 'creator' as const },
    { addr: `0x${'t'.repeat(40)}`, label: 'team' as const },
    { addr: `0x${'l'.repeat(40)}`, label: 'lp' as const },
    { addr: `0x${'d'.repeat(40)}`, label: 'dao' as const },
    { addr: `0x${'b1'.repeat(20)}`, label: 'bundled' as const },
    { addr: `0x${'b2'.repeat(20)}`, label: 'bundled' as const },
    { addr: `0x${'b3'.repeat(20)}`, label: 'bundled' as const },
  ];
  const result: HolderEntry[] = creators.map((c, i) => ({
    address: c.addr,
    balance: [50000000, 15000000, 45000000, 25000000, 20000000, 15000000, 12000000][i],
    percentage: [5, 1.5, 4.5, 2.5, 2.0, 1.5, 1.2][i],
    rank: i + 1,
    label: c.label,
    isBundled: c.label === 'bundled',
  }));
  for (let i = 0; i < 23; i++) {
    const bal = Math.floor(Math.random() * 5000000) + 100000;
    result.push({
      address: `0x${(i + 100).toString(16).padStart(40, '0')}`,
      balance: bal,
      percentage: (bal / 1000000000) * 100,
      rank: result.length + 1,
      label: 'community',
      isBundled: false,
    });
  }
  return result.sort((a, b) => b.balance - a.balance).map((h, i) => ({ ...h, rank: i + 1 }));
}

function generateMockTradesWithLabels(): TradeEntry[] {
  const labeledWallets = [
    { addr: `0x${'c'.repeat(40)}`, label: 'creator' as const },
    { addr: `0x${'t'.repeat(40)}`, label: 'team' as const },
    { addr: `0x${'l'.repeat(40)}`, label: 'lp' as const },
    { addr: `0x${'b1'.repeat(20)}`, label: 'bundled' as const },
    { addr: `0x${'b2'.repeat(20)}`, label: 'bundled' as const },
  ];
  return Array.from({ length: 50 }, (_, i) => {
    const w = labeledWallets[Math.floor(Math.random() * labeledWallets.length)];
    return {
      txHash: `0x${(i + 1).toString(16).padStart(64, '0')}`,
      type: Math.random() > 0.4 ? 'buy' : 'sell',
      trader: w.addr,
      amount: Math.floor(Math.random() * 10000) + 10,
      price: Math.random() * 0.01 + 0.001,
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
      usdValue: Math.random() * 1000 + 10,
      traderLabel: w.label,
    };
  });
}

function generatePriceData(days: number): number[] {
  let price = 50;
  return Array.from({ length: days }, () => {
    price = Math.max(5, Math.min(95, price + (Math.random() - 0.48) * 8));
    return price;
  });
}

function generateVestingInfo(): VestingInfo {
  return {
    totalLocked: 80000000,
    totalUnlocked: 20000000,
    unlockedPct: 20,
    cliffEndDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    vestingEndDate: new Date(Date.now() + 86400000 * 365).toISOString(),
    nextUnlockDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    nextUnlockAmount: 1538461,
  };
}

function generateTransparencyScore(): TransparencyScore {
  return {
    walletLabeling: 95,
    vestingClarity: 90,
    feeDisclosure: 100,
    supplyAudit: 85,
    bundlingDisclosure: 80,
    lockProof: 70,
    overall: 87,
  };
}

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatPrice(p: number): string {
  if (p < 0.00001) return '<$0.00001';
  if (p < 0.001) return p.toFixed(6);
  return p.toFixed(4);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function countdownStr(ms: number): string {
  if (ms <= 0) return 'Complete!';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════

/* ── PriceChart ───────────────────────────────────── */
function PriceChart({
  priceData,
  timeframe,
  onTimeframeChange,
  color,
}: {
  priceData: number[];
  timeframe: string;
  onTimeframeChange: (t: string) => void;
  color: string;
}) {
  const max = Math.max(...priceData, 1);
  const min = Math.min(...priceData, 0);
  const range = max - min || 1;
  const w = 600;
  const h = 200;
  const pointStr = priceData
    .map((v, i) => `${(i / (priceData.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  const fillPoints = `${pointStr} ${w},${h} 0,${h}`;
  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-48"
          preserveAspectRatio="none"
          role="img"
          aria-label="Price chart"
        >
          <polygon points={fillPoints} fill={color} opacity="0.08" />
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointStr}
          />
          {[0.25, 0.5, 0.75].map((y) => (
            <line
              key={y}
              x1={0}
              y1={h - y * h}
              x2={w}
              y2={h - y * h}
              stroke="var(--color-glass-border)"
              strokeWidth="0.5"
              opacity="0.5"
            />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-center gap-1">
        {['1H', '24H', '7D', '30D', 'ALL'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTimeframeChange(t)}
            className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${timeframe === t ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Wallet Label Badge ───────────────────────────── */
function WalletLabelBadge({ label }: { label?: string }) {
  if (!label || label === 'community') return null;
  const styles: Record<string, string> = {
    creator: 'bg-degen-500/15 text-degen-400',
    team: 'bg-blue-500/15 text-blue-400',
    lp: 'bg-purple-500/15 text-purple-400',
    dao: 'bg-amber-500/15 text-amber-400',
    bundled: 'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`rounded px-1 py-0.5 text-[7px] font-semibold ${styles[label] || ''}`}>
      {label}
    </span>
  );
}

/* ── Pie Chart ─────────────────────────────────────── */
function MiniPie({
  data,
  size = 100,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  let cumulative = 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="Supply breakdown"
      role="img"
    >
      {data.map((d) => {
        const pct = d.value / total;
        const startAngle = cumulative * 360;
        cumulative += pct;
        const endAngle = cumulative * 360;
        const startRad = ((startAngle - 90) * Math.PI) / 180;
        const endRad = ((endAngle - 90) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startRad);
        const y1 = cy + r * Math.sin(startRad);
        const x2 = cx + r * Math.cos(endRad);
        const y2 = cy + r * Math.sin(endRad);
        return (
          <path
            key={d.label}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`}
            fill={d.color}
            stroke="var(--color-card)"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}

/* ── Trade Confirm Modal ──────────────────────────── */
function TradeConfirmModal({
  type,
  amount,
  symbol,
  price,
  gasEstimate,
  slippage,
  onConfirm,
  onClose,
}: {
  type: 'buy' | 'sell';
  amount: string;
  symbol: string;
  price: number;
  gasEstimate: string;
  slippage: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const totalCost = Number(amount) * price;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--color-fg)]">
            Confirm {type === 'buy' ? 'Buy' : 'Sell'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-overlay)]"
          >
            ✕
          </button>
        </div>
        <div className="mb-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Action</span>
            <span className={type === 'buy' ? 'text-degen-400' : 'text-red-400'}>
              {type.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Amount</span>
            <span className="font-mono text-[var(--color-fg)]">
              {amount} {symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Price</span>
            <span className="font-mono text-[var(--color-fg)]">${price.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Total</span>
            <span className="font-mono text-[var(--color-fg)]">${totalCost.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Slippage</span>
            <span className="font-mono text-[var(--color-muted)]">{slippage}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Est. Gas</span>
            <span className="font-mono text-[var(--color-muted)]">{gasEstimate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Platform Fee</span>
            <span className="font-mono text-[var(--color-muted)]">0.5%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Creator Fee</span>
            <span className="font-mono text-[var(--color-muted)]">1.0%</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-glass-border)] py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] ${type === 'buy' ? 'bg-gradient-to-r from-degen-600 to-degen-400' : 'bg-gradient-to-r from-red-600 to-rose-500'}`}
          >
            Confirm {type === 'buy' ? 'Buy' : 'Sell'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TRANSPARENCY TOOLS
// ══════════════════════════════════════════════════════════════════════

/* ── Vesting Tracker ─────────────────────────────── */
function VestingTracker({ vesting }: { vesting: VestingInfo }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">🔒 Vesting Tracker</h3>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-degen-400 font-semibold">{vesting.unlockedPct}% Unlocked</span>
        <span className="text-[var(--color-muted)]">
          {(vesting.totalUnlocked / 1e6).toFixed(0)}M / {(vesting.totalLocked / 1e6).toFixed(0)}M
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-degen-400 transition-all duration-700"
          style={{ width: `${vesting.unlockedPct}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]">
        <div>
          <span className="text-[var(--color-muted)]">Cliff</span>
          <p className="font-mono text-[var(--color-fg)]">
            {new Date(vesting.cliffEndDate).toLocaleDateString()}
          </p>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Next unlock</span>
          <p className="font-mono text-degen-400">
            {new Date(vesting.nextUnlockDate).toLocaleDateString()}
          </p>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Vesting ends</span>
          <p className="font-mono text-[var(--color-fg)]">
            {new Date(vesting.vestingEndDate).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Fee Transparency ────────────────────────────── */
function FeeTransparency() {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">💰 Fee Transparency</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] py-1">
          <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
            <span className="h-2 w-2 rounded-full bg-degen-400" /> Creator Fee
          </span>
          <span className="font-mono text-degen-400">1.0%</span>
        </div>
        <div className="flex items-center justify-between text-[10px] py-1">
          <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Platform Fee
          </span>
          <span className="font-mono text-amber-400">0.5%</span>
        </div>
        <div className="flex items-center justify-between text-[10px] py-1">
          <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
            <span className="h-2 w-2 rounded-full bg-purple-400" /> Treasury
          </span>
          <span className="font-mono text-purple-400">0.3%</span>
        </div>
        <div className="flex items-center justify-between text-[10px] py-1">
          <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
            <span className="h-2 w-2 rounded-full bg-blue-400" /> Liquidity
          </span>
          <span className="font-mono text-blue-400">0.2%</span>
        </div>
      </div>
      <p className="mt-2 text-[9px] text-[var(--color-muted)] border-t border-[var(--color-glass-border)] pt-2">
        Total fees: 2.0% — All fees are transparent and on-chain verifiable.
      </p>
    </div>
  );
}

/* ── Supply Breakdown ─────────────────────────────── */
function SupplyBreakdownChart() {
  const data = [
    { label: 'Creator', value: 50000000, color: '#00ff41' },
    { label: 'Team', value: 25000000, color: '#3b82f6' },
    { label: 'LP', value: 45000000, color: '#a855f7' },
    { label: 'DAO', value: 25000000, color: '#f59e0b' },
    { label: 'Bundled', value: 47000000, color: '#ef4444' },
    { label: 'Community', value: 620000000, color: '#334155' },
    { label: 'Burned', value: 50000000, color: '#dc2626' },
  ];
  const total = 1000000000;
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">📊 Supply Breakdown</h3>
      <div className="flex items-center gap-4">
        <MiniPie data={data} size={100} />
        <div className="flex-1 space-y-1">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-1.5 text-[8px]">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="w-12 text-[var(--color-fg)]">{d.label}</span>
              <div className="flex-1 h-1 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(d.value / total) * 100}%`, background: d.color }}
                />
              </div>
              <span className="w-10 text-right font-mono text-[var(--color-muted)]">
                {((d.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Bundling Detection ──────────────────────────── */
function BundlingWarning() {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">⚠️</span>
        <span className="text-xs font-semibold text-red-400">Bundling Detected</span>
        <span className="ml-auto rounded bg-yellow-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-yellow-400">
          Low Risk
        </span>
      </div>
      <p className="text-[9px] text-[var(--color-muted)]">
        3 bundled wallets identified holding ~4.7% of supply. All bundled wallets are labeled below.
      </p>
    </div>
  );
}

/* ── Lock Proof ───────────────────────────────────── */
function LockProofBadge() {
  return (
    <div className="rounded-xl border border-degen-500/20 bg-degen-500/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-degen-500/20">
          <span className="text-[10px]">🔒</span>
        </span>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-degen-400">Lock Proof Verified</span>
            <span className="rounded-full bg-degen-500/15 px-1.5 py-0.5 text-[7px] text-degen-400">
              On-chain
            </span>
          </div>
          <p className="text-[8px] text-[var(--color-muted)]">
            80M tokens locked in audited vesting contract · Linear vesting · Weekly unlocks
          </p>
        </div>
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded-lg bg-degen-500/15 px-2 py-1 text-[8px] font-medium text-degen-400 hover:bg-degen-500/25"
        >
          View ↗
        </a>
      </div>
    </div>
  );
}

/* ── Audit Trail ──────────────────────────────────── */
function AuditTrail() {
  const entries = [
    {
      action: 'Creator Fee Updated',
      value: '100 bps → 150 bps',
      time: '10d ago',
      by: 'DAO Vote #42',
    },
    { action: 'Vesting Cliff Extended', value: '30d → 45d', time: '5d ago', by: 'DAO Vote #47' },
    { action: 'Treasury Grant', value: '500,000 tokens', time: '2d ago', by: 'Multi-sig' },
  ];
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">📋 Audit Trail</h3>
      <div className="space-y-1.5">
        {entries.map((e, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-[var(--color-glass-border)] p-2"
          >
            <span className="mt-0.5 text-[8px]">📝</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-medium text-[var(--color-fg)]">{e.action}</span>
                <span className="text-[7px] text-[var(--color-muted)]">{e.time}</span>
              </div>
              <p className="text-[8px] text-[var(--color-muted)]">
                {e.value} · by {e.by}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Community Trust Features ──────────────────────── */
function CommunityTrust({ detail, vesting }: { detail: CoinDetail; vesting: VestingInfo }) {
  const [voteOpen, setVoteOpen] = useState(true);
  const [voted, setVoted] = useState<'for' | 'against' | null>(null);
  const [preBondingEnds] = useState(Date.now() + 86400000 * 3);
  const countdown = countdownStr(preBondingEnds - Date.now());
  const preBondingComplete = Date.now() > preBondingEnds;

  return (
    <div className="space-y-4">
      {/* Trust Score */}
      <div className="rounded-xl border border-degen-500/20 bg-gradient-to-r from-degen-500/5 to-purple-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-degen-400 bg-degen-500/10">
            <span className="text-lg">🔍</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">Community Trust Dashboard</h3>
            <p className="text-[9px] text-[var(--color-muted)]">
              Full transparency · Wallets labeled · Vesting on-chain · Fees disclosed · No hidden
              supply
            </p>
          </div>
          <div className="ml-auto text-center">
            <div className="text-xl font-black text-degen-400">87</div>
            <div className="text-[8px] text-[var(--color-muted)]">Trust Score</div>
            <div className="h-1 w-16 rounded-full bg-[var(--color-glass-border)] mt-0.5 overflow-hidden">
              <div className="h-full rounded-full bg-degen-400" style={{ width: '87%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Bonding Timer */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-[var(--color-fg)]">⏱️ Pre-Bonding Period</h3>
          {preBondingComplete && (
            <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[8px] font-semibold text-degen-400">
              ✅ Fair Launch Badge
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-degen-400"
                style={{ width: preBondingComplete ? '100%' : '60%' }}
              />
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-[var(--color-fg)]">
            {preBondingComplete ? 'Complete' : countdown}
          </span>
        </div>
        {!preBondingComplete && (
          <p className="mt-1 text-[8px] text-[var(--color-muted)]">
            Trading starts when pre-bonding completes or target raised.
          </p>
        )}
        {preBondingComplete && (
          <p className="mt-1 text-[8px] text-degen-400">
            Pre-bonding completed without issues. Fair launch badge earned.
          </p>
        )}
      </div>

      {/* Creator Verification */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-2 text-xs font-bold text-[var(--color-fg)]">✅ Creator Verification</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { protocol: 'Twitter', status: true, handle: `@${detail.symbol.toLowerCase()}` },
            { protocol: 'Farcaster', status: true, handle: `${detail.symbol.toLowerCase()}.eth` },
            { protocol: 'Discord', status: true, handle: `${detail.creatorName}#0001` },
            { protocol: 'Gitcoin Passport', status: true, score: '85' },
            { protocol: 'ENS', status: true, handle: `${detail.symbol.toLowerCase()}.eth` },
            { protocol: 'DegenFeed', status: true, badge: 'Creator' },
          ].map((v) => (
            <div
              key={v.protocol}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] p-1.5"
            >
              <span className="text-degen-400 text-[8px]">✓</span>
              <span className="text-[8px] text-[var(--color-fg)]">{v.protocol}</span>
              <span className="ml-auto text-[7px] text-[var(--color-muted)] font-mono">
                {v.handle || v.score || v.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Community Vote */}
      {voteOpen && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-[var(--color-fg)]">🗳️ Community Vote</h3>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[8px] text-amber-400">
              Active
            </span>
          </div>
          <p className="text-[9px] text-[var(--color-muted)] mb-2">
            Should the creator fee be reduced from 1.0% to 0.5%?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVoted('for')}
              className={`flex-1 rounded-lg py-2 text-[9px] font-semibold transition-all ${voted === 'for' ? 'bg-degen-500/20 text-degen-400' : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
            >
              👍 For (72%)
            </button>
            <button
              type="button"
              onClick={() => setVoted('against')}
              className={`flex-1 rounded-lg py-2 text-[9px] font-semibold transition-all ${voted === 'against' ? 'bg-red-500/20 text-red-400' : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
            >
              👎 Against (28%)
            </button>
          </div>
          {voted && (
            <p className="mt-2 text-[8px] text-degen-400">
              ✓ Vote cast. 342 holders voted (34% turnout). 2d remaining.
            </p>
          )}
        </div>
      )}

      {/* Revenue Sharing */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-2 text-xs font-bold text-[var(--color-fg)]">💎 Revenue Sharing</h3>
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${detail.graduated ? 'bg-degen-500/20 text-degen-400' : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'}`}
          >
            {detail.graduated ? '✓' : '✗'}
          </span>
          <div>
            <span className="text-[10px] font-medium text-[var(--color-fg)]">
              {detail.graduated ? 'Revenue Sharing Active' : 'Revenue Sharing Not Enabled'}
            </span>
            <p className="text-[8px] text-[var(--color-muted)]">
              {detail.graduated
                ? 'Creator shares 10% of fees with top 100 holders. Claimable weekly.'
                : 'Creator has not enabled revenue sharing. Requires DAO vote.'}
            </p>
          </div>
        </div>
      </div>

      {/* Transparency stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg font-black text-degen-400">95</div>
          <div className="text-[8px] text-[var(--color-muted)]">Wallet Labeling</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg font-black text-degen-400">90</div>
          <div className="text-[8px] text-[var(--color-muted)]">Vesting Clarity</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg font-black text-amber-400">100</div>
          <div className="text-[8px] text-[var(--color-muted)]">Fee Disclosure</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

type TabSection = 'trades' | 'holders' | 'info' | 'transparency' | 'trust';
type DetailTab = 'info' | 'transparency' | 'trust';

export default function CoinDetailPage() {
  const params = useParams();
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : '';

  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [holders, setHolders] = useState<HolderEntry[]>([]);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [vesting] = useState<VestingInfo>(generateVestingInfo);
  const [timeframe, setTimeframe] = useState('24H');

  // Trade UI
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [slippage, setSlippage] = useState(1.0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showSlippageConfig, setShowSlippageConfig] = useState(false);

  const [activeTab, setActiveTab] = useState<DetailTab>('info');

  // Price chart data
  const priceData = useMemo(() => {
    const days =
      timeframe === '1H'
        ? 60
        : timeframe === '24H'
          ? 24
          : timeframe === '7D'
            ? 7
            : timeframe === '30D'
              ? 30
              : 365;
    return generatePriceData(days);
  }, [timeframe]);

  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/creator-coin/info?symbol=${symbol}`);
        if (res.ok) {
          setDetail(await res.json());
        } else {
          setDetail(generateMockDetail(symbol));
        }
      } catch {
        setDetail(generateMockDetail(symbol));
      }
      setHolders(generateMockHoldersWithLabels());
      setTrades(generateMockTradesWithLabels());
      setLoading(false);
    };
    fetchData();
  }, [symbol]);

  const handleTrade = useCallback(() => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    if (!tradeAmount || Number(tradeAmount) <= 0) {
      alert('Enter an amount');
      return;
    }
    setShowConfirm(true);
  }, [isConnected, tradeAmount]);

  const executeTrade = useCallback(() => {
    alert(`✅ ${tradeMode === 'buy' ? 'Bought' : 'Sold'} ${tradeAmount} ${symbol} successfully!`);
    setTradeAmount('');
  }, [tradeMode, tradeAmount, symbol]);

  if (loading || !detail) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="skeleton h-8 w-48 rounded-lg mb-6" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="skeleton h-96 rounded-xl lg:col-span-2" />
          <div className="skeleton h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const isUp = detail.priceChange24h >= 0;
  const chartColor = isUp ? '#00ff41' : '#ff4444';
  const recentTrades = trades.slice(0, 25);
  const topHolders = holders.slice(0, 20);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* Breadcrumb */}
      <nav className="mb-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/coins" className="hover:text-degen-400 transition-colors">
          Coins
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--color-fg)]">${detail.symbol}</span>
      </nav>

      {/* Multi-Protocol View Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <span className="rounded-lg bg-degen-500/15 px-2.5 py-1 text-[9px] font-semibold text-degen-400">All Protocols</span>
        <Link href={`/coins/${detail.symbol}/farcaster`} className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[9px] font-medium text-indigo-400 hover:bg-indigo-500/20 transition-colors">⬡ Farcaster</Link>
        <Link href={`/coins/${detail.symbol}/nostr`} className="rounded-lg bg-purple-500/10 px-2.5 py-1 text-[9px] font-medium text-purple-400 hover:bg-purple-500/20 transition-colors">⚡ Nostr</Link>
        <Link href={`/coins/${detail.symbol}/bluesky`} className="rounded-lg bg-sky-500/10 px-2.5 py-1 text-[9px] font-medium text-sky-400 hover:bg-sky-500/20 transition-colors">☁️ Bluesky</Link>
        <Link href={`/coins/${detail.symbol}/mastodon`} className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[9px] font-medium text-indigo-400 hover:bg-indigo-500/20 transition-colors">🐘 Mastodon</Link>
        <Link href={`/coins/${detail.symbol}/lens`} className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[9px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">👁️ Lens</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ════════ LEFT: Chart + Tabs ════════ */}
        <div className="space-y-5 lg:col-span-2">
          {/* Coin Identity */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-degen-500/30 bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xl font-bold text-degen-400">
              {detail.symbol.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--color-fg)]">{detail.name}</h1>
                <span className="rounded-lg bg-[var(--color-overlay)] px-2 py-0.5 font-mono text-xs font-medium text-[var(--color-muted)]">
                  ${detail.symbol}
                </span>
                {detail.graduated && (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                    ✅ Graduated
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${detail.chain === 'solana' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}`}
                >
                  {detail.chain === 'solana' ? '◎ Solana' : '⧫ Base'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                {detail.description}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                <span>
                  by{' '}
                  <span className="font-medium text-[var(--color-fg)]">{detail.creatorName}</span>
                </span>
                <span>{shortenAddress(detail.creator)}</span>
                {detail.isLive && (
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
                  </span>
                )}
                {/* Fair Launch Badge */}
                {detail.graduated && (
                  <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[8px] font-semibold text-degen-400 flex items-center gap-1">
                    🏅 Fair Launch
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Price Chart Card */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-black tabular-nums text-[var(--color-fg)]">
                  ${formatPrice(detail.price)}
                </div>
                <div
                  className={`flex items-center gap-2 text-xs font-semibold ${isUp ? 'text-degen-400' : 'text-red-400'}`}
                >
                  <span>
                    {isUp ? '+' : ''}
                    {detail.priceChange24h.toFixed(2)}% (24h)
                  </span>
                  <span className="text-[var(--color-muted)]">
                    Volume: ${formatCompact(detail.volume24h)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
                <span>MCap: ${formatCompact(detail.marketCap)}</span>
                <span>{detail.holderCount} holders</span>
              </div>
            </div>
            <PriceChart
              priceData={priceData}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              color={chartColor}
            />
          </div>

          {/* Details Tabs - Enhanced with Transparency & Trust */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
            <div className="flex border-b border-[var(--color-glass-border)]">
              {[
                { id: 'info' as DetailTab, label: 'Info', icon: 'ℹ️' },
                { id: 'transparency' as DetailTab, label: 'Transparency', icon: '🔍' },
                { id: 'trust' as DetailTab, label: 'Trust', icon: '🛡️' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-2.5 text-[10px] font-semibold capitalize transition-all ${activeTab === tab.id ? 'border-b-2 border-degen-400 text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="p-3 max-h-[500px] overflow-y-auto scrollbar-thin">
              {/* ── INFO TAB ── */}
              {activeTab === 'info' && (
                <div className="space-y-3">
                  {/* Trades */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-[var(--color-fg)] mb-2">
                      ⚡ Recent Trades
                    </h4>
                    <div className="divide-y divide-[var(--color-glass-border)]">
                      {recentTrades.length === 0 && (
                        <p className="py-3 text-center text-[10px] text-[var(--color-muted)]">
                          No trades yet
                        </p>
                      )}
                      {recentTrades.map((t) => (
                        <div
                          key={t.txHash}
                          className="flex items-center justify-between py-1.5 text-[9px]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.type === 'buy' ? 'bg-degen-400' : 'bg-red-400'}`}
                            />
                            <span
                              className={`font-semibold shrink-0 ${t.type === 'buy' ? 'text-degen-400' : 'text-red-400'}`}
                            >
                              {t.type === 'buy' ? 'BUY' : 'SELL'}
                            </span>
                            <span className="font-mono text-[var(--color-muted)] truncate max-w-[50px]">
                              {shortenAddress(t.trader)}
                            </span>
                            <WalletLabelBadge label={t.traderLabel} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="tabular-nums text-[var(--color-fg)]">
                              {formatCompact(t.amount)}
                            </span>
                            <span className="tabular-nums text-[var(--color-muted)]">
                              ${t.usdValue.toFixed(2)}
                            </span>
                            <span className="text-[var(--color-muted)] w-8 text-right">
                              {timeAgo(t.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Holders */}
                  <div>
                    <h4 className="text-[10px] font-semibold text-[var(--color-fg)] mb-2">
                      👥 Top Holders
                    </h4>
                    <div className="divide-y divide-[var(--color-glass-border)]">
                      {topHolders.map((h) => (
                        <div
                          key={h.address}
                          className="flex items-center justify-between py-1.5 text-[9px]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-4 text-center font-bold ${h.rank <= 3 ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
                            >
                              {h.rank <= 3 ? ['🥇', '🥈', '🥉'][h.rank - 1] : `#${h.rank}`}
                            </span>
                            <span className="font-mono text-[var(--color-fg)] truncate max-w-[60px]">
                              {shortenAddress(h.address)}
                            </span>
                            <WalletLabelBadge label={h.label} />
                            {h.isBundled && <span className="text-red-400 text-[7px]">⚠️</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="tabular-nums text-[var(--color-fg)]">
                              {formatCompact(h.balance)}
                            </span>
                            <span className="w-10 text-right text-[var(--color-muted)]">
                              {h.percentage.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coin Info */}
                  <div className="space-y-1.5 text-[10px] border-t border-[var(--color-glass-border)] pt-2">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Contract</span>
                      <span className="font-mono text-[var(--color-fg)]">
                        {shortenAddress(detail.address)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Chain</span>
                      <span className="text-[var(--color-fg)]">
                        {detail.chain === 'solana' ? 'Solana' : 'Base'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Total Supply</span>
                      <span className="font-mono text-[var(--color-fg)]">
                        {formatCompact(detail.totalSupply)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Bonding Phase</span>
                      <span className="text-[var(--color-fg)]">
                        Phase {detail.bondingPhase + 1}/5
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Status</span>
                      <span className={detail.graduated ? 'text-green-400' : 'text-amber-400'}>
                        {detail.graduated ? 'Graduated to DEX' : 'Bonding'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Creator</span>
                      <span className="text-[var(--color-fg)]">{detail.creatorName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Platform Fee</span>
                      <span className="text-amber-400">0.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Creator Fee</span>
                      <span className="text-degen-400">1.0%</span>
                    </div>
                    {detail.tags.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-muted)]">Tags</span>
                        <div className="flex gap-1">
                          {detail.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[8px] text-[var(--color-muted)]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TRANSPARENCY TAB ── */}
              {activeTab === 'transparency' && (
                <div className="space-y-3">
                  <SupplyBreakdownChart />
                  <VestingTracker vesting={vesting} />
                  <FeeTransparency />
                  <BundlingWarning />
                  <LockProofBadge />
                  <AuditTrail />
                </div>
              )}

              {/* ── TRUST TAB ── */}
              {activeTab === 'trust' && <CommunityTrust detail={detail} vesting={vesting} />}
            </div>
          </div>
        </div>

        {/* ════════ RIGHT: Buy/Sell + Quick Info ════════ */}
        <div className="space-y-4">
          {/* Trade Card */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <div className="mb-4 flex rounded-xl bg-[var(--color-overlay)] p-0.5">
              <button
                type="button"
                onClick={() => setTradeMode('buy')}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${tradeMode === 'buy' ? 'bg-degen-500/20 text-degen-400 shadow-sm' : 'text-[var(--color-muted)]'}`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setTradeMode('sell')}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${tradeMode === 'sell' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-[var(--color-muted)]'}`}
              >
                Sell
              </button>
            </div>
            <div className="mb-4 text-center">
              <div className="text-lg font-black tabular-nums text-[var(--color-fg)]">
                ${formatPrice(detail.price)}
              </div>
              <div className={`text-xs font-semibold ${isUp ? 'text-degen-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}
                {detail.priceChange24h.toFixed(2)}%
              </div>
            </div>
            <label className="mb-3 block">
              <span className="mb-1 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
                <span>Amount</span>
                <span>Balance: —</span>
              </span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0.0"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="input w-full pr-14 text-sm font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[var(--color-muted)]">
                  {detail.symbol}
                </span>
              </div>
            </label>
            <div className="mb-3 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
              <span>Total</span>
              <span className="font-mono text-[var(--color-fg)]">
                ${(Number(tradeAmount || 0) * detail.price).toFixed(4)}
              </span>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowSlippageConfig(!showSlippageConfig)}
                  className="flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                >
                  ⚙️ Slippage: {slippage}%
                </button>
                <span className="text-[9px] text-[var(--color-muted)]">Fee: 1.5% total</span>
              </div>
              {showSlippageConfig && (
                <div className="mt-2 flex items-center gap-1">
                  {[0.5, 1.0, 2.0, 3.0, 5.0].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSlippage(s);
                        setShowSlippageConfig(false);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[9px] font-medium transition-all ${slippage === s ? 'bg-degen-500/15 text-degen-400' : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!isConnected ? (
              <button
                type="button"
                onClick={() => setIsConnected(true)}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 text-xs font-bold text-white transition-all hover:from-purple-500 hover:to-blue-500 active:scale-[0.98]"
              >
                Connect Wallet to Trade
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTrade}
                disabled={!tradeAmount || Number(tradeAmount) <= 0}
                className={`w-full rounded-xl py-3 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 ${tradeMode === 'buy' ? 'bg-gradient-to-r from-degen-600 to-degen-400' : 'bg-gradient-to-r from-red-600 to-rose-500'}`}
              >
                {tradeMode === 'buy' ? `Buy ${detail.symbol}` : `Sell ${detail.symbol}`}
              </button>
            )}
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="text-[var(--color-muted)]">Market Cap</div>
                <div className="font-semibold tabular-nums text-[var(--color-fg)]">
                  ${formatCompact(detail.marketCap)}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-muted)]">24h Volume</div>
                <div className="font-semibold tabular-nums text-[var(--color-fg)]">
                  ${formatCompact(detail.volume24h)}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-muted)]">Holders</div>
                <div className="font-semibold tabular-nums text-[var(--color-fg)]">
                  {detail.holderCount}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-muted)]">7d Change</div>
                <div
                  className={`font-semibold tabular-nums ${detail.priceChange7d >= 0 ? 'text-degen-400' : 'text-red-400'}`}
                >
                  {detail.priceChange7d >= 0 ? '+' : ''}
                  {detail.priceChange7d.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Creator info */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-[10px] font-bold text-degen-400">
                {detail.creatorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">
                  {detail.creatorName}
                </div>
                <div className="text-[9px] text-[var(--color-muted)]">
                  {shortenAddress(detail.creator)}
                </div>
              </div>
              <Link
                href={`/coins?q=${detail.creatorName}`}
                className="ml-auto text-[9px] text-degen-400 hover:underline"
              >
                View coins →
              </Link>
            </div>
            <div className="mt-2 flex gap-1 flex-wrap">
              <span className="rounded bg-degen-500/15 px-1.5 py-0.5 text-[7px] text-degen-400">
                ✓ Twitter
              </span>
              <span className="rounded bg-degen-500/15 px-1.5 py-0.5 text-[7px] text-degen-400">
                ✓ Farcaster
              </span>
              <span className="rounded bg-degen-500/15 px-1.5 py-0.5 text-[7px] text-degen-400">
                ✓ ENS
              </span>
            </div>
          </div>

          {/* Bonding progress */}
          {!detail.graduated && (
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
              <div className="mb-2 flex items-center justify-between text-[10px]">
                <span className="font-medium text-[var(--color-fg)]">Bonding Progress</span>
                <span className="text-[var(--color-muted)]">Phase {detail.bondingPhase + 1}/5</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-degen-500 via-yellow-500 to-orange-500"
                  style={{ width: `${(detail.bondingPhase + 1) * 20}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[8px] text-[var(--color-muted)]">
                <span>Steal Deal</span>
                <span>Early Bird</span>
                <span>Cruise</span>
                <span>Final Call</span>
                <span>Moonshot</span>
              </div>
            </div>
          )}

          {/* Pre-bonding timer (for non-graduated) */}
          {!detail.graduated && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[var(--color-fg)]">
                  ⏱️ Trading starts in
                </span>
                <span className="font-mono text-xs font-bold text-amber-400">2d 14h 30m</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trade Confirmation Modal */}
      {showConfirm && (
        <TradeConfirmModal
          type={tradeMode}
          amount={tradeAmount}
          symbol={detail.symbol}
          price={detail.price}
          gasEstimate={detail.chain === 'solana' ? '~0.005 SOL' : '~0.001 ETH'}
          slippage={slippage}
          onConfirm={executeTrade}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
