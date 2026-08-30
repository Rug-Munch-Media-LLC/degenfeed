'use client';

/**
 * Coin Comparison Tool
 *
 * Side-by-side comparison of up to 5 coins using REAL market data from
 * /api/coins/stats/top (Workers API proxy — price, market cap, volume,
 * holders, 24h/7d change, bonding phase, chain).
 *
 * The former implementation rendered 11 hardcoded mock coins (0x…0001)
 * and a fabricated risk/transparency/community scoring engine fed by
 * invented inputs (creator allocation, vesting, bundling, DAO proposals).
 * None of those inputs have a data source, so the scoring engine and its
 * table rows were removed 2026-08-30. Only real, sourced metrics are shown.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ══════════════════════════════════════════════════════════════════════
// TYPES — mirrors CoinStatsItem from /api/coins/stats/*
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
}

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

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

/* ── Phase Label ─────────────────────────────────── */
function PhaseLabel({ phase }: { phase: number }) {
  const labels = ['Steal Deal', 'Early Bird', 'Cruise', 'Final Call', 'Moonshot'];
  return <span>{labels[phase] || `Phase ${phase + 1}`}</span>;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

export default function CoinComparePage() {
  const [allCoins, setAllCoins] = useState<CoinCompareData[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedCoins, setSelectedCoins] = useState<CoinCompareData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load the real coin list once. URL ?coins= preselects by symbol.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setListLoading(true);
      setListError(null);
      try {
        const res = await fetch('/api/coins/stats/top');
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {
            setListError(body.error || `Coin list unavailable (HTTP ${res.status})`);
          }
          return;
        }
        const data = (await res.json()) as { coins?: CoinCompareData[] };
        const coins = (data.coins ?? []).filter((c) => c?.symbol && c.address);
        if (cancelled) return;
        setAllCoins(coins);
        const params = new URLSearchParams(window.location.search);
        const symbols = params.get('coins')?.split(',').filter(Boolean) || [];
        if (symbols.length > 0) {
          const found = coins.filter((c) =>
            symbols.some((s) => s.toUpperCase() === c.symbol.toUpperCase()),
          );
          setSelectedCoins(found.slice(0, 5));
        }
      } catch {
        if (!cancelled) setListError('Coin list unavailable — network error.');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allCoins.filter(
      (c) =>
        !selectedCoins.find((s) => s.address === c.address) &&
        (c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)),
    );
  }, [searchQuery, allCoins, selectedCoins]);

  useEffect(() => {
    setShowDropdown(searchResults.length > 0);
  }, [searchResults]);

  const addCoin = useCallback((coin: CoinCompareData) => {
    setSelectedCoins((prev) => {
      if (prev.length >= 5) return prev;
      if (prev.find((c) => c.address === coin.address)) return prev;
      return [...prev, coin];
    });
    setSearchQuery('');
    setShowDropdown(false);
  }, []);

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
    } catch {
      // clipboard unavailable — non-critical
    }
  }, [shareUrl]);

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
              Compare up to 5 coins side by side with live market metrics
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

      {/* ─── Data unavailable banner ────────────────────── */}
      {listError && (
        <div
          className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400"
          role="alert"
        >
          ⚠️ {listError} Comparison requires the coin stats API. No fallback data is shown.
        </div>
      )}

      {/* ─── Search Bar ─────────────────────────────────── */}
      <div ref={searchRef} className="relative mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder={
              listLoading
                ? 'Loading coins…'
                : selectedCoins.length >= 5
                  ? 'Max 5 coins selected'
                  : 'Search coins to compare...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={listLoading || listError !== null || selectedCoins.length >= 5}
            className="input w-full pl-9 pr-4 py-3 text-sm"
          />
          <svg
            aria-hidden="true"
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
            {searchResults.map((coin) => (
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
                <span className="rounded-lg bg-degen-500/15 px-2 py-1 text-[9px] font-semibold text-degen-400">
                  + Add
                </span>
              </button>
            ))}
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
            Search and add up to 5 coins to compare live market metrics.
            <br />
            Share your comparison with a link.
          </p>
        </div>
      ) : (
        <>
          {/* ─── Share ─────────────────────────────────── */}
          <div className="mb-4 flex items-center justify-end">
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
                  {selectedCoins.map((coin) => (
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
                {/* PRICE */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Price</td>
                  {selectedCoins.map((coin) => (
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
                  {selectedCoins.map((coin) => (
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
                  {selectedCoins.map((coin) => (
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
                  {selectedCoins.map((coin) => (
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
                  {selectedCoins.map((coin) => (
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
                  {selectedCoins.map((coin) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)]"
                    >
                      {coin.holders.toLocaleString()}
                    </td>
                  ))}
                </tr>

                {/* CHAIN */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Chain</td>
                  {selectedCoins.map((coin) => (
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
                  {selectedCoins.map((coin) => (
                    <td
                      key={coin.address}
                      className="px-3 py-3 text-center font-mono tabular-nums text-[var(--color-fg)]"
                    >
                      <PhaseLabel phase={coin.bondingCurvePhase} />
                    </td>
                  ))}
                </tr>

                {/* ACTIONS */}
                <tr className="bg-[var(--color-card)]">
                  <td className="px-3 py-3 font-medium text-[var(--color-muted)]">Actions</td>
                  {selectedCoins.map((coin) => (
                    <td key={coin.address} className="px-3 py-3 text-center">
                      <Link
                        href={`/coins/${coin.symbol.toLowerCase()}`}
                        className="inline-block rounded-lg bg-degen-500/15 px-3 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/25 transition-all w-full"
                      >
                        View Details →
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-center text-[9px] text-[var(--color-muted)]">
            Risk, transparency, and community scores are not shown: the underlying data (creator
            allocation, vesting, bundling, DAO activity) has no verified source yet.
          </p>
        </>
      )}
    </div>
  );
}
