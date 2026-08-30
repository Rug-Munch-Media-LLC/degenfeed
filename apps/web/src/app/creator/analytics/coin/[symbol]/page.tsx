'use client';

/**
 * Creator Coin Analytics
 *
 * REAL data sources only (2026-08-30 rewrite):
 *  - /api/creator/coins        → the signed-in creator's coins (identity)
 *  - /api/coins/stats/top      → market metrics (price, mcap, volume, holders)
 *  - /api/coin/[symbol]/activity → real trade/holder events
 *
 * The former implementation rendered a hardcoded 3-coin database, Math.random
 * OHLCV candles, fabricated recent trades, holder distributions, top holders,
 * churn/hold-time stats, and bonding-curve price estimates. None of those had
 * a data source. Sections without a source now render an explicit
 * "unavailable" state instead of invented numbers.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

/** From /api/creator/coins */
interface CreatorCoinIdentity {
  address: string;
  name: string;
  symbol: string;
  chain: string;
  deployedAt: string;
}

/** From /api/coins/stats/* */
interface CoinStatsItem {
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
}

/** From /api/coin/[symbol]/activity */
interface ActivityEvent {
  id: string;
  type: string;
  symbol: string;
  actor?: string;
  amount?: string | number;
  timestamp: string;
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function chainColor(c: string): string {
  return c === 'Solana' || c === 'solana' ? '#9945ff' : 'var(--color-accent)';
}

function formatUsd(n: number): string {
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

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shorten(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const PHASES = ['Steal Deal', 'Early Bird', 'Cruise', 'Final Call', 'Moonshot'];

/* ─── Unavailable Panel ───────────────────────────────────────── */

function UnavailablePanel({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
      <h2 className="mb-2 text-sm font-bold text-[var(--color-fg)]">{title}</h2>
      <p className="text-[10px] text-[var(--color-muted)]">{reason}</p>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────── */

export default function CoinAnalyticsPage() {
  const params = useParams();
  const symbol = (params?.symbol as string)?.toUpperCase() || '';

  const [identity, setIdentity] = useState<CreatorCoinIdentity | null>(null);
  const [stats, setStats] = useState<CoinStatsItem | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setNeedsAuth(false);
      try {
        // 1. Identity — the signed-in creator's coin list.
        const idRes = await fetch('/api/creator/coins');
        if (idRes.status === 401) {
          if (!cancelled) setNeedsAuth(true);
          return;
        }
        if (!idRes.ok) {
          const body = (await idRes.json().catch(() => ({}))) as { error?: string };
          if (!cancelled)
            setError(body.error || `Creator coins API unavailable (HTTP ${idRes.status})`);
          return;
        }
        const idData = (await idRes.json()) as { coins?: CreatorCoinIdentity[] };
        const mine = (idData.coins ?? []).find((c) => c.symbol?.toUpperCase() === symbol);
        if (cancelled) return;
        setIdentity(mine ?? null);

        // 2. Market metrics — from the public stats list.
        try {
          const statsRes = await fetch('/api/coins/stats/top');
          if (statsRes.ok) {
            const statsData = (await statsRes.json()) as { coins?: CoinStatsItem[] };
            const match = (statsData.coins ?? []).find((c) => c.symbol?.toUpperCase() === symbol);
            if (!cancelled) setStats(match ?? null);
          }
        } catch {
          // stats unavailable — tiles show "—"
        }

        // 3. Real activity events.
        try {
          const actRes = await fetch(
            `/api/coin/${encodeURIComponent(symbol)}/activity?pageSize=30`,
          );
          if (actRes.ok) {
            const actData = (await actRes.json()) as { events?: ActivityEvent[] };
            if (!cancelled) setEvents(actData.events ?? []);
          }
        } catch {
          // activity unavailable — feed shows empty state
        }
      } catch {
        if (!cancelled) setError('Analytics data unavailable — network error.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const tradeEvents = useMemo(
    () => events.filter((e) => e.type === 'buy' || e.type === 'sell'),
    [events],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="skeleton mb-6 h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {['price', 'market-cap', 'volume', 'holders'].map((k) => (
            <div key={k} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton mt-6 h-64 rounded-2xl" />
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-glass-border)]">
          <span className="text-2xl">🔐</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Sign in required</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Creator coin analytics are only available to the signed-in creator.
        </p>
        <Link href="/creator/coins" className="btn-primary mt-6 inline-flex text-sm">
          Go to Creator Coins
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Analytics unavailable</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{error}</p>
        <Link href="/creator/coins" className="btn-primary mt-6 inline-flex text-sm">
          View Your Coins
        </Link>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-glass-border)]">
          <span className="text-2xl">🪙</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Coin not found</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          ${symbol} is not in your deployed coin list. No analytics are shown for coins you did not
          deploy.
        </p>
        <Link href="/creator/coins" className="btn-primary mt-6 inline-flex text-sm">
          View Your Coins
        </Link>
      </div>
    );
  }

  const displayName = identity.name || stats?.name || symbol;
  const chain = identity.chain || stats?.chain || '';

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
        <span className="text-degen-400">${symbol}</span>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
            style={{ backgroundColor: `${chainColor(chain)}18` }}
          >
            🪙
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-2xl font-black tracking-tight text-[var(--color-fg)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {displayName} (${symbol})
              </h1>
              {chain && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-glass-border)] px-2.5 py-0.5 text-[9px] font-medium text-[var(--color-muted)]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: chainColor(chain) }}
                  />
                  {chain === 'solana' ? 'Solana' : chain === 'base' ? 'Base' : chain}
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
              {shorten(identity.address)}
              {identity.deployedAt && ` · deployed ${timeAgo(identity.deployedAt)}`}
            </p>
          </div>
        </div>
        {stats && (
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-black tabular-nums ${stats.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
            >
              {formatPrice(stats.price)}
            </span>
            <span
              className={`flex items-center gap-0.5 text-xs font-semibold ${stats.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'}`}
            >
              {stats.priceChange24h >= 0 ? '+' : ''}
              {stats.priceChange24h.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* ── Market Stats (real, from /api/coins/stats) ──────── */}
      <section aria-label="Market metrics" className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Price', value: stats ? formatPrice(stats.price) : '—' },
            { label: 'Market Cap', value: stats ? formatUsd(stats.marketCap) : '—' },
            { label: '24h Volume', value: stats ? formatUsd(stats.volume24h) : '—' },
            { label: 'Holders', value: stats ? stats.holders.toLocaleString() : '—' },
          ].map((t) => (
            <div
              key={t.label}
              className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4"
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                {t.label}
              </div>
              <div className="mt-1 text-xl font-black tabular-nums text-[var(--color-fg)]">
                {t.value}
              </div>
            </div>
          ))}
        </div>
        {!stats && (
          <p className="mt-2 text-[10px] text-[var(--color-muted)]">
            Market metrics unavailable — ${symbol} was not found in the coin stats index.
          </p>
        )}
      </section>

      {/* ── Trading Activity ────────────────────────────────── */}
      <section aria-label="Trading activity" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <UnavailablePanel
              title="Price Chart"
              reason="OHLCV candlestick data requires a historical price indexer that is not connected yet. No chart is shown rather than a simulated one."
            />
          </div>

          {/* Recent trades — real activity events */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Recent Trades</h2>
              <span className="text-[9px] text-[var(--color-muted)]">
                /api/coin/{symbol}/activity
              </span>
            </div>
            {tradeEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-glass-border)] py-8 text-center">
                <span className="mb-1 text-lg">📊</span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  No trade events available
                </span>
                <span className="mt-0.5 text-[9px] text-[var(--color-muted)]">
                  The activity feed returned no buy/sell events for this coin.
                </span>
              </div>
            ) : (
              <div className="max-h-[320px] space-y-1.5 overflow-y-auto scrollbar-none">
                {tradeEvents.slice(0, 30).map((e) => {
                  const isBuy = e.type === 'buy';
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-[10px]"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[8px] font-bold ${
                          isBuy ? 'bg-degen-500/15 text-degen-400' : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {isBuy ? 'B' : 'S'}
                      </span>
                      <span className="flex-1 truncate font-mono text-[var(--color-muted)]">
                        {e.actor ? shorten(e.actor) : 'unknown wallet'}
                      </span>
                      {e.amount != null && (
                        <span
                          className={`tabular-nums font-semibold ${isBuy ? 'text-degen-400' : 'text-red-400'}`}
                        >
                          {isBuy ? '+' : '-'}
                          {String(e.amount)}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-[var(--color-muted)]">
                        {timeAgo(e.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Holder Analytics ────────────────────────────────── */}
      <section aria-label="Holder analytics" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UnavailablePanel
            title="Holder Distribution"
            reason="Holder balance buckets require a token-balance indexer that is not connected yet."
          />
          <UnavailablePanel
            title="Top Holders"
            reason="Top-holder rankings require on-chain balance reads that are not connected yet. Wallet labels are not shown without a verified source."
          />
        </div>
      </section>

      {/* ── Bonding Phase ───────────────────────────────────── */}
      <section aria-label="Bonding phase" className="mb-8">
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Bonding Curve</h2>
          {stats ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-degen-500/15 px-3 py-1 text-[10px] font-semibold text-degen-400">
                {PHASES[stats.bondingCurvePhase] || `Phase ${stats.bondingCurvePhase + 1}`}
              </span>
              <span className="text-[10px] text-[var(--color-muted)]">
                Phase progress, supply burned, and creator vesting data are not available — no
                on-chain vesting read is connected.
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-[var(--color-muted)]">
              Bonding phase unavailable — ${symbol} was not found in the coin stats index.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
