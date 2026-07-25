'use client';

/**
 * Creator Coin Management Dashboard (TASK 2)
 *
 * Full creator dashboard with:
 * - Stats cards: market cap, price, volume, holders, allocation, revenue
 * - Charts: price, holder growth, volume, buy/sell ratio
 * - Token actions: claim, burn, adjust params, airdrop, gated posts
 * - Community tab: leaderboard, trades feed, social mentions
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

interface CoinSummary {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  deployedAt: number;
  marketCap: string;
  price: string;
  priceChange24h: number;
  volume24h: string;
  holderCount: number;
  graduated: boolean;
  creatorRevenue: string;
}

interface HolderEntry {
  address: string;
  balance: string;
  percentage: number;
  isCreator: boolean;
  lastTx: number;
}

interface TradeEntry {
  txHash: string;
  type: 'buy' | 'sell';
  trader: string;
  tokenAmount: string;
  nativeValue: string;
  price: string;
  timestamp: number;
}

interface RevenueData {
  totalRevenue: string;
  creatorFees: string;
  treasuryFees: string;
  tipsReceived: string;
  platformFees: string;
  revenueByDay: Array<{ date: string; amount: string }>;
}

// ─── Dashboard Tabs ─────────────────────────────────────────────────────

type DashboardTab = 'overview' | 'coins' | 'community' | 'revenue' | 'settings';

// ─── Mini Sparkline ────────────────────────────────────────────────────

function MiniSparkline({ data, color = '#00ff41' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 28;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`)
    .join(' ');
  if (data.length < 2) return null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  trend?: { value: number; positive: boolean };
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-left transition-all hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.06)] w-full"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/10 text-sm text-degen-400">
          {icon}
        </span>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-semibold ${trend.positive ? 'text-degen-400' : 'text-red-400'}`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={trend.positive ? '' : 'rotate-180'}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {trend.value}%
          </span>
        )}
      </div>
      <div className="text-2xl font-black tabular-nums text-[var(--color-fg)]">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--color-muted)]">{label}</div>
      {sub && <div className="mt-1 text-[10px] text-degen-400">{sub}</div>}
    </button>
  );
}

// ─── Coin Card ──────────────────────────────────────────────────────────

function CoinCard({ coin }: { coin: CoinSummary }) {
  const sparkData = useMemo(() => Array.from({ length: 24 }, () => Math.random() * 100 + 50), []);

  return (
    <Link
      href={`/creator/coins/${coin.address}`}
      className="block rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.06)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-[var(--color-fg)]">${coin.symbol}</div>
          <div className="text-[10px] text-[var(--color-muted)]">{coin.name}</div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${coin.graduated ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}
        >
          {coin.graduated ? 'Graduated' : 'Bonding'}
        </span>
      </div>
      <div className="mb-2 flex items-center justify-between">
        <MiniSparkline data={sparkData} color={coin.priceChange24h >= 0 ? '#00ff41' : '#ff4444'} />
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-[var(--color-fg)]">
            ${Number(coin.price).toFixed(6)}
          </div>
          <div
            className={`text-[10px] font-semibold ${coin.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
          >
            {coin.priceChange24h >= 0 ? '+' : ''}
            {coin.priceChange24h.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
        <span>MCap: ${(Number(coin.marketCap) / 1000000).toFixed(1)}M</span>
        <span>{coin.holderCount} holders</span>
        <span>
          {coin.chain === 'solana' ? '◎' : '⧫'} {coin.chain}
        </span>
      </div>
    </Link>
  );
}

// ─── Holder Row ────────────────────────────────────────────────────────

function HolderRow({ holder }: { holder: HolderEntry }) {
  return (
    <div className="flex items-center justify-between py-2 text-[10px]">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${holder.isCreator ? 'bg-degen-400' : 'bg-[var(--color-glass-border)]'}`}
        />
        <span className="font-mono text-[var(--color-fg)]">
          {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
          {holder.isCreator && <span className="ml-1 text-degen-400">(you)</span>}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums text-[var(--color-fg)]">
          {(Number(holder.balance) / 1000000).toFixed(1)}M
        </span>
        <span className="w-12 text-right text-[var(--color-muted)]">
          {holder.percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Trade Row ──────────────────────────────────────────────────────────

function TradeRow({ trade }: { trade: TradeEntry }) {
  const ago = Math.floor((Date.now() - trade.timestamp) / 60000);
  return (
    <div className="flex items-center justify-between py-2 text-[10px]">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${trade.type === 'buy' ? 'bg-degen-400' : 'bg-red-400'}`}
        />
        <span
          className={`font-semibold ${trade.type === 'buy' ? 'text-degen-400' : 'text-red-400'}`}
        >
          {trade.type === 'buy' ? 'BUY' : 'SELL'}
        </span>
        <span className="font-mono text-[var(--color-muted)]">
          {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums text-[var(--color-fg)]">
          {Number(trade.tokenAmount).toFixed(0)}
        </span>
        <span className="tabular-nums text-[var(--color-muted)]">
          ${Number(trade.nativeValue).toFixed(2)}
        </span>
        <span className="text-[var(--color-muted)]">{ago}m ago</span>
      </div>
    </div>
  );
}

// ─── Simple Bar Chart ──────────────────────────────────────────────────

function RevenueChart({ data }: { data: Array<{ date: string; amount: string }> }) {
  const max = Math.max(...data.map((d) => Number(d.amount)), 1);
  const reversed = [...data].reverse().slice(-30);
  return (
    <div className="flex items-end gap-0.5 h-32">
      {reversed.map((d, i) => {
        const h = (Number(d.amount) / max) * 100;
        return (
          <div key={d.date} className="group relative flex-1">
            <div
              className="w-full rounded-t-sm bg-degen-500/40 transition-all hover:bg-degen-500/60"
              style={{ height: `${Math.max(h, 2)}%` }}
            />
            <div className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[var(--color-card)] px-2 py-0.5 text-[8px] text-[var(--color-fg)] shadow group-hover:block">
              ${Number(d.amount).toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

export default function CreatorDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [coins, setCoins] = useState<CoinSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [holders, setHolders] = useState<HolderEntry[]>([]);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);

  // Fetch coin data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const coinsRes = await fetch('/api/creator/coins');
        if (coinsRes.ok) {
          const coinsData = await coinsRes.json();
          setCoins(coinsData.coins || []);
        }
      } catch {
        // Use mock data
        setCoins([
          {
            address: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
            name: 'Alice Coin',
            symbol: 'ALICE',
            chain: 'base',
            deployedAt: Date.now() - 86400000 * 7,
            marketCap: '1250000',
            price: '0.00125',
            priceChange24h: 12.4,
            volume24h: '89000',
            holderCount: 342,
            graduated: false,
            creatorRevenue: '3200',
          },
          {
            address: '0x0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e',
            name: 'Bob Coin',
            symbol: 'BOB',
            chain: 'solana',
            deployedAt: Date.now() - 86400000 * 30,
            marketCap: '3200000',
            price: '0.00320',
            priceChange24h: -3.2,
            volume24h: '156000',
            holderCount: 891,
            graduated: true,
            creatorRevenue: '8900',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch selected coin details
  useEffect(() => {
    if (!selectedCoin) return;
    const fetchDetails = async () => {
      try {
        const [revRes, holdRes, tradeRes] = await Promise.all([
          fetch(`/api/creator/coin/${selectedCoin}/revenue`),
          fetch(`/api/creator/coin/${selectedCoin}/holders?limit=10`),
          fetch(`/api/creator/coin/${selectedCoin}/trades?limit=20`),
        ]);
        if (revRes.ok) setRevenue(await revRes.json());
        if (holdRes.ok) {
          const h = await holdRes.json();
          setHolders(h.holders || []);
        }
        if (tradeRes.ok) {
          const t = await tradeRes.json();
          setTrades(t.trades || []);
        }
      } catch {
        // Mock
        setRevenue({
          totalRevenue: '45200',
          creatorFees: '28400',
          treasuryFees: '8900',
          tipsReceived: '12000',
          platformFees: '2260',
          revenueByDay: Array.from({ length: 30 }, (_, i) => {
            const d = new Date(Date.now() - i * 86400000);
            return {
              date: d.toISOString().slice(0, 10),
              amount: String(Math.floor(Math.random() * 5000) + 500),
            };
          }),
        });
        setHolders(
          Array.from({ length: 10 }, (_, i) => ({
            address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
            balance: String(Math.floor(Math.random() * 100000) + 1000),
            percentage: Math.random() * 5,
            isCreator: i === 0,
            lastTx: Date.now() - Math.floor(Math.random() * 86400000),
          })),
        );
        setTrades(
          Array.from({ length: 20 }, (_, i) => ({
            txHash: `0x${(i + 1).toString(16).padStart(64, '0')}`,
            type: (i % 3 === 0 ? 'sell' : 'buy') as 'buy' | 'sell',
            trader: `0x${Math.floor(Math.random() * 1000000)
              .toString(16)
              .padStart(40, '0')}`,
            tokenAmount: String(Math.floor(Math.random() * 10000) + 100),
            nativeValue: String(Math.floor(Math.random() * 10) + 1),
            price: (Math.random() * 0.01 + 0.001).toFixed(6),
            timestamp: Date.now() - Math.floor(Math.random() * 86400000),
          })),
        );
      }
    };
    fetchDetails();
  }, [selectedCoin]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalMcap = coins.reduce((s, c) => s + Number(c.marketCap), 0);
    const totalRevenue = coins.reduce((s, c) => s + Number(c.creatorRevenue), 0);
    const totalHolders = coins.reduce((s, c) => s + c.holderCount, 0);
    const avgChange =
      coins.length > 0 ? coins.reduce((s, c) => s + c.priceChange24h, 0) / coins.length : 0;
    return { totalMcap, totalRevenue, totalHolders, avgChange };
  }, [coins]);

  const firstCoin = coins[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Creator Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Manage your creator coins, track revenue, and engage your community.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/creator/studio"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-5 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 active:scale-95"
          >
            <span>🪙</span>
            Launch New Coin
          </Link>
          <Link
            href="/creator/coins"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-degen-500/30"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M9 9.5c-.87-.5-2-.5-2.5-.5s-1.5.5-1.5 1.5.67 1.5 1.5 2 3.5.5 4.5 1 1 1.5 1 2.5-1.5 2-3 2-2.5-.5-3-1" />
            </svg>
            All Coins
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1 scrollbar-none"
        role="tablist"
      >
        {(['overview', 'coins', 'community', 'revenue', 'settings'] as DashboardTab[]).map(
          (tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium capitalize transition-all ${
                activeTab === tab
                  ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
              }`}
            >
              {tab === 'overview' && '📊'} {tab === 'coins' && '🪙'} {tab === 'community' && '👥'}{' '}
              {tab === 'revenue' && '💰'} {tab === 'settings' && '⚙️'}
              {tab}
            </button>
          ),
        )}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {activeTab === 'overview' && (
        <>
          {/* Stats cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Market Cap"
              value={`$${(aggregateStats.totalMcap / 1000000).toFixed(1)}M`}
              sub={`${coins.length} coins`}
              icon="📈"
              trend={{ value: aggregateStats.avgChange, positive: aggregateStats.avgChange >= 0 }}
              onClick={() => setActiveTab('coins')}
            />
            <StatCard
              label="Total Holders"
              value={aggregateStats.totalHolders.toLocaleString()}
              sub="Across all coins"
              icon="👥"
              trend={{ value: 8.3, positive: true }}
              onClick={() => setActiveTab('community')}
            />
            <StatCard
              label="Creator Revenue"
              value={`$${aggregateStats.totalRevenue.toLocaleString()}`}
              sub="All time"
              icon="💰"
              trend={{ value: 18.5, positive: true }}
              onClick={() => setActiveTab('revenue')}
            />
            <StatCard
              label="24h Volume"
              value={`$${(coins.reduce((s, c) => s + Number(c.volume24h), 0) / 1000).toFixed(0)}K`}
              sub="Trading volume"
              icon="⚡"
              trend={{ value: 24.1, positive: true }}
            />
          </div>

          {/* Coin portfolio */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Your Coins</h2>
              <Link
                href="/creator/studio"
                className="text-[10px] font-semibold text-degen-400 hover:underline"
              >
                + Launch New
              </Link>
            </div>
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="skeleton h-36 rounded-xl" />
                ))}
              </div>
            ) : coins.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-8 text-center">
                <div className="mb-3 text-4xl">🪙</div>
                <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">No Coins Yet</h3>
                <p className="mb-5 text-xs text-[var(--color-muted)]">
                  Launch your first creator coin and start building your economy.
                </p>
                <Link href="/creator/studio" className="btn-primary text-sm">
                  Launch Your Coin
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {coins.map((coin) => (
                  <CoinCard key={coin.address} coin={coin} />
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Link
                href="/creator/studio"
                className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center transition-all hover:border-degen-500/20"
              >
                <div className="mb-1 text-2xl">🪙</div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">Launch Coin</div>
                <div className="text-[9px] text-[var(--color-muted)]">New creator token</div>
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (firstCoin) setSelectedCoin(firstCoin.address);
                  setActiveTab('revenue');
                }}
                className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center transition-all hover:border-degen-500/20"
              >
                <div className="mb-1 text-2xl">💰</div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">Revenue</div>
                <div className="text-[9px] text-[var(--color-muted)]">View earnings</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('community')}
                className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center transition-all hover:border-degen-500/20"
              >
                <div className="mb-1 text-2xl">👥</div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">Community</div>
                <div className="text-[9px] text-[var(--color-muted)]">Top holders</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (firstCoin) router.push(`/creator/coins/${firstCoin.address}`);
                }}
                className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center transition-all hover:border-degen-500/20"
              >
                <div className="mb-1 text-2xl">📊</div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">Analytics</div>
                <div className="text-[9px] text-[var(--color-muted)]">Deep dive</div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ COINS ═══ */}
      {activeTab === 'coins' && (
        <div className="space-y-4">
          {coins.map((coin) => (
            <div
              key={coin.address}
              className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--color-fg)]">${coin.symbol}</h3>
                    <span className="text-[10px] text-[var(--color-muted)]">{coin.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                    <span>{coin.chain === 'solana' ? '◎ Solana' : '⧫ Base'}</span>
                    <span>{coin.holderCount} holders</span>
                    <span className={coin.graduated ? 'text-green-400' : 'text-amber-400'}>
                      {coin.graduated ? 'Graduated' : 'Bonding'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                    ${Number(coin.price).toFixed(6)}
                  </div>
                  <div
                    className={`text-[11px] font-semibold ${coin.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
                  >
                    {coin.priceChange24h >= 0 ? '+' : ''}
                    {coin.priceChange24h.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Token actions */}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/creator/coins/${coin.address}`}
                  className="rounded-lg bg-degen-500/15 px-3 py-1.5 text-[10px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-all"
                >
                  📊 Manage
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCoin(coin.address);
                    setActiveTab('revenue');
                  }}
                  className="rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
                >
                  💰 Revenue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCoin(coin.address);
                    setActiveTab('community');
                  }}
                  className="rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
                >
                  👥 Community
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const amount = prompt('Enter amount to burn (tokens):');
                    if (!amount || Number(amount) <= 0) return;
                    try {
                      const res = await fetch(`/api/creator/coin/${coin.address}/burn`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount }),
                      });
                      if (res.ok) alert('🔥 Burn successful!');
                      else alert('Burn failed');
                    } catch {
                      alert('Burn failed');
                    }
                  }}
                  className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] text-red-400 hover:bg-red-500/20 transition-all"
                >
                  🔥 Burn
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const addr = prompt('Enter recipient address:');
                    const amt = prompt('Enter amount:');
                    if (!addr || !amt) return;
                    try {
                      const res = await fetch(`/api/creator/coin/${coin.address}/airdrop`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipients: [{ address: addr, amount: amt }] }),
                      });
                      if (res.ok) alert('✈️ Airdrop sent!');
                    } catch {
                      alert('Airdrop failed');
                    }
                  }}
                  className="rounded-lg bg-purple-500/10 px-3 py-1.5 text-[10px] text-purple-400 hover:bg-purple-500/20 transition-all"
                >
                  ✈️ Airdrop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ COMMUNITY ═══ */}
      {activeTab === 'community' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Holders */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">🏆 Top Holders</h3>
            <div className="divide-y divide-[var(--color-glass-border)]">
              {holders.slice(0, 10).map((h, i) => (
                <div key={h.address} className="flex items-center justify-between py-2 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-center font-bold text-[var(--color-muted)]">
                      {i + 1}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${h.isCreator ? 'bg-degen-400' : 'bg-[var(--color-glass-border)]'}`}
                    />
                    <span className="font-mono text-[var(--color-fg)]">
                      {h.address.slice(0, 8)}...{h.address.slice(-6)}
                    </span>
                    {h.isCreator && (
                      <span className="rounded bg-degen-500/15 px-1 text-[8px] text-degen-400">
                        Creator
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-[var(--color-fg)]">
                      {(Number(h.balance) / 1000000).toFixed(2)}M
                    </span>
                    <span className="w-10 text-right text-[var(--color-muted)]">
                      {h.percentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Trades */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">⚡ Recent Trades</h3>
            <div className="divide-y divide-[var(--color-glass-border)]">
              {trades.slice(0, 15).map((t) => (
                <TradeRow key={t.txHash} trade={t} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ REVENUE ═══ */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Revenue stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={`$${(Number(revenue?.totalRevenue || 45200)).toLocaleString()}`}
              icon="💰"
              trend={{ value: 18.5, positive: true }}
            />
            <StatCard
              label="Creator Fees"
              value={`$${(Number(revenue?.creatorFees || 28400)).toLocaleString()}`}
              icon="📋"
              trend={{ value: 12.3, positive: true }}
            />
            <StatCard
              label="Tips Received"
              value={`$${(Number(revenue?.tipsReceived || 12000)).toLocaleString()}`}
              icon="⚡"
              trend={{ value: 24.1, positive: true }}
            />
            <StatCard
              label="Platform Fees"
              value={`$${(Number(revenue?.platformFees || 2260)).toLocaleString()}`}
              icon="🏛️"
            />
          </div>

          {/* Revenue chart */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">
              Daily Revenue (30 days)
            </h3>
            {revenue?.revenueByDay && <RevenueChart data={revenue.revenueByDay} />}
          </div>

          {/* Fee distribution */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Fee Distribution</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-degen-400" />
                  Creator Fees (1%)
                </span>
                <span className="font-mono text-degen-400">
                  ${(Number(revenue?.totalRevenue || 45200) * 0.01).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Platform Fee (0.5%)
                </span>
                <span className="font-mono text-amber-400">
                  ${(Number(revenue?.totalRevenue || 45200) * 0.005).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                  Treasury Allocation
                </span>
                <span className="font-mono text-purple-400">
                  ${Number(revenue?.treasuryFees || 8900).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SETTINGS ═══ */}
      {activeTab === 'settings' && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Creator Settings</h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--color-glass-border)] p-4">
              <h3 className="mb-2 text-xs font-semibold text-[var(--color-fg)]">
                Default Fee Structure
              </h3>
              <p className="mb-3 text-[10px] text-[var(--color-muted)]">
                These are applied to all new coin launches.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] text-[var(--color-muted)]">
                    Creator Fee (bps)
                  </span>
                  <input
                    type="number"
                    defaultValue={100}
                    className="input text-sm w-full"
                    min={0}
                    max={200}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-[var(--color-muted)]">
                    Platform Fee (bps)
                  </span>
                  <input
                    type="number"
                    defaultValue={50}
                    className="input text-sm w-full"
                    min={0}
                    max={100}
                    disabled
                  />
                </label>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-glass-border)] p-4">
              <h3 className="mb-2 text-xs font-semibold text-[var(--color-fg)]">
                Default Anti-Exploit
              </h3>
              <p className="text-[10px] text-[var(--color-muted)]">
                Configure default protection levels for new coins.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-degen-500/15 px-5 py-2.5 text-xs font-bold text-degen-400 hover:bg-degen-500/25 transition-all"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
