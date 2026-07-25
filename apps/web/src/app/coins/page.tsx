'use client';

/**
 * Coin Discovery & Trading Hub (TASK 5)
 *
 * Browse all creator coins: trending, new, top gainers, search.
 * Each coin card shows sparkline chart, price, 24h change.
 * Links to detail page with Buy/Sell interface.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CoinCardWithSparkline,
  type CoinDisplayData,
} from '../../components/creator-coin/CoinCardWithSparkline';

// ─── Types ─────────────────────────────────────────────────────────────

type SortMode = 'trending' | 'newest' | 'gainers' | 'marketcap' | 'volume';

// ─── Mock Data Generator ──────────────────────────────────────────────

function generateMockCoins(count = 20): CoinDisplayData[] {
  const names = [
    { name: 'Degen Alice', symbol: 'ALICE' },
    { name: 'Bob Protocol', symbol: 'BOB' },
    { name: 'Charlie Coin', symbol: 'CHAR' },
    { name: 'Diana Token', symbol: 'DIA' },
    { name: 'Eve Finance', symbol: 'EVE' },
    { name: 'Frank DeFi', symbol: 'FRANK' },
    { name: 'Grace Swap', symbol: 'GRACE' },
    { name: 'Harry Hedge', symbol: 'HARRY' },
    { name: 'Ivy Invest', symbol: 'IVY' },
    { name: 'Jack Jump', symbol: 'JUMP' },
    { name: 'Kate Koin', symbol: 'KATE' },
    { name: 'Leo Launch', symbol: 'LEO' },
    { name: 'Mia Meme', symbol: 'MIA' },
    { name: 'Noah NFT', symbol: 'NOAH' },
    { name: 'Oscar Ops', symbol: 'OSCAR' },
    { name: 'Pia Pump', symbol: 'PIA' },
    { name: 'Quinn Quest', symbol: 'QUINN' },
    { name: 'Rex Rocket', symbol: 'REX' },
    { name: 'Sage Swap', symbol: 'SAGE' },
    { name: 'Tess Token', symbol: 'TESS' },
  ];

  return names.map((n, i) => {
    const phase = Math.floor(Math.random() * 5);
    return {
      address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
      name: n.name,
      symbol: n.symbol,
      chain: Math.random() > 0.5 ? ('base' as const) : ('solana' as const),
      price: Math.random() * 0.05 + 0.0001,
      priceChange24h: -30 + Math.random() * 80,
      marketCap: 10000 + Math.random() * 5000000,
      volume24h: 1000 + Math.random() * 500000,
      holderCount: Math.floor(Math.random() * 1000) + 10,
      totalSupply: 1_000_000_000,
      graduated: Math.random() > 0.7,
      bondingPhase: phase,
      createdAt: Date.now() - Math.random() * 86400000 * 30,
      creator: `0x${Math.random().toString(16).slice(2, 42)}`,
      isLive: Math.random() > 0.9,
    };
  });
}

// ─── Sort Functions ───────────────────────────────────────────────────

function sortCoins(coins: CoinDisplayData[], mode: SortMode): CoinDisplayData[] {
  const sorted = [...coins];
  switch (mode) {
    case 'trending':
      return sorted.sort((a, b) => b.volume24h - a.volume24h);
    case 'newest':
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case 'gainers':
      return sorted.sort((a, b) => b.priceChange24h - a.priceChange24h);
    case 'marketcap':
      return sorted.sort((a, b) => b.marketCap - a.marketCap);
    case 'volume':
      return sorted.sort((a, b) => b.volume24h - a.volume24h);
    default:
      return sorted;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function CoinsPage() {
  const [coins, setCoins] = useState<CoinDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('trending');
  const [search, setSearch] = useState('');
  const [chainFilter, setChainFilter] = useState<'all' | 'base' | 'solana'>('all');

  useEffect(() => {
    // Fetch from API, fall back to mock
    const fetchCoins = async () => {
      try {
        const res = await fetch('/api/creator/coins');
        if (res.ok) {
          const data = await res.json();
          if (data.coins?.length) {
            setCoins(data.coins);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall through to mock
      }
      setCoins(generateMockCoins(20));
      setLoading(false);
    };
    fetchCoins();
  }, []);

  const filtered = useMemo(() => {
    let result = sortCoins(coins, sortMode);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.symbol.toLowerCase().includes(q) ||
          c.creator?.toLowerCase().includes(q),
      );
    }

    if (chainFilter !== 'all') {
      result = result.filter((c) => c.chain === chainFilter);
    }

    return result;
  }, [coins, sortMode, search, chainFilter]);

  const stats = useMemo(
    () => ({
      totalCoins: coins.length,
      totalVolume: coins.reduce((s, c) => s + c.volume24h, 0),
      totalMcap: coins.reduce((s, c) => s + c.marketCap, 0),
      avgChange:
        coins.length > 0 ? coins.reduce((s, c) => s + c.priceChange24h, 0) / coins.length : 0,
    }),
    [coins],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-[var(--color-fg)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Coin Discovery
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Discover and trade creator coins. Trending, new launches, top gainers.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/coins/compare"
              className="rounded-xl border border-[var(--color-glass-border)] px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-all"
            >
              ⚖️ Compare
            </Link>
            <Link
              href="/coins/stats"
              className="rounded-xl border border-[var(--color-glass-border)] px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] hover:text-degen-400 hover:border-degen-500/30 transition-all"
            >
              📊 Stats
            </Link>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-[10px] text-[var(--color-muted)]">Total Coins</div>
          <div className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
            {stats.totalCoins}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-[10px] text-[var(--color-muted)]">24h Volume</div>
          <div className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
            $
            {stats.totalVolume >= 1_000_000
              ? `${(stats.totalVolume / 1_000_000).toFixed(1)}M`
              : `${(stats.totalVolume / 1_000).toFixed(0)}K`}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-[10px] text-[var(--color-muted)]">Total Market Cap</div>
          <div className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
            $
            {stats.totalMcap >= 1_000_000
              ? `${(stats.totalMcap / 1_000_000).toFixed(1)}M`
              : `${(stats.totalMcap / 1_000).toFixed(0)}K`}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-[10px] text-[var(--color-muted)]">Avg 24h Change</div>
          <div
            className={`text-lg font-bold tabular-nums ${stats.avgChange >= 0 ? 'text-degen-400' : 'text-red-400'}`}
          >
            {stats.avgChange >= 0 ? '+' : ''}
            {stats.avgChange.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {(['trending', 'newest', 'gainers', 'marketcap', 'volume'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-medium capitalize transition-all ${
                sortMode === mode
                  ? 'border-degen-500/30 bg-degen-500/15 text-degen-400'
                  : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/20'
              }`}
            >
              {mode === 'trending' && '🔥'} {mode === 'newest' && '🆕'} {mode === 'gainers' && '📈'}{' '}
              {mode === 'marketcap' && '🏛️'} {mode === 'volume' && '⚡'}
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Chain filter */}
          <div className="flex gap-1 rounded-xl border border-[var(--color-glass-border)] p-0.5">
            {(['all', 'base', 'solana'] as const).map((chain) => (
              <button
                key={chain}
                type="button"
                onClick={() => setChainFilter(chain)}
                className={`rounded-lg px-2.5 py-1 text-[9px] font-medium transition-all ${
                  chainFilter === chain
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                {chain === 'all' ? 'All' : chain === 'base' ? '⧫ Base' : '◎ Solana'}
              </button>
            ))}
          </div>
          {/* Search */}
          <input
            type="text"
            placeholder="Search coins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-32 text-[10px] sm:w-48"
          />
        </div>
      </div>

      {/* Coin grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-10 text-center">
          <div className="mb-3 text-4xl">🔍</div>
          <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">No Coins Found</h3>
          <p className="text-xs text-[var(--color-muted)]">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((coin) => (
              <CoinCardWithSparkline key={coin.address} coin={coin} />
            ))}
          </div>
          <div className="mt-6 text-center text-[10px] text-[var(--color-muted)]">
            Showing {filtered.length} of {coins.length} coins
          </div>
        </>
      )}
    </div>
  );
}
