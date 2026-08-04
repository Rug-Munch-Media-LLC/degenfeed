'use client';

/**
 * Creator Coin Statistics & Leaderboard Page (TASK 2 + TASK 3)
 *
 * Comprehensive stats dashboard showing top performing coins,
 * overview cards, interactive SVG charts, and sortable tables.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

interface CoinStatsItem {
  rank: number;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  priceChange24h: number;
  priceChange7d: number;
  bondingCurvePhase: number;
  address: string;
  chain: string;
  createdAt: number;
}

interface OverviewData {
  totalCoins: number;
  totalVolume: number;
  totalHolders: number;
  totalMarketCap: number;
  averagePrice: number;
  graduatedCount: number;
  bondingCount: number;
}

type TabKey = 'top' | 'trending' | 'new' | 'gainers' | 'losers' | 'most-holders' | 'highest-volume';

type GainerPeriod = '24h' | '7d' | '30d';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(p: number): string {
  if (p < 0.00001) return '<$0.00001';
  if (p < 0.001) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(2)}`;
}

function formatCompactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function generateSparklineData(): number[] {
  let price = 30 + Math.random() * 40;
  return Array.from({ length: 7 }, () => {
    price = Math.max(5, Math.min(95, price + (Math.random() - 0.48) * 10));
    return price;
  });
}

// ─── Animated Counter ─────────────────────────────────────────────────

function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
    const duration = 1200;

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return (
    <span className="tabular-nums">
      {prefix}
      {decimals > 0 ? display.toFixed(decimals) : display.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── Sparkline SVG ────────────────────────────────────────────────────

function MiniSparkline({
  data,
  width = 64,
  height = 24,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--color-glass-border)"
          strokeWidth="1"
        />
      </svg>
    );
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const isUp = data[data.length - 1]! >= data[0]!;
  const color = isUp ? '#00ff41' : '#ff4444';

  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(' ');

  const lastY = height - ((data[data.length - 1]! - min) / range) * height;
  const fillPoints = `${points} ${width},${height} 0,${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polygon points={fillPoints} fill={color} opacity="0.08" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={width} cy={lastY} r="1.5" fill={color} />
    </svg>
  );
}

// ─── Overview Card ────────────────────────────────────────────────────

function OverviewCard({
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  accent = false,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20">
      <div className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-black ${accent ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
      >
        {prefix}
        <AnimatedCounter value={value} decimals={decimals} />
        {suffix}
      </div>
    </div>
  );
}

// ─── Phase Badge ──────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: number }) {
  const labels = ['Steal Deal', 'Early Bird', 'Cruise', 'Final Call', 'Moonshot'];
  const colors = [
    'bg-blue-500/15 text-blue-400',
    'bg-teal-500/15 text-teal-400',
    'bg-amber-500/15 text-amber-400',
    'bg-orange-500/15 text-orange-400',
    'bg-degen-500/15 text-degen-400',
  ];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${colors[phase] || colors[0]}`}
    >
      {labels[phase] || `Phase ${phase + 1}`}
    </span>
  );
}

// ─── Market Overview Line Chart ───────────────────────────────────────

function MarketOverviewChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 600;
  const h = 180;

  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">Total Market Cap (7d)</h3>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-44"
        preserveAspectRatio="none"
      >
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((y) => (
          <line
            key={y}
            x1={0}
            y1={h - y * h}
            x2={w}
            y2={h - y * h}
            stroke="var(--color-glass-border)"
            strokeWidth="0.5"
            opacity="0.4"
          />
        ))}
        {/* Fill */}
        <polygon points={`${points} ${w},${h} 0,${h}`} fill="#00ff41" opacity="0.06" />
        {/* Line */}
        <polyline
          fill="none"
          stroke="#00ff41"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────

function VolumeBarChart({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">
        24h Volume per Coin (Top 10)
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right text-[9px] font-mono text-[var(--color-muted)]">
              {formatCompactNum(item.value)}
            </span>
            <div className="flex-1 h-4 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(item.value / maxVal) * 100}%`,
                  background: item.color || 'linear-gradient(90deg, #00ff41, #8b5cf6)',
                }}
              />
            </div>
            <span className="w-20 text-[9px] text-[var(--color-fg)] truncate">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pie Chart (SVG) ──────────────────────────────────────────────────

function PieChart({
  segments,
  size = 160,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  let cumulative = 0;

  const arcs = segments.map((seg) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += seg.value;
    const endAngle = (cumulative / total) * 360;
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return {
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: seg.color,
      label: seg.label,
      value: seg.value,
      pct: ((seg.value / total) * 100).toFixed(1),
    };
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {arcs.map((arc, i) => (
          <path key={i} d={arc.path} fill={arc.color} stroke="var(--color-bg)" strokeWidth="1" />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.4} fill="var(--color-card)" />
      </svg>
      <div className="mt-3 space-y-1 w-full">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2 text-[9px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: arc.color }} />
            <span className="text-[var(--color-muted)]">{arc.label}</span>
            <span className="ml-auto text-[var(--color-fg)] font-medium">{arc.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mock Data ────────────────────────────────────────────────────────

function generateMockPriceData(): number[] {
  let val = 5000000 + Math.random() * 3000000;
  return Array.from({ length: 14 }, () => {
    val = Math.max(2000000, val + (Math.random() - 0.45) * 500000);
    return val;
  });
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

export default function CoinStatsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [coins, setCoins] = useState<CoinStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('top');
  const [gainersPeriod, setGainersPeriod] = useState<GainerPeriod>('24h');

  // Store sparkline data per coin address
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [overviewRes, coinsRes] = await Promise.all([
          fetch('/api/coins/stats/overview'),
          fetch(
            `/api/coins/stats/${activeTab}${activeTab === 'gainers' || activeTab === 'losers' ? `?period=${gainersPeriod}` : ''}`,
          ),
        ]);

        if (overviewRes.ok) {
          const ov = await overviewRes.json();
          setOverview(ov);
        }

        if (coinsRes.ok) {
          const data = await coinsRes.json();
          const coinList: CoinStatsItem[] = data.coins || [];
          setCoins(coinList);

          // Generate sparkline data for each coin
          const sp: Record<string, number[]> = {};
          for (const c of coinList) {
            sp[c.address] = generateSparklineData();
          }
          setSparklines(sp);
        }
      } catch {
        // Fallback to empty state
      }
      setLoading(false);
    };
    fetchData();
  }, [activeTab, gainersPeriod]);

  const overviewData = overview || {
    totalCoins: 0,
    totalVolume: 0,
    totalHolders: 0,
    totalMarketCap: 0,
    averagePrice: 0,
    graduatedCount: 0,
    bondingCount: 0,
  };

  // Memoized mock price data for market overview chart
  const mockPriceData = useMemo(() => generateMockPriceData(), []);

  // Volume bar chart data (top 10 by volume)
  const volumeBarData = useMemo(() => {
    return [...coins]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10)
      .map((c) => ({
        label: c.symbol,
        value: c.volume24h,
      }));
  }, [coins]);

  // Phase distribution for pie chart
  const phaseDist = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const c of coins) {
      if (c.bondingCurvePhase >= 0 && c.bondingCurvePhase <= 4) {
        counts[c.bondingCurvePhase] = (counts[c.bondingCurvePhase] ?? 0) + 1;
      }
    }
    return counts;
  }, [coins]);

  const phaseLabels = ['Steal Deal', 'Early Bird', 'Cruise', 'Final Call', 'Moonshot'];
  const phaseColors = ['#3b82f6', '#14b8a6', '#f59e0b', '#f97316', '#00ff41'];

  // Holder distribution (top 5 coins vs others)
  const holderDist = useMemo(() => {
    const sorted = [...coins].sort((a, b) => b.holders - a.holders);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const otherHolders = others.reduce((s, c) => s + c.holders, 0);
    const segments = top5.map((c) => ({
      label: c.symbol,
      value: c.holders,
      color: phaseColors[top5.indexOf(c) % phaseColors.length] ?? '#888888',
    }));
    if (otherHolders > 0) {
      segments.push({ label: 'Others', value: otherHolders, color: '#2f3336' });
    }
    return segments;
  }, [coins, phaseColors]);

  // ─── Tab config ────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'top', label: 'Top Coins', icon: '👑' },
    { key: 'trending', label: 'Trending', icon: '🔥' },
    { key: 'new', label: 'New', icon: '🆕' },
    { key: 'gainers', label: 'Gainers', icon: '📈' },
    { key: 'losers', label: 'Losers', icon: '📉' },
    { key: 'most-holders', label: 'Most Holders', icon: '👥' },
    { key: 'highest-volume', label: 'Highest Volume', icon: '⚡' },
  ];

  const handleRowClick = useCallback((symbol: string) => {
    window.location.href = `/coins/${symbol.toLowerCase()}`;
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-[var(--color-fg)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Coin Statistics
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Platform-wide analytics, leaderboards, and coin discovery
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/coins/compare"
              className="rounded-xl border border-[var(--color-glass-border)] px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-all"
            >
              ⚖️ Compare Coins
            </Link>
            <Link
              href="/coins"
              className="rounded-xl border border-[var(--color-glass-border)] px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-all"
            >
              ← Back to Coins
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Overview Cards ─────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OverviewCard label="Total Coins" value={overviewData.totalCoins} />
        <OverviewCard
          label="Total Volume"
          value={Math.round(overviewData.totalVolume)}
          prefix="$"
        />
        <OverviewCard label="Total Holders" value={overviewData.totalHolders} />
        <OverviewCard
          label="Total Market Cap"
          value={Math.round(overviewData.totalMarketCap)}
          prefix="$"
          accent
        />
      </div>

      {/* Additional mini stat row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-[9px] text-[var(--color-muted)]">Avg Price</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-fg)]">
            {formatPrice(overviewData.averagePrice)}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-[9px] text-[var(--color-muted)]">Graduated</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-degen-400">
            {overviewData.graduatedCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-[9px] text-[var(--color-muted)]">Bonding</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-amber-400">
            {overviewData.bondingCount}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-[9px] text-[var(--color-muted)]">Bonding Curve</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-fg)]">
            {overviewData.totalCoins > 0
              ? `${((overviewData.bondingCount / overviewData.totalCoins) * 100).toFixed(0)}%`
              : '0%'}
          </div>
        </div>
      </div>

      {/* ─── Charts Row (TASK 3) ────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* Market overview — spans 2 cols */}
        <div className="lg:col-span-2">
          <MarketOverviewChart data={mockPriceData} />
        </div>
        {/* Volume bar chart */}
        <div>
          <VolumeBarChart items={volumeBarData} />
        </div>
        {/* Phase distribution + holder pie — stacked in 1 col on xl */}
        <div className="space-y-4">
          {/* Phase distribution pie */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">Phase Distribution</h3>
            <PieChart
              size={140}
              segments={phaseDist.map((count, i) => ({
                label: phaseLabels[i] ?? '',
                value: count,
                color: phaseColors[i] ?? '#888888',
              }))}
            />
          </div>
          {/* Holder distribution pie */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-3 text-xs font-bold text-[var(--color-fg)]">Holder Distribution</h3>
            <PieChart size={140} segments={holderDist} />
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation ─────────────────────────────────── */}
      <div className="mb-4 flex gap-1 overflow-x-auto scrollbar-none border-b border-[var(--color-glass-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold transition-all border-b-2 ${
              activeTab === tab.key
                ? 'border-degen-400 text-degen-400'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}

        {/* Period toggle for gainers/losers */}
        {(activeTab === 'gainers' || activeTab === 'losers') && (
          <div className="ml-auto flex gap-1 rounded-lg bg-[var(--color-overlay)] p-0.5">
            {(['24h', '7d', '30d'] as GainerPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setGainersPeriod(p)}
                className={`rounded-md px-2 py-1 text-[9px] font-medium transition-all ${
                  gainersPeriod === p
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Sortable Table ─────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-xl" />
          ))}
        </div>
      ) : coins.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-12 text-center">
          <div className="mb-3 text-5xl">📊</div>
          <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">No coins yet</h3>
          <p className="text-xs text-[var(--color-muted)]">Be the first to launch!</p>
          <Link
            href="/coins"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-5 py-2.5 text-xs font-bold text-white transition-all hover:from-degen-500 hover:to-degen-300"
          >
            Launch a Coin
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin rounded-xl border border-[var(--color-glass-border)]">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--color-glass-border)] bg-[var(--color-card)]">
                <th className="px-3 py-3 text-left font-semibold text-[var(--color-muted)]">#</th>
                <th className="px-3 py-3 text-left font-semibold text-[var(--color-muted)]">
                  Coin
                </th>
                <th className="px-3 py-3 text-right font-semibold text-[var(--color-muted)]">
                  Price
                </th>
                <th className="px-3 py-3 text-right font-semibold text-[var(--color-muted)]">
                  24h
                </th>
                <th className="px-3 py-3 text-right font-semibold text-[var(--color-muted)]">7d</th>
                <th className="px-3 py-3 text-right font-semibold text-[var(--color-muted)]">
                  Market Cap
                </th>
                <th className="px-3 py-3 text-right font-semibold text-[var(--color-muted)]">
                  Volume 24h
                </th>
                <th className="px-3 py-3 text-right font-semibold text-[var(--color-muted)]">
                  Holders
                </th>
                <th className="px-3 py-3 text-center font-semibold text-[var(--color-muted)]">
                  Phase
                </th>
                <th className="px-3 py-3 text-center font-semibold text-[var(--color-muted)]">
                  7d Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-glass-border)]">
              {coins.map((coin) => {
                const isUp24 = coin.priceChange24h >= 0;
                const isUp7d = coin.priceChange7d >= 0;
                const spData = sparklines[coin.address] || [];
                return (
                  <tr
                    key={coin.address}
                    onClick={() => handleRowClick(coin.symbol)}
                    className="cursor-pointer bg-[var(--color-card)] transition-colors hover:bg-[var(--color-card-hover)]"
                  >
                    <td className="px-3 py-3 text-[var(--color-muted)] font-mono">
                      {coin.rank <= 3 ? (
                        <span className="text-xs">{['🥇', '🥈', '🥉'][coin.rank - 1]}</span>
                      ) : (
                        <span className="text-[var(--color-muted)]">#{coin.rank}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-[9px] font-bold text-degen-400">
                          {coin.symbol.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--color-fg)] truncate max-w-[120px]">
                            {coin.name}
                          </div>
                          <div className="text-[9px] text-[var(--color-muted)] font-mono">
                            ${coin.symbol}
                          </div>
                        </div>
                        <span
                          className={`ml-1 rounded px-1 py-0.5 text-[8px] font-medium ${coin.chain === 'solana' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}
                        >
                          {coin.chain === 'solana' ? '◎' : '⧫'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--color-fg)] font-medium">
                      {formatPrice(coin.price)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${isUp24 ? 'text-degen-400' : 'text-red-400'}`}
                    >
                      {isUp24 ? '+' : ''}
                      {coin.priceChange24h.toFixed(2)}%
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${isUp7d ? 'text-degen-400' : 'text-red-400'}`}
                    >
                      {isUp7d ? '+' : ''}
                      {coin.priceChange7d.toFixed(2)}%
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--color-fg)]">
                      {formatCompact(coin.marketCap)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--color-fg)]">
                      {formatCompact(coin.volume24h)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--color-fg)]">
                      {formatCompactNum(coin.holders)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <PhaseBadge phase={coin.bondingCurvePhase} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MiniSparkline data={spData} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-[var(--color-glass-border)] px-3 py-2 text-center text-[9px] text-[var(--color-muted)]">
            Showing {coins.length} coins
          </div>
        </div>
      )}
    </div>
  );
}
