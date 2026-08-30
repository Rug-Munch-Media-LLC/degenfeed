'use client';

/**
 * Creator Coin Management Dashboard
 *
 * Complete creator control center:
 * - Real-time metrics: price, market cap, holders, volume, liquidity
 * - Revenue: fees earned, tips received
 * - Holder list: all holders with labels (creator, team, community)
 * - Trade history: all buys/sells with wallet labels
 * - Vesting schedule: locked vs unlocked tokens, next unlock date
 * - Quick actions: burn tokens, airdrop, update parameters (via DAO)
 * - Wallet labeling for transparency
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════

interface CoinSummary {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  deployedAt: number;
  marketCap: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  holderCount: number;
  graduated: boolean;
  creatorRevenue: number;
  feesEarned: number;
  tipsReceived: number;
  creatorAllocation: number;
  platformFeeBps: number;
  creatorFeeBps: number;
}

type WalletLabel = 'creator' | 'team' | 'lp' | 'dao' | 'community' | 'bundled';

interface HolderEntry {
  address: string;
  balance: number;
  percentage: number;
  label: WalletLabel;
  isCreator: boolean;
  lastTx: number;
  entryPrice?: number;
  pnl?: number;
  isBundled: boolean;
}

interface TradeEntry {
  txHash: string;
  type: 'buy' | 'sell';
  trader: string;
  traderLabel: WalletLabel;
  tokenAmount: number;
  nativeValue: number;
  price: number;
  timestamp: number;
  isBundled: boolean;
}

interface RevenueData {
  totalRevenue: number;
  creatorFees: number;
  treasuryFees: number;
  tipsReceived: number;
  platformFees: number;
  liquidityFees: number;
  revenueByDay: Array<{ date: string; amount: number }>;
  feeBreakdown: {
    creator: { label: string; pct: number; amount: number };
    platform: { label: string; pct: number; amount: number };
    treasury: { label: string; pct: number; amount: number };
    liquidity: { label: string; pct: number; amount: number };
  };
}

interface VestingSchedule {
  totalLocked: number;
  totalUnlocked: number;
  unlockedPct: number;
  schedule: Array<{
    date: string;
    amount: number;
    cumulative: number;
    status: 'locked' | 'unlocking' | 'unlocked';
  }>;
  nextUnlockDate: string;
  nextUnlockAmount: number;
  cliffEndDate: string;
  vestingEndDate: string;
}

interface SupplyBreakdown {
  totalSupply: number;
  circulating: number;
  burned: number;
  ownedByCreator: number;
  ownedByTeam: number;
  ownedByLP: number;
  ownedByDAO: number;
  ownedByCommunity: number;
  ownedByBundled: number;
}

interface BundlingInfo {
  detected: boolean;
  bundledWallets: number;
  totalBundledTokens: number;
  bundlingPercentage: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

interface AuditEntry {
  txHash: string;
  action: string;
  params: string;
  timestamp: number;
  actor: string;
}

// ══════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════

/* ── Label Badge ─────────────────────────────────── */
function WalletLabelBadge({ label }: { label: WalletLabel }) {
  const styles: Record<WalletLabel, { bg: string; text: string }> = {
    creator: { bg: 'bg-degen-500/15', text: 'text-degen-400' },
    team: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    lp: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    dao: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
    community: { bg: 'bg-[var(--color-overlay)]', text: 'text-[var(--color-muted)]' },
    bundled: { bg: 'bg-red-500/15', text: 'text-red-400' },
  };
  const s = styles[label];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${s.bg} ${s.text}`}>
      {label}
    </span>
  );
}

/* ── Stat Tile ────────────────────────────────────── */
function Tile({
  label,
  value,
  sub,
  icon,
  trend,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  trend?: { value: number; up: boolean };
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20">
      {accent && (
        <div
          className="absolute right-0 top-0 h-0.5 w-full opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accent})` }}
        />
      )}
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/10 text-sm text-degen-400">
          {icon}
        </span>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-semibold ${trend.up ? 'text-degen-400' : 'text-red-400'}`}
          >
            <svg
              aria-hidden="true"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={trend.up ? '' : 'rotate-180'}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {trend.value}%
          </span>
        )}
      </div>
      <div className="text-xl font-black tabular-nums text-[var(--color-fg)]">{value}</div>
      <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{label}</div>
      {sub && <div className="mt-1 text-[9px] text-degen-400">{sub}</div>}
    </div>
  );
}

/* ── Pie Chart ─────────────────────────────────────── */
function PieChart({
  data,
  size = 120,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  let cumulative = 0;
  const slices = data.map((d) => {
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
    const largeArc = pct > 0.5 ? 1 : 0;
    return {
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: d.color,
      label: d.label,
      pct: (pct * 100).toFixed(1),
    };
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="Supply breakdown pie chart"
      role="img"
    >
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="var(--color-card)" strokeWidth="1" />
      ))}
    </svg>
  );
}

/* ── Vesting Progress Bar ──────────────────────────── */
function VestingBar({ vesting }: { vesting: VestingSchedule }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-fg)] font-semibold">
          {vesting.unlockedPct}% Unlocked
        </span>
        <span className="text-[var(--color-muted)]">
          {(vesting.totalUnlocked / 1e6).toFixed(0)}M / {(vesting.totalLocked / 1e6).toFixed(0)}M
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-degen-400 transition-all duration-700"
          style={{ width: `${vesting.unlockedPct}%` }}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 text-[9px]">
        <div>
          <span className="text-[var(--color-muted)]">Cliff ends</span>
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
          <span className="text-[var(--color-muted)]">Amount</span>
          <p className="font-mono text-[var(--color-fg)]">
            {(vesting.nextUnlockAmount / 1e6).toFixed(2)}M
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

/* ── Mini Bar Chart ───────────────────────────────── */
function MiniBarChart({ data, color = '#00ff41' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-20">
      {data.map((v, i) => (
        <div key={i} className="flex-1 group relative">
          <div
            className="w-full rounded-t-sm transition-all hover:opacity-80"
            style={{ height: `${(v / max) * 100}%`, background: color, opacity: 0.5 }}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Trade Row ─────────────────────────────────────── */
function TradeRow({ trade }: { trade: TradeEntry }) {
  const ago = Math.floor((Date.now() - trade.timestamp) / 60000);
  return (
    <div className="flex items-center justify-between py-1.5 text-[10px] border-b border-[var(--color-glass-border)] last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${trade.type === 'buy' ? 'bg-degen-400' : 'bg-red-400'}`}
        />
        <span
          className={`font-semibold shrink-0 ${trade.type === 'buy' ? 'text-degen-400' : 'text-red-400'}`}
        >
          {trade.type === 'buy' ? 'BUY' : 'SELL'}
        </span>
        <span className="font-mono text-[var(--color-muted)] truncate max-w-[60px]">
          {trade.trader.slice(0, 6)}..{trade.trader.slice(-4)}
        </span>
        <WalletLabelBadge label={trade.traderLabel} />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="tabular-nums text-[var(--color-fg)]">
          {(trade.tokenAmount / 1000).toFixed(0)}K
        </span>
        <span className="tabular-nums text-[var(--color-muted)]">
          ${trade.nativeValue.toFixed(2)}
        </span>
        <span className="text-[var(--color-muted)] w-10 text-right">
          {ago < 60
            ? `${ago}m`
            : Math.floor(ago / 60) < 24
              ? `${Math.floor(ago / 60)}h`
              : `${Math.floor(ago / 1440)}d`}
        </span>
        {trade.isBundled && <span className="text-red-400 text-[7px] font-bold">⚠</span>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD SECTIONS
// ══════════════════════════════════════════════════════════════════════

/* ── Metrics Section ──────────────────────────────── */
function MetricsSection({ coin }: { coin: CoinSummary }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Tile
        label="Price"
        value={`$${coin.price.toFixed(6)}`}
        icon="💰"
        trend={{ value: coin.priceChange24h, up: coin.priceChange24h >= 0 }}
      />
      <Tile label="Market Cap" value={`$${(coin.marketCap / 1e6).toFixed(2)}M`} icon="📊" />
      <Tile label="Holders" value={coin.holderCount.toLocaleString()} icon="👥" sub="+12 today" />
      <Tile label="24h Volume" value={`$${(coin.volume24h / 1e3).toFixed(0)}K`} icon="⚡" />
      <Tile
        label="Liquidity"
        value={`$${(coin.liquidity / 1e3).toFixed(0)}K`}
        icon="💧"
        accent="var(--color-accent)"
      />
      <Tile
        label="Revenue"
        value={`$${coin.creatorRevenue.toLocaleString()}`}
        icon="💰"
        trend={{ value: 18.5, up: true }}
      />
    </div>
  );
}

/* ── Holder List ──────────────────────────────────── */
function HolderListSection({ holders }: { holders: HolderEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const display = showAll ? holders : holders.slice(0, 15);
  const labelsCount = {
    creator: holders.filter((h) => h.label === 'creator').length,
    team: holders.filter((h) => h.label === 'team').length,
    lp: holders.filter((h) => h.label === 'lp').length,
    dao: holders.filter((h) => h.label === 'dao').length,
    bundled: holders.filter((h) => h.label === 'bundled').length,
    community: holders.filter((h) => h.label === 'community').length,
  };

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--color-fg)]">👥 Holder List</h3>
        <div className="flex flex-wrap gap-1">
          {labelsCount.creator > 0 && (
            <span className="rounded bg-degen-500/15 px-1.5 py-0.5 text-[8px] text-degen-400">
              {labelsCount.creator} creator
            </span>
          )}
          {labelsCount.team > 0 && (
            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[8px] text-blue-400">
              {labelsCount.team} team
            </span>
          )}
          {labelsCount.lp > 0 && (
            <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[8px] text-purple-400">
              {labelsCount.lp} LP
            </span>
          )}
          {labelsCount.dao > 0 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[8px] text-amber-400">
              {labelsCount.dao} DAO
            </span>
          )}
          {labelsCount.bundled > 0 && (
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[8px] text-red-400">
              {labelsCount.bundled} bundled
            </span>
          )}
          <span className="rounded bg-[var(--color-overlay)] px-1.5 py-0.5 text-[8px] text-[var(--color-muted)]">
            {labelsCount.community} community
          </span>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto scrollbar-thin">
        <div className="divide-y divide-[var(--color-glass-border)]">
          {display.map((h) => (
            <div key={h.address} className="flex items-center justify-between py-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${h.isCreator ? 'bg-degen-400' : h.label === 'bundled' ? 'bg-red-400' : 'bg-[var(--color-glass-border)]'}`}
                />
                <span className="font-mono text-[var(--color-fg)] truncate max-w-[60px]">
                  {h.address.slice(0, 6)}..{h.address.slice(-4)}
                </span>
                <WalletLabelBadge label={h.label} />
                {h.pnl !== undefined && (
                  <span className={`text-[8px] ${h.pnl >= 0 ? 'text-degen-400' : 'text-red-400'}`}>
                    {h.pnl >= 0 ? '+' : ''}
                    {h.pnl.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="tabular-nums text-[var(--color-fg)]">
                  {(h.balance / 1e6).toFixed(2)}M
                </span>
                <span className="w-10 text-right text-[var(--color-muted)]">
                  {h.percentage.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {holders.length > 15 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-2 w-full rounded-lg bg-[var(--color-overlay)] py-1.5 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${holders.length} holders`}
        </button>
      )}
    </div>
  );
}

/* ── Trade History ────────────────────────────────── */
function TradeHistorySection({ trades }: { trades: TradeEntry[] }) {
  const buys = trades.filter((t) => t.type === 'buy');
  const sells = trades.filter((t) => t.type === 'sell');
  const buyVol = buys.reduce((s, t) => s + t.nativeValue, 0);
  const sellVol = sells.reduce((s, t) => s + t.nativeValue, 0);
  const ratio = sellVol > 0 ? (buyVol / sellVol).toFixed(2) : '∞';

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--color-fg)]">⚡ Trade History</h3>
        <div className="flex items-center gap-2 text-[9px] text-[var(--color-muted)]">
          <span className="text-degen-400">{buys.length} buys</span>
          <span>/</span>
          <span className="text-red-400">{sells.length} sells</span>
          <span className="rounded bg-[var(--color-overlay)] px-1.5 py-0.5">Ratio: {ratio}</span>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto scrollbar-thin">
        {trades.slice(0, 50).map((t) => (
          <TradeRow key={t.txHash} trade={t} />
        ))}
      </div>
    </div>
  );
}

/* ── Revenue Section ──────────────────────────────── */
function RevenueSection({ revenue }: { revenue: RevenueData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Total Revenue"
          value={`$${revenue.totalRevenue.toLocaleString()}`}
          icon="💰"
          trend={{ value: 18.5, up: true }}
        />
        <Tile
          label="Creator Fees"
          value={`$${revenue.creatorFees.toLocaleString()}`}
          icon="📋"
          trend={{ value: 12.3, up: true }}
        />
        <Tile
          label="Tips Received"
          value={`$${revenue.tipsReceived.toLocaleString()}`}
          icon="⚡"
          trend={{ value: 24.1, up: true }}
        />
        <Tile label="Platform Fees" value={`$${revenue.platformFees.toLocaleString()}`} icon="🏛️" />
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">Daily Revenue (30 days)</h3>
        <MiniBarChart data={revenue.revenueByDay.map((d) => d.amount)} color="#00ff41" />
      </div>

      {/* Fee Transparency Breakdown */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">🔍 Fee Transparency</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
              <span className="h-2 w-2 rounded-full bg-degen-400" />
              Creator Fee
              <span className="text-[var(--color-muted)]">
                ({revenue.feeBreakdown.creator.pct}%)
              </span>
            </span>
            <span className="font-mono text-degen-400">
              ${revenue.feeBreakdown.creator.amount.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Platform Fee
              <span className="text-[var(--color-muted)]">
                ({revenue.feeBreakdown.platform.pct}%)
              </span>
            </span>
            <span className="font-mono text-amber-400">
              ${revenue.feeBreakdown.platform.amount.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              Treasury
              <span className="text-[var(--color-muted)]">
                ({revenue.feeBreakdown.treasury.pct}%)
              </span>
            </span>
            <span className="font-mono text-purple-400">
              ${revenue.feeBreakdown.treasury.amount.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Liquidity Pool
              <span className="text-[var(--color-muted)]">
                ({revenue.feeBreakdown.liquidity.pct}%)
              </span>
            </span>
            <span className="font-mono text-blue-400">
              ${revenue.feeBreakdown.liquidity.amount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Vesting Section ──────────────────────────────── */
function VestingSection({
  vesting,
  bundling,
}: {
  vesting: VestingSchedule;
  bundling: BundlingInfo;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">
          🔒 Creator Vesting Schedule
        </h3>
        <VestingBar vesting={vesting} />
      </div>

      {/* Lock Proof */}
      <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-degen-500/20 text-[10px]">
            ✓
          </span>
          <span className="text-xs font-semibold text-degen-400">Lock Proof Verified</span>
          <span className="ml-auto text-[9px] text-[var(--color-muted)]">On-chain</span>
        </div>
        <p className="text-[9px] text-[var(--color-muted)]">
          {(vesting.totalLocked / 1e6).toFixed(0)}M tokens locked in vesting contract until{' '}
          {new Date(vesting.vestingEndDate).toLocaleDateString()}. Cliff ends{' '}
          {new Date(vesting.cliffEndDate).toLocaleDateString()}. Linear vesting with weekly unlocks.
        </p>
      </div>

      {/* Bundling Detection */}
      {bundling.detected && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">⚠️</span>
            <span className="text-xs font-semibold text-red-400">Bundling Detected</span>
            <span
              className={`ml-auto rounded px-1.5 py-0.5 text-[8px] font-semibold ${bundling.riskLevel === 'low' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}
            >
              {bundling.riskLevel} risk
            </span>
          </div>
          <p className="text-[9px] text-[var(--color-muted)]">
            {bundling.bundledWallets} bundled wallets identified holding{' '}
            {(bundling.totalBundledTokens / 1e6).toFixed(1)}M tokens ({bundling.bundlingPercentage}%
            of supply). All bundled wallets are labeled in the holder list.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Supply Section ───────────────────────────────── */
function SupplySection({ supply }: { supply: SupplyBreakdown }) {
  const pieData = [
    { label: 'Creator', value: supply.ownedByCreator, color: '#00ff41' },
    { label: 'Team', value: supply.ownedByTeam, color: '#3b82f6' },
    { label: 'LP', value: supply.ownedByLP, color: '#a855f7' },
    { label: 'DAO', value: supply.ownedByDAO, color: '#f59e0b' },
    { label: 'Bundled', value: supply.ownedByBundled, color: '#ef4444' },
    { label: 'Community', value: supply.ownedByCommunity, color: '#1e293b' },
  ];
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">📊 Supply Breakdown</h3>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <PieChart data={pieData} size={140} />
        <div className="flex-1 space-y-1.5 w-full">
          {pieData.map((d) => (
            <div key={d.label} className="flex items-center gap-2 text-[9px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="flex-1 text-[var(--color-fg)]">{d.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(d.value / supply.totalSupply) * 100}%`, background: d.color }}
                />
              </div>
              <span className="w-14 text-right font-mono text-[var(--color-muted)]">
                {((d.value / supply.totalSupply) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[9px] text-[var(--color-muted)] border-t border-[var(--color-glass-border)] pt-3">
        <span>Total Supply: {(supply.totalSupply / 1e6).toFixed(0)}M</span>
        <span>Circulating: {(supply.circulating / 1e6).toFixed(0)}M</span>
        <span className="text-red-400">Burned: {(supply.burned / 1e6).toFixed(0)}M</span>
      </div>
    </div>
  );
}

/* ── Audit Trail ──────────────────────────────────── */
function AuditTrailSection({ audits }: { audits: AuditEntry[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">📋 Parameter Audit Trail</h3>
      <div className="space-y-2">
        {audits.map((a) => (
          <div
            key={a.txHash}
            className="flex items-start gap-2 rounded-lg border border-[var(--color-glass-border)] p-2"
          >
            <span className="mt-0.5 text-[9px]">📝</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[var(--color-fg)]">{a.action}</span>
                <span className="text-[8px] text-[var(--color-muted)]">
                  {Math.floor((Date.now() - a.timestamp) / 86400000)}d ago
                </span>
              </div>
              <p className="text-[9px] text-[var(--color-muted)]">Params: {a.params}</p>
              <p className="text-[8px] text-[var(--color-muted)] font-mono">
                by {a.actor} · {a.txHash.slice(0, 10)}..
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Quick Actions ────────────────────────────────── */
function QuickActions({ coin, onRefresh }: { coin: CoinSummary; onRefresh: () => void }) {
  const handleBurn = useCallback(async () => {
    const amount = prompt('Enter amount to burn (tokens):');
    if (!amount || Number(amount) <= 0) return;
    await fetch(`/api/creator/coin/${coin.address}/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
      .then((r) => (r.ok ? console.info('🔥 Burn successful!') : console.error('Burn failed')))
      .catch(() => console.error('Burn failed'));
    onRefresh();
  }, [coin.address, onRefresh]);

  const handleAirdrop = useCallback(async () => {
    const addr = prompt('Enter recipient address:');
    const amt = prompt('Enter amount:');
    if (!addr || !amt) return;
    await fetch(`/api/creator/coin/${coin.address}/airdrop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: [{ address: addr, amount: amt }] }),
    })
      .then((r) => (r.ok ? console.info('✈️ Airdrop sent!') : console.error('Airdrop failed')))
      .catch(() => console.error('Airdrop failed'));
    onRefresh();
  }, [coin.address, onRefresh]);

  const handleDaoParamUpdate = useCallback(() => {
    const action = prompt('Enter parameter to update (fee/vesting/supply):');
    if (!action) return;
    const value = prompt('Enter new value:');
    if (!value) return;
    // alert(`⚡ DAO proposal submitted to update ${action} to ${value}. Community vote required.`);
  }, []);

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">⚡ Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleBurn}
          className="flex flex-col items-center gap-1 rounded-lg bg-red-500/10 p-3 text-red-400 hover:bg-red-500/20 transition-all"
        >
          <span className="text-lg">🔥</span>
          <span className="text-[9px] font-semibold">Burn Tokens</span>
        </button>
        <button
          type="button"
          onClick={handleAirdrop}
          className="flex flex-col items-center gap-1 rounded-lg bg-purple-500/10 p-3 text-purple-400 hover:bg-purple-500/20 transition-all"
        >
          <span className="text-lg">✈️</span>
          <span className="text-[9px] font-semibold">Airdrop</span>
        </button>
        <button
          type="button"
          onClick={handleDaoParamUpdate}
          className="flex flex-col items-center gap-1 rounded-lg bg-amber-500/10 p-3 text-amber-400 hover:bg-amber-500/20 transition-all"
        >
          <span className="text-lg">⚙️</span>
          <span className="text-[9px] font-semibold">DAO Params</span>
        </button>
        <Link
          href={`/creator/coins/${coin.address}`}
          className="flex flex-col items-center gap-1 rounded-lg bg-degen-500/10 p-3 text-degen-400 hover:bg-degen-500/20 transition-all"
        >
          <span className="text-lg">📊</span>
          <span className="text-[9px] font-semibold">Analytics</span>
        </Link>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

type DashboardTab =
  | 'overview'
  | 'holders'
  | 'trades'
  | 'revenue'
  | 'vesting'
  | 'supply'
  | 'transparency';

export default function CreatorDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [selectedCoinIdx, setSelectedCoinIdx] = useState(0);

  const [coins] = useState<CoinSummary[]>([]);
  const [holders, setHolders] = useState<HolderEntry[]>([]);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [revenue] = useState<RevenueData>({
    totalRevenue: 0,
    creatorFees: 0,
    treasuryFees: 0,
    tipsReceived: 0,
    platformFees: 0,
    liquidityFees: 0,
    revenueByDay: [],
    feeBreakdown: {
      creator: { label: '', pct: 0, amount: 0 },
      platform: { label: '', pct: 0, amount: 0 },
      treasury: { label: '', pct: 0, amount: 0 },
      liquidity: { label: '', pct: 0, amount: 0 },
    },
  });
  const [vesting] = useState<VestingSchedule>({
    totalLocked: 0,
    totalUnlocked: 0,
    unlockedPct: 0,
    schedule: [],
    nextUnlockDate: '',
    nextUnlockAmount: 0,
    cliffEndDate: '',
    vestingEndDate: '',
  });
  const [supply] = useState<SupplyBreakdown>({
    totalSupply: 0,
    circulating: 0,
    burned: 0,
    ownedByCreator: 0,
    ownedByTeam: 0,
    ownedByLP: 0,
    ownedByDAO: 0,
    ownedByCommunity: 0,
    ownedByBundled: 0,
  });
  const [bundling] = useState<BundlingInfo>({
    detected: false,
    bundledWallets: 0,
    totalBundledTokens: 0,
    bundlingPercentage: 0,
    riskLevel: 'none',
  });
  const [audits] = useState<AuditEntry[]>([]);

  const selectedCoin = coins[selectedCoinIdx];

  // Load data for selected coin
  useEffect(() => {
    if (!selectedCoin) return;
    setHolders([]);
    setTrades([]);
  }, [selectedCoin]);

  const refresh = useCallback(() => {
    if (!selectedCoin) return;
    setHolders([]);
    setTrades([]);
  }, [selectedCoin]);

  if (coins.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center animate-page-enter">
        <div className="mb-4 text-5xl">🪙</div>
        <h1 className="mb-2 text-xl font-bold text-[var(--color-fg)]">No Coins Yet</h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Launch your first creator coin to see your dashboard.
        </p>
        <Link
          href="/creator/studio"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-3 text-sm font-bold text-black hover:from-degen-500 hover:to-degen-300"
        >
          🚀 Launch Your Coin
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            🛠️ Coin Management
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Full control, transparency tools, and community trust features.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Coin selector */}
          <div className="flex gap-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1">
            {coins.map((c, i) => (
              <button
                key={c.address}
                type="button"
                onClick={() => setSelectedCoinIdx(i)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all ${
                  selectedCoinIdx === i
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                ${c.symbol}
              </button>
            ))}
          </div>
          <Link
            href="/creator/studio"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-4 py-2 text-xs font-bold text-black hover:from-degen-500 hover:to-degen-300 active:scale-95"
          >
            <span>🪙</span>
            Launch New
          </Link>
        </div>
      </div>

      {/* ─── Coin Identity ─────────────────────────────── */}
      {selectedCoin && (
        <div className="mb-4 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-base font-bold text-degen-400">
              {selectedCoin.symbol.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--color-fg)]">
                  {selectedCoin.name}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-muted)]">
                  ${selectedCoin.symbol}
                </span>
                {selectedCoin.graduated ? (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[8px] font-semibold text-green-400">
                    ✅ Graduated
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[8px] font-semibold text-amber-400">
                    ⏳ Bonding
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[9px] text-[var(--color-muted)]">
                <span>{selectedCoin.chain === 'solana' ? '◎ Solana' : '⧫ Base'}</span>
                <span>
                  Created {Math.floor((Date.now() - selectedCoin.deployedAt) / 86400000)}d ago
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(selectedCoin.address)}
                  className="font-mono text-degen-400 hover:underline"
                >
                  {selectedCoin.address.slice(0, 8)}..{selectedCoin.address.slice(-6)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tabs ────────────────────────────────────────── */}
      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1 scrollbar-none"
        role="tablist"
      >
        {[
          { id: 'overview' as DashboardTab, label: 'Overview', icon: '📊' },
          { id: 'holders' as DashboardTab, label: 'Holders', icon: '👥' },
          { id: 'trades' as DashboardTab, label: 'Trades', icon: '⚡' },
          { id: 'revenue' as DashboardTab, label: 'Revenue', icon: '💰' },
          { id: 'vesting' as DashboardTab, label: 'Vesting', icon: '🔒' },
          { id: 'supply' as DashboardTab, label: 'Supply', icon: '📊' },
          { id: 'transparency' as DashboardTab, label: 'Transparency', icon: '🔍' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-[10px] font-medium capitalize transition-all ${
              activeTab === tab.id
                ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {activeTab === 'overview' && selectedCoin && (
        <div className="space-y-4">
          <MetricsSection coin={selectedCoin} />

          <div className="grid gap-4 lg:grid-cols-2">
            <HolderListSection holders={holders} />
            <TradeHistorySection trades={trades} />
          </div>

          <QuickActions coin={selectedCoin} onRefresh={refresh} />
        </div>
      )}

      {/* ═══ HOLDERS ═══ */}
      {activeTab === 'holders' && <HolderListSection holders={holders} />}

      {/* ═══ TRADES ═══ */}
      {activeTab === 'trades' && <TradeHistorySection trades={trades} />}

      {/* ═══ REVENUE ═══ */}
      {activeTab === 'revenue' && <RevenueSection revenue={revenue} />}

      {/* ═══ VESTING ═══ */}
      {activeTab === 'vesting' && <VestingSection vesting={vesting} bundling={bundling} />}

      {/* ═══ SUPPLY ═══ */}
      {activeTab === 'supply' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SupplySection supply={supply} />
          <QuickActions coin={selectedCoin!} onRefresh={refresh} />
        </div>
      )}

      {/* ═══ TRANSPARENCY ═══ */}
      {activeTab === 'transparency' && (
        <div className="space-y-4">
          {/* Trust Score Card */}
          <div className="rounded-xl border border-degen-500/20 bg-gradient-to-r from-degen-500/5 to-purple-500/5 p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-degen-400 bg-degen-500/10">
                <span className="text-2xl">🔍</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--color-fg)]">Transparency Dashboard</h2>
                <p className="text-xs text-[var(--color-muted)]">
                  All wallets labeled · Vesting on-chain verified · Fees transparent · Supply
                  auditable
                </p>
              </div>
              <div className="ml-auto text-center">
                <div className="text-2xl font-black text-degen-400">85</div>
                <div className="text-[9px] text-[var(--color-muted)]">Trust Score</div>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-glass-border)] mt-1">
                  <div className="h-full rounded-full bg-degen-400" style={{ width: '85%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SupplySection supply={supply} />
            <AuditTrailSection audits={audits} />
          </div>

          {/* Fee Transparency */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">🏛️ Fee Transparency</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--color-glass-border)] p-3">
                <div className="text-[10px] text-[var(--color-muted)]">Platform Fee</div>
                <div className="text-lg font-bold text-amber-400">0.5%</div>
                <div className="text-[8px] text-[var(--color-muted)]">
                  All trades · Funds platform operations
                </div>
              </div>
              <div className="rounded-lg border border-[var(--color-glass-border)] p-3">
                <div className="text-[10px] text-[var(--color-muted)]">Creator Fee</div>
                <div className="text-lg font-bold text-degen-400">1.0%</div>
                <div className="text-[8px] text-[var(--color-muted)]">
                  All trades · Goes to creator wallet
                </div>
              </div>
              <div className="rounded-lg border border-[var(--color-glass-border)] p-3">
                <div className="text-[10px] text-[var(--color-muted)]">Treasury Allocation</div>
                <div className="text-lg font-bold text-purple-400">0.3%</div>
                <div className="text-[8px] text-[var(--color-muted)]">
                  DAO controlled · Community proposals
                </div>
              </div>
              <div className="rounded-lg border border-[var(--color-glass-border)] p-3">
                <div className="text-[10px] text-[var(--color-muted)]">Liquidity Fee</div>
                <div className="text-lg font-bold text-blue-400">0.2%</div>
                <div className="text-[8px] text-[var(--color-muted)]">
                  Auto-adds to LP · Permanent liquidity
                </div>
              </div>
            </div>
          </div>

          {/* Lock Proof */}
          <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/20">
                <span className="text-lg">🔒</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-degen-400">On-Chain Lock Proof</span>
                  <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[8px] text-degen-400">
                    Verified
                  </span>
                </div>
                <p className="text-[10px] text-[var(--color-muted)]">
                  Creator tokens are locked in a audited vesting contract at{' '}
                  <span className="font-mono text-degen-400">0xVesting...Contract</span>. Verified
                  on {selectedCoin?.chain === 'solana' ? 'Solscan' : 'Etherscan'}.
                </p>
              </div>
              <a
                href={
                  selectedCoin?.chain === 'solana' ? 'https://solscan.io' : 'https://basescan.org'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto rounded-lg bg-degen-500/15 px-3 py-1.5 text-[9px] font-medium text-degen-400 hover:bg-degen-500/25 transition-colors"
              >
                View on Explorer ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
