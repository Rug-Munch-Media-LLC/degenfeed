'use client';

/**
 * Coin Comparison Tool with Scoring (TASK 4)
 *
 * Side-by-side comparison of up to 5 creator coins.
 * Features: search, add/remove, metric cards, mini charts, share link.
 * Enhanced with:
 * - Risk Score: based on creator allocation, vesting, liquidity
 * - Transparency Score: based on wallet labeling, parameter disclosure
 * - Community Score: based on holder count, activity, DAO participation
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════

interface CoinCompareData {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  price: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  priceChange24h: number;
  priceChange7d: number;
  bondingCurvePhase: number;
  createdAt: number;

  // Scoring fields
  creatorAllocation: number;
  creatorVested: number;
  liquidityDepth: number;
  walletLabeled: boolean;
  feeDisclosed: boolean;
  hasDao: boolean;
  bundlingDetected: boolean;
  graduated: boolean;
  auditTrail: boolean;
  socialActivity: number;
  daoProposals: number;
  avgHoldTime: number;
}

interface Scores {
  risk: number; // 0-100 (higher = riskier)
  transparency: number; // 0-100
  community: number; // 0-100
  overall: number; // 0-100
}

// ══════════════════════════════════════════════════════════════════════
// MOCK DATA
// ══════════════════════════════════════════════════════════════════════

const MOCK_ALL_COINS: CoinCompareData[] = [
  {
    address: '0x0000000000000000000000000000000000000001',
    name: 'Degen Alice',
    symbol: 'ALICE',
    chain: 'base',
    price: 0.0123,
    marketCap: 1250000,
    volume24h: 89000,
    holders: 342,
    priceChange24h: 12.4,
    priceChange7d: 28.1,
    bondingCurvePhase: 2,
    createdAt: Date.now() - 86400000 * 3,
    creatorAllocation: 5,
    creatorVested: 60,
    liquidityDepth: 420000,
    walletLabeled: true,
    feeDisclosed: true,
    hasDao: true,
    bundlingDetected: false,
    graduated: false,
    auditTrail: true,
    socialActivity: 856,
    daoProposals: 12,
    avgHoldTime: 14,
  },
  {
    address: '0x0000000000000000000000000000000000000002',
    name: 'Bob Protocol',
    symbol: 'BOB',
    chain: 'solana',
    price: 0.0089,
    marketCap: 890000,
    volume24h: 65000,
    holders: 198,
    priceChange24h: -5.2,
    priceChange7d: 15.3,
    bondingCurvePhase: 1,
    createdAt: Date.now() - 86400000 * 7,
    creatorAllocation: 8,
    creatorVested: 40,
    liquidityDepth: 230000,
    walletLabeled: true,
    feeDisclosed: true,
    hasDao: true,
    bundlingDetected: true,
    graduated: false,
    auditTrail: false,
    socialActivity: 423,
    daoProposals: 5,
    avgHoldTime: 8,
  },
  {
    address: '0x0000000000000000000000000000000000000003',
    name: 'Charlie Coin',
    symbol: 'CHAR',
    chain: 'base',
    price: 0.0456,
    marketCap: 3200000,
    volume24h: 210000,
    holders: 567,
    priceChange24h: 25.8,
    priceChange7d: 42.0,
    bondingCurvePhase: 3,
    createdAt: Date.now() - 86400000 * 14,
    creatorAllocation: 3,
    creatorVested: 80,
    liquidityDepth: 1200000,
    walletLabeled: true,
    feeDisclosed: true,
    hasDao: true,
    bundlingDetected: false,
    graduated: true,
    auditTrail: true,
    socialActivity: 2341,
    daoProposals: 24,
    avgHoldTime: 21,
  },
  {
    address: '0x0000000000000000000000000000000000000004',
    name: 'Diana Token',
    symbol: 'DIA',
    chain: 'solana',
    price: 0.0021,
    marketCap: 420000,
    volume24h: 31000,
    holders: 89,
    priceChange24h: -8.4,
    priceChange7d: -12.6,
    bondingCurvePhase: 0,
    createdAt: Date.now() - 86400000 * 1,
    creatorAllocation: 15,
    creatorVested: 10,
    liquidityDepth: 45000,
    walletLabeled: false,
    feeDisclosed: true,
    hasDao: false,
    bundlingDetected: true,
    graduated: false,
    auditTrail: false,
    socialActivity: 89,
    daoProposals: 0,
    avgHoldTime: 2,
  },
  {
    address: '0x0000000000000000000000000000000000000005',
    name: 'Eve Finance',
    symbol: 'EVE',
    chain: 'base',
    price: 0.0312,
    marketCap: 2100000,
    volume24h: 145000,
    holders: 423,
    priceChange24h: 6.7,
    priceChange7d: -3.2,
    bondingCurvePhase: 2,
    createdAt: Date.now() - 86400000 * 10,
    creatorAllocation: 6,
    creatorVested: 50,
    liquidityDepth: 750000,
    walletLabeled: true,
    feeDisclosed: true,
    hasDao: true,
    bundlingDetected: false,
    graduated: true,
    auditTrail: true,
    socialActivity: 1245,
    daoProposals: 8,
    avgHoldTime: 12,
  },
  {
    address: '0x0000000000000000000000000000000000000006',
    name: 'Frank DeFi',
    symbol: 'FRANK',
    chain: 'solana',
    price: 0.0015,
    marketCap: 180000,
    volume24h: 12000,
    holders: 45,
    priceChange24h: 45.2,
    priceChange7d: 80.1,
    bondingCurvePhase: 0,
    createdAt: Date.now() - 86400000 * 2,
    creatorAllocation: 20,
    creatorVested: 5,
    liquidityDepth: 25000,
    walletLabeled: false,
    feeDisclosed: false,
    hasDao: false,
    bundlingDetected: true,
    graduated: false,
    auditTrail: false,
    socialActivity: 34,
    daoProposals: 0,
    avgHoldTime: 1,
  },
  {
    address: '0x0000000000000000000000000000000000000007',
    name: 'Grace Swap',
    symbol: 'GRACE',
    chain: 'base',
    price: 0.0189,
    marketCap: 1560000,
    volume24h: 98000,
    holders: 278,
    priceChange24h: -2.1,
    priceChange7d: 5.6,
    bondingCurvePhase: 1,
    createdAt: Date.now() - 86400000 * 5,
    creatorAllocation: 4,
    creatorVested: 70,
    liquidityDepth: 510000,
    walletLabeled: true,
    feeDisclosed: true,
    hasDao: false,
    bundlingDetected: false,
    graduated: false,
    auditTrail: false,
    socialActivity: 567,
    daoProposals: 0,
    avgHoldTime: 10,
  },
  {
    address: '0x0000000000000000000000000000000000000008',
    name: 'Harry Hedge',
    symbol: 'HARRY',
    chain: 'solana',
    price: 0.0056,
    marketCap: 890000,
    volume24h: 42000,
    holders: 156,
    priceChange24h: 18.3,
    priceChange7d: 33.7,
    bondingCurvePhase: 2,
    createdAt: Date.now() - 86400000 * 8,
    creatorAllocation: 10,
    creatorVested: 30,
    liquidityDepth: 180000,
    walletLabeled: true,
    feeDisclosed: true,
    hasDao: true,
    bundlingDetected: false,
    graduated: false,
    auditTrail: true,
    socialActivity: 345,
    daoProposals: 3,
    avgHoldTime: 6,
  },
  {
    address: '0x0000000000000000000000000000000000000009',
    name: 'Ivy Invest',
    symbol: 'IVY',
    chain: 'base',
    price: 0.0678,
    marketCap: 5100000,
    volume24h: 380000,
    holders: 891,
    priceChange24h: 32.1,
    priceChange7d: 55.4,
    bondingCurvePhase: 4,
    createdAt: Date.now() - 86400000 * 30,
    creatorAllocation: 2,
    creatorVested: 95,
    liquidityDepth: 2500000,
    walletLabeled: true,
    feeDisclosed: true,
    hasDao: true,
    bundlingDetected: false,
    graduated: true,
    auditTrail: true,
    socialActivity: 4567,
    daoProposals: 32,
    avgHoldTime: 35,
  },
  {
    address: '0x000000000000000000000000000000000000000a',
    name: 'Jack Jump',
    symbol: 'JUMP',
    chain: 'solana',
    price: 0.0034,
    marketCap: 670000,
    volume24h: 53000,
    holders: 134,
    priceChange24h: -12.8,
    priceChange7d: -22.4,
    bondingCurvePhase: 1,
    createdAt: Date.now() - 86400000 * 4,
    creatorAllocation: 12,
    creatorVested: 20,
    liquidityDepth: 95000,
    walletLabeled: false,
    feeDisclosed: false,
    hasDao: false,
    bundlingDetected: true,
    graduated: false,
    auditTrail: false,
    socialActivity: 123,
    daoProposals: 0,
    avgHoldTime: 3,
  },
];

// ══════════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ══════════════════════════════════════════════════════════════════════

function computeScores(coin: CoinCompareData): Scores {
  // Risk Score (0 = safest, 100 = riskiest)
  const allocRisk = Math.min(coin.creatorAllocation / 20, 1) * 40;
  const vestingRisk = (1 - coin.creatorVested / 100) * 30;
  const liquidityRisk = coin.liquidityDepth < 100000 ? 30 : coin.liquidityDepth < 500000 ? 15 : 5;
  const bundlingRisk = coin.bundlingDetected ? 20 : 0;
  const graduatedBonus = coin.graduated ? -15 : 0;
  const risk = Math.max(
    0,
    Math.min(100, allocRisk + vestingRisk + liquidityRisk + bundlingRisk + graduatedBonus),
  );

  // Transparency Score (0-100)
  const walletLabelScore = coin.walletLabeled ? 35 : 0;
  const feeScore = coin.feeDisclosed ? 25 : 0;
  const auditScore = coin.auditTrail ? 20 : 0;
  const daoScore = coin.hasDao ? 10 : 0;
  const bundlingScore = coin.bundlingDetected ? -10 : 5;
  const transparency = Math.max(
    0,
    Math.min(100, walletLabelScore + feeScore + auditScore + daoScore + bundlingScore),
  );

  // Community Score (0-100)
  const holderScore = Math.min(coin.holders / 1000, 1) * 40;
  const socialScore = Math.min(coin.socialActivity / 5000, 1) * 25;
  const daoActivityScore = Math.min(coin.daoProposals / 30, 1) * 20;
  const holdTimeScore = Math.min(coin.avgHoldTime / 30, 1) * 15;
  const community = Math.round(holderScore + socialScore + daoActivityScore + holdTimeScore);

  // Overall Score (weighted average, higher is better)
  const overall = Math.round(transparency * 0.35 + community * 0.35 + (100 - risk) * 0.3);
  return { risk: Math.round(risk), transparency, community, overall };
}

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

function generateSparkline(): number[] {
  let price = 30 + Math.random() * 40;
  return Array.from({ length: 7 }, () => {
    price = Math.max(5, Math.min(95, price + (Math.random() - 0.48) * 10));
    return price;
  });
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════

/* ── Mini Chart ──────────────────────────────────── */
function MiniPriceChart({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 140;
  const h = 50;
  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? '#00ff41' : '#ff4444';
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={`${points} ${w},${h} 0,${h}`} fill={color} opacity="0.06" />
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

/* ── Score Gauge ─────────────────────────────────── */
function ScoreGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const getColor = (v: number) => {
    if (v >= 80) return '#00ff41';
    if (v >= 50) return '#f59e0b';
    return '#ef4444';
  };
  const c = color || getColor(value);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <svg className="absolute inset-0" viewBox="0 0 36 36" aria-hidden="true">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="var(--color-glass-border)"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={c}
            strokeWidth="3"
            strokeDasharray={`${value}, 100`}
            strokeLinecap="round"
          />
        </svg>
        <span className="text-[9px] font-black tabular-nums" style={{ color: c }}>
          {value}
        </span>
      </div>
      <span className="text-[7px] text-[var(--color-muted)]">{label}</span>
    </div>
  );
}

/* ── Phase Label ─────────────────────────────────── */
function PhaseLabel({ phase }: { phase: number }) {
  const labels = ['Steal Deal', 'Early Bird', 'Cruise', 'Final Call', 'Moonshot'];
  return <span>{labels[phase] || `Phase ${phase + 1}`}</span>;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

export default function CoinComparePage() {
  const [selectedCoins, setSelectedCoins] = useState<CoinCompareData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CoinCompareData[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [sortBy, setSortBy] = useState<'overall' | 'risk' | 'transparency' | 'community'>(
    'overall',
  );

  // Load from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const symbols = params.get('coins')?.split(',').filter(Boolean) || [];
    if (symbols.length > 0) {
      const found = MOCK_ALL_COINS.filter((c) =>
        symbols.some((s) => s.toUpperCase() === c.symbol.toUpperCase()),
      );
      setSelectedCoins(found);
      const sp: Record<string, number[]> = {};
      for (const c of found) sp[c.address] = generateSparkline();
      setSparklines(sp);
    }
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = MOCK_ALL_COINS.filter(
      (c) =>
        !selectedCoins.find((s) => s.address === c.address) &&
        (c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)),
    );
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  }, [searchQuery, selectedCoins]);

  const addCoin = useCallback(
    (coin: CoinCompareData) => {
      if (selectedCoins.length >= 5) return;
      if (selectedCoins.find((c) => c.address === coin.address)) return;
      setSelectedCoins((prev) => [...prev, coin]);
      setSparklines((prev) => ({ ...prev, [coin.address]: generateSparkline() }));
      setSearchQuery('');
      setShowDropdown(false);
    },
    [selectedCoins],
  );

  const removeCoin = useCallback((address: string) => {
    setSelectedCoins((prev) => prev.filter((c) => c.address !== address));
  }, []);

  const shareUrl = useMemo(() => {
    if (selectedCoins.length === 0) return null;
    const symbols = selectedCoins.map((c) => c.symbol).join(',');
    return `${window.location.origin}/coins/compare?coins=${symbols}`;
  }, [selectedCoins]);

  const copyShareLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch {
      alert('Could not copy link');
    }
  }, [shareUrl]);

  // Compute scores
  const scoredCoins = useMemo(() => {
    return selectedCoins.map((c) => ({ coin: c, scores: computeScores(c) }));
  }, [selectedCoins]);

  // Sort
  const sortedScoredCoins = useMemo(() => {
    const sorted = [...scoredCoins];
    if (sortBy === 'overall') sorted.sort((a, b) => b.scores.overall - a.scores.overall);
    else if (sortBy === 'risk') sorted.sort((a, b) => a.scores.risk - b.scores.risk);
    else if (sortBy === 'transparency')
      sorted.sort((a, b) => b.scores.transparency - a.scores.transparency);
    else sorted.sort((a, b) => b.scores.community - a.scores.community);
    return sorted;
  }, [scoredCoins, sortBy]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-[var(--color-fg)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              ⚖️ Coin Comparison
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Compare up to 5 coins with risk, transparency, and community scores
            </p>
          </div>
          <Link
            href="/coins/stats"
            className="rounded-xl border border-[var(--color-glass-border)] px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-all"
          >
            ← Back to Stats
          </Link>
        </div>
      </div>

      {/* ─── Search Bar ─────────────────────────────────── */}
      <div ref={searchRef} className="relative mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder={
              selectedCoins.length >= 5 ? 'Max 5 coins selected' : 'Search coins to compare...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={selectedCoins.length >= 5}
            className="input w-full pl-9 pr-4 py-3 text-sm"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] shadow-xl max-h-60 overflow-y-auto scrollbar-thin">
            {searchResults.map((coin) => {
              const scores = computeScores(coin);
              return (
                <button
                  key={coin.address}
                  type="button"
                  onClick={() => addCoin(coin)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs hover:bg-[var(--color-overlay)] transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xs font-bold text-degen-400">
                    {coin.symbol.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--color-fg)]">{coin.name}</div>
                    <div className="text-[9px] text-[var(--color-muted)]">
                      ${coin.symbol} · {formatPrice(coin.price)}
                    </div>
                  </div>
                  <ScoreGauge
                    label=""
                    value={scores.overall}
                    color={
                      scores.overall >= 80
                        ? '#00ff41'
                        : scores.overall >= 50
                          ? '#f59e0b'
                          : '#ef4444'
                    }
                  />
                  <span className="rounded-lg bg-degen-500/15 px-2 py-1 text-[9px] font-semibold text-degen-400">
                    + Add
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {selectedCoins.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedCoins.map((coin) => (
              <div
                key={coin.address}
                className="flex items-center gap-2 rounded-xl border-degen-500/30 bg-degen-500/10 px-3 py-1.5 border"
              >
                <span className="text-xs font-semibold text-degen-400">${coin.symbol}</span>
                <button
                  type="button"
                  onClick={() => removeCoin(coin.address)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-[var(--color-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Empty State ───────────────────────────────── */}
      {selectedCoins.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-12 text-center">
          <div className="mb-3 text-5xl">⚖️</div>
          <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Select coins to compare</h3>
          <p className="text-xs text-[var(--color-muted)]">
            Search and add up to 5 coins to compare scores, metrics, and risk levels.
            <br />
            Share your comparison with a link.
          </p>
        </div>
      ) : (
        <>
          {/* ─── Sort + Share ──────────────────────────── */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-lg border border-[var(--color-glass-border)] p-0.5">
              {(['overall', 'transparency', 'community', 'risk'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSortBy(s)}
                  className={`rounded-md px-2.5 py-1 text-[9px] font-medium transition-all capitalize ${sortBy === s ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
                >
                  {s === 'risk' ? '⬇ Lowest Risk' : `⬇ Best ${s}`}
                </button>
              ))}
            </div>
            {shareUrl && (
              <button
                type="button"
                onClick={copyShareLink}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-[9px] font-medium text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-all"
              >
                📋 Share Comparison
              </button>
            )}
          </div>

          {/* ─── Comparison Grid ────────────────────────── */}
          <div className="overflow-x-auto scrollbar-thin rounded-xl border border-[var(--color-glass-border)]">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[var(--color-glass-border)] bg-[var(--color-card)]">
                  <th className="w-32 px-3 py-3 text-left font-semibold text-[var(--color-muted)]">
                    Metric
                  </th>
                  {sortedScoredCoins.map(({ coin }) => (
                    <th key={coin.address} className="px-3 py-3 text-center min-w-[160px]">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-[9px] font-bold text-degen-400">
                          {coin.symbol.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-[var(--color-fg)]">{coin.name}</div>
                          <div className="text-[9px] text-[var(--color-muted)] font-mono">
                            ${coin.symbol}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCoin(coin.address)}
                          className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] text-[var(--color-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-glass-border)]">
                {/* OVERALL SCORE */}
                <tr className="bg-degen-500/[0.02]">
                  <td className="px-3 py-3 font-bold text-degen-400 text-[10px]">
                    🏆 Overall Score
                  </td>
                  {sortedScoredCoins.map(({ coin, scores }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <ScoreGauge label="Score" value={scores.overall} color="" />
                        <div
                          className={`text-xs font-black tabular-nums ${scores.overall >= 80 ? 'text-degen-400' : scores.overall >= 50 ? 'text-amber-400' : 'text-red-400'}`}
                        >
                          {scores.overall}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* RISK SCORE */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">⬇ Risk Score</td>
                  {sortedScoredCoins.map(({ coin, scores }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div
                          className={`h-2 w-full max-w-[60px] rounded-full bg-[var(--color-glass-border)] overflow-hidden`}
                        >
                          <div
                            className={`h-full rounded-full ${scores.risk >= 60 ? 'bg-red-400' : scores.risk >= 30 ? 'bg-amber-400' : 'bg-degen-400'}`}
                            style={{ width: `${scores.risk}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-bold tabular-nums ${scores.risk >= 60 ? 'text-red-400' : scores.risk >= 30 ? 'text-amber-400' : 'text-degen-400'}`}
                        >
                          {scores.risk}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* TRANSPARENCY SCORE */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">
                    🔍 Transparency
                  </td>
                  {sortedScoredCoins.map(({ coin, scores }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <ScoreGauge label="" value={scores.transparency} color="" />
                      <div className="text-xs font-bold tabular-nums text-[var(--color-fg)]">
                        {scores.transparency}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* COMMUNITY SCORE */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">👥 Community</td>
                  {sortedScoredCoins.map(({ coin, scores }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <ScoreGauge label="" value={scores.community} color="" />
                      <div className="text-xs font-bold tabular-nums text-[var(--color-fg)]">
                        {scores.community}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* PRICE */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Price</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)] font-bold"
                    >
                      {formatPrice(coin.price)}
                    </td>
                  ))}
                </tr>

                {/* 24h CHANGE */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">24h Change</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className={`px-3 py-3 text-center font-mono tabular-nums font-semibold ${coin.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
                    >
                      {coin.priceChange24h >= 0 ? '+' : ''}
                      {coin.priceChange24h.toFixed(2)}%
                    </td>
                  ))}
                </tr>

                {/* 7d CHANGE */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">7d Change</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className={`px-3 py-3 text-center font-mono tabular-nums font-semibold ${coin.priceChange7d >= 0 ? 'text-degen-400' : 'text-red-400'}`}
                    >
                      {coin.priceChange7d >= 0 ? '+' : ''}
                      {coin.priceChange7d.toFixed(2)}%
                    </td>
                  ))}
                </tr>

                {/* MARKET CAP */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Market Cap</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)]"
                    >
                      {formatCompact(coin.marketCap)}
                    </td>
                  ))}
                </tr>

                {/* VOLUME 24h */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Volume 24h</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)]"
                    >
                      {formatCompact(coin.volume24h)}
                    </td>
                  ))}
                </tr>

                {/* HOLDERS */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Holders</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)]"
                    >
                      {coin.holders.toLocaleString()}
                    </td>
                  ))}
                </tr>

                {/* CREATOR ALLOCATION */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">
                    Creator Allocation
                  </td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)]"
                    >
                      {coin.creatorAllocation}%
                    </td>
                  ))}
                </tr>

                {/* CREATOR VESTED */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">
                    Creator Vested
                  </td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="h-1.5 w-12 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-degen-400"
                            style={{ width: `${coin.creatorVested}%` }}
                          />
                        </div>
                        <span className="font-mono text-[var(--color-fg)]">
                          {coin.creatorVested}%
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* LIQUIDITY */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Liquidity</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)]"
                    >
                      {formatCompact(coin.liquidityDepth)}
                    </td>
                  ))}
                </tr>

                {/* DAO */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">DAO</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      {coin.hasDao ? (
                        <span className="text-degen-400">{coin.daoProposals} proposals</span>
                      ) : (
                        <span className="text-[var(--color-muted)]">None</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* BUNDLING */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Bundling</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      {coin.bundlingDetected ? (
                        <span className="text-red-400">⚠ Detected</span>
                      ) : (
                        <span className="text-degen-400">✓ None</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* WALLET LABELING */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Wallet Labels</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      {coin.walletLabeled ? (
                        <span className="text-degen-400">✓ Labeled</span>
                      ) : (
                        <span className="text-red-400">✗ Not labeled</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* AUDIT TRAIL */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Audit Trail</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      {coin.auditTrail ? (
                        <span className="text-degen-400">✓ Available</span>
                      ) : (
                        <span className="text-amber-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* CHAIN */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Chain</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${coin.chain === 'solana' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}`}
                      >
                        {coin.chain === 'solana' ? '◎ Solana' : '⧫ Base'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* PHASE */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Phase</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)]"
                    >
                      {coin.graduated ? (
                        '✅ Graduated'
                      ) : (
                        <PhaseLabel phase={coin.bondingCurvePhase} />
                      )}
                    </td>
                  ))}
                </tr>

                {/* MINI CHART */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">7d Chart</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <MiniPriceChart data={sparklines[coin.address] || generateSparkline()} />
                    </td>
                  ))}
                </tr>

                {/* ACTIONS */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Actions</td>
                  {sortedScoredCoins.map(({ coin }) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Link
                          href={`/coins/${coin.symbol.toLowerCase()}`}
                          className="inline-block rounded-lg bg-degen-500/15 px-3 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-all w-full"
                        >
                          View Details →
                        </Link>
                        <Link
                          href={`/coins/${coin.symbol.toLowerCase()}/community`}
                          className="inline-block rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-[9px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all w-full"
                        >
                          Community →
                        </Link>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
