'use client';

/**
 * /profile/earnings — Unified Creator Earnings Dashboard
 *
 * Shows ALL creator earnings: tips, coin fees, subscriptions, NFT sales.
 * Breakdowns by protocol, chain, time period. Withdraw button.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROTOCOL_COLORS, PROTOCOL_LABELS } from '../constants';
import type { EarningsData, EarningsPeriod } from '../types';

const PERIODS: EarningsPeriod[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
];

const STREAM_LABELS: Record<string, string> = {
  tips: 'Tips & Zaps',
  subscriptions: 'Subscriptions',
  monthly_recurring: 'Monthly Recurring',
  coin_fees: 'Coin Trading Fees',
  creator_coin_revenue: 'Creator Coin Revenue',
  nft_sales: 'NFT Sales',
  nft_royalties: 'NFT Royalties',
};

const STREAM_ICONS: Record<string, string> = {
  tips: '⚡',
  subscriptions: '💎',
  coin_fees: '🪙',
  creator_coin_revenue: '💰',
  nft_sales: '🖼️',
  nft_royalties: '🎨',
};

const CHAIN_COLORS: Record<string, string> = {
  lightning: '#f5a623',
  eth: '#627eea',
  sol: '#9945ff',
  matic: '#8247e5',
  usd: '#00ff41',
  unknown: '#888',
};

const CHAIN_LABELS: Record<string, string> = {
  lightning: 'Lightning (BTC)',
  eth: 'Ethereum / EVM',
  sol: 'Solana',
  matic: 'Polygon',
  usd: 'USD / Stablecoins',
};

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('90d');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<'idle' | 'processing' | 'done' | 'error'>(
    'idle',
  );
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (selPeriod: string) => {
    setLoading(true);
    try {
      const workerBase = process.env.NEXT_PUBLIC_WORKER_API_URL || 'https://api.degenfeed.xyz';
      const res = await fetch(`${workerBase}/api/creator/earnings?period=${selPeriod}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = (await res.json()) as EarningsData;
        if (mountedRef.current) setData(json);
      }
    } catch {
      /* silent fail */
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData(period);
    return () => {
      mountedRef.current = false;
    };
  }, [period, fetchData]);

  const grandTotal = data?.total.usd ?? 0;
  const maxProtocol = useMemo(
    () => Math.max(...Object.values(data?.byProtocol ?? {}), 1),
    [data?.byProtocol],
  );
  const maxChain = useMemo(
    () => Math.max(...Object.values(data?.byChain ?? {}), 1),
    [data?.byChain],
  );
  const maxHistory = useMemo(
    () => Math.max(...(data?.history.values ?? [0]), 1),
    [data?.history.values],
  );

  const handleWithdraw = useCallback(async () => {
    setWithdrawStatus('processing');
    try {
      const res = await fetch('/api/creator/earnings/withdraw', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chain: 'eth',
          address: (data?.withdrawable.byChain?.eth ?? data?.withdrawable.byChain?.sol) ? '' : '',
          amount: String(data?.withdrawable.totalUsd ?? 0),
        }),
      });
      if (res.ok) setWithdrawStatus('done');
      else setWithdrawStatus('error');
    } catch {
      setWithdrawStatus('error');
    }
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
        <div className="mb-8 h-8 w-56 skeleton rounded-lg" />
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-48 skeleton rounded-xl" />
      </div>
    );
  }

  const streamEntries = Object.entries(data?.total.byStream ?? {}).filter(
    ([k]) => k !== 'monthly_recurring' && k !== 'nft_royalties',
  );

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 text-lg">
                💰
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-fg)]">Earnings</h1>
                <p className="text-xs text-[var(--color-muted)]">
                  Unified across all protocols and revenue streams
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  period === p.value
                    ? 'bg-degen-500/20 text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grand Total ────────────────────────────────────── */}
        <div className="mb-8 rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-br from-amber-500/[0.08] via-yellow-500/[0.05] to-transparent p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Total Earned
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-[var(--color-fg)]">
                $
                {grandTotal.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Across {streamEntries.length} revenue stream{streamEntries.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] hover:shadow-amber-500/30"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="7 17 17 7" />
                <path d="M17 7H7v10" />
              </svg>
              Withdraw{' '}
              {data?.withdrawable.totalUsd ? `($${data.withdrawable.totalUsd.toFixed(2)})` : ''}
            </button>
          </div>
        </div>

        {/* ── Revenue Streams Grid ───────────────────────────── */}
        <div className="mb-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            Revenue Breakdown
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {streamEntries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-amber-500/20"
              >
                <div className="mb-2 text-xl">{STREAM_ICONS[key] || '📊'}</div>
                <p className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                  $
                  {value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--color-muted)]">
                  {STREAM_LABELS[key] || key}
                </p>
              </div>
            ))}
            {data?.subscriptions && (
              <div className="rounded-xl border border-degen-500/20 bg-degen-500/[0.05] p-4">
                <div className="mb-2 text-xl">🔄</div>
                <p className="text-lg font-bold tabular-nums text-degen-400">
                  ${data.subscriptions.monthlyRecurring.toFixed(2)}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--color-muted)]">
                  Monthly Recurring
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                  {data.subscriptions.active} active sub{data.subscriptions.active !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Earnings by Protocol ──────────────────────────── */}
        {Object.keys(data?.byProtocol ?? {}).length > 0 && (
          <div className="mb-8 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Earnings by Protocol</h3>
            <div className="space-y-3">
              {Object.entries(data?.byProtocol)
                .sort(([, a], [, b]) => b - a)
                .map(([protocol, usd]) => (
                  <div key={protocol} className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                      style={{
                        backgroundColor: `${PROTOCOL_COLORS[protocol] || '#666'}22`,
                        color: PROTOCOL_COLORS[protocol] || '#666',
                      }}
                    >
                      {protocol.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--color-fg)]">
                          {PROTOCOL_LABELS[protocol] || protocol}
                        </span>
                        <span className="text-xs font-bold tabular-nums text-[var(--color-fg)]">
                          ${usd.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-overlay)]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(usd / maxProtocol) * 100}%`,
                            backgroundColor: PROTOCOL_COLORS[protocol] || '#666',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Earnings by Chain ─────────────────────────────── */}
        {Object.keys(data?.byChain ?? {}).length > 0 && (
          <div className="mb-8 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Earnings by Chain</h3>
            <div className="space-y-3">
              {Object.entries(data?.byChain)
                .sort(([, a], [, b]) => b - a)
                .map(([chain, usd]) => (
                  <div key={chain} className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: `${CHAIN_COLORS[chain] || '#888'}22` }}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: CHAIN_COLORS[chain] || '#888' }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--color-fg)]">
                          {CHAIN_LABELS[chain] || chain}
                        </span>
                        <span className="text-xs font-bold tabular-nums text-[var(--color-fg)]">
                          ${usd.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-overlay)]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(usd / maxChain) * 100}%`,
                            backgroundColor: CHAIN_COLORS[chain] || '#888',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Earnings History Chart ────────────────────────── */}
        {(data?.history.values ?? []).some((v) => v > 0) && (
          <div className="mb-8 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
              {period === '7d' ? '7-Day' : period === '30d' ? '30-Day' : '90-Day'} Earnings Trend
            </h3>
            <div className="relative h-40">
              <div className="absolute inset-0 flex items-end gap-[2px]">
                {data?.history.values.map((value, i) => {
                  const height = maxHistory > 0 ? (value / maxHistory) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-80"
                      style={{
                        height: `${Math.max(height, 1)}%`,
                        background: `linear-gradient(to top, rgba(245,166,35,0.3), rgba(245,166,35,0.8))`,
                      }}
                      title={`${data?.history.labels[i] ?? ''}: $${value.toFixed(2)}`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
              <span>{data?.history.labels[0] ?? ''}</span>
              <span>{data?.history.labels[data.history.labels.length - 1] ?? ''}</span>
            </div>
          </div>
        )}

        {/* ── Top Earning Content ───────────────────────────── */}
        {(data?.topContent ?? []).length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
              Top Earning Content
            </h2>
            <div className="space-y-2">
              {data?.topContent.slice(0, 5).map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3 transition-all hover:border-amber-500/20"
                >
                  <span className="w-6 text-center text-xs font-bold text-[var(--color-muted)]">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                      {item.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${PROTOCOL_COLORS[item.protocol] || '#666'}15`,
                          color: PROTOCOL_COLORS[item.protocol] || '#666',
                        }}
                      >
                        {PROTOCOL_LABELS[item.protocol] || item.protocol}
                      </span>
                      <span>
                        {item.engagements} engagement{item.engagements !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-amber-400">
                      ${item.earningsUsd.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Subscriptions Summary ─────────────────────────── */}
        {data?.subscriptions && (
          <div className="mb-8 rounded-xl border border-degen-500/20 bg-degen-500/[0.03] p-5">
            <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">
              💎 Subscription Revenue
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                  {data.subscriptions.active}
                </p>
                <p className="text-[11px] text-[var(--color-muted)]">Active Subscribers</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                  ${data.subscriptions.monthlyRecurring.toFixed(2)}
                </p>
                <p className="text-[11px] text-[var(--color-muted)]">Monthly Recurring</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                  ${data.subscriptions.lifetimeValue.toFixed(2)}
                </p>
                <p className="text-[11px] text-[var(--color-muted)]">Lifetime Value</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Coin Revenue & NFT Sales ──────────────────────── */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data?.coinRevenue && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.03] p-5">
              <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">🪙 Coin Revenue</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Trading Fees</span>
                  <span className="font-medium text-[var(--color-fg)]">
                    ${data.coinRevenue.tradingFees.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Creator Revenue</span>
                  <span className="font-medium text-[var(--color-fg)]">
                    ${data.coinRevenue.creatorRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Total Holders</span>
                  <span className="font-medium text-[var(--color-fg)]">
                    {data.coinRevenue.holders}
                  </span>
                </div>
              </div>
            </div>
          )}
          {data?.nftSales && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.03] p-5">
              <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">🖼️ NFT Sales</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Total Sales</span>
                  <span className="font-medium text-[var(--color-fg)]">
                    ${data.nftSales.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Items Sold</span>
                  <span className="font-medium text-[var(--color-fg)]">{data.nftSales.items}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Royalties</span>
                  <span className="font-medium text-[var(--color-fg)]">
                    ${data.nftSales.royalties.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Empty state ───────────────────────────────────── */}
        {data?.isMock && (
          <div className="rounded-2xl border border-dashed border-[var(--color-glass-border)] py-16 text-center">
            <div className="mb-3 text-3xl">📊</div>
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
              No earnings data yet
            </h3>
            <p className="mx-auto max-w-xs text-xs text-[var(--color-muted)]">
              Connect protocols and start earning tips, subscriptions, and more. Your earnings will
              appear here.
            </p>
          </div>
        )}

        {/* ── Withdraw Modal ────────────────────────────────── */}
        {showWithdrawModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Withdraw earnings"
          >
            <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 shadow-2xl">
              <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Withdraw Earnings</h2>
              <p className="mb-4 text-xs text-[var(--color-muted)]">
                Available: ${data?.withdrawable.totalUsd.toFixed(2)}
              </p>

              {data?.withdrawable.byChain && Object.keys(data.withdrawable.byChain).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(data.withdrawable.byChain).map(([chain, info]) => (
                    <div
                      key={chain}
                      className="rounded-xl border border-[var(--color-glass-border)] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--color-fg)]">
                          {CHAIN_LABELS[chain] || chain}
                        </span>
                        <span className="text-sm font-bold text-[var(--color-fg)]">
                          {info.amount} {info.token}
                        </span>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={withdrawStatus === 'processing'}
                    onClick={handleWithdraw}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-3 text-sm font-bold text-black transition-all hover:scale-[1.02] disabled:opacity-50"
                  >
                    {withdrawStatus === 'processing' ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                        Processing...
                      </span>
                    ) : withdrawStatus === 'done' ? (
                      '✓ Withdrawal Initiated'
                    ) : (
                      'Withdraw All'
                    )}
                  </button>
                  {withdrawStatus === 'error' && (
                    <p className="mt-2 text-xs text-red-400">Withdrawal failed. Try again.</p>
                  )}
                  {withdrawStatus === 'done' && (
                    <p className="mt-2 text-xs text-degen-400">Transaction submitted to chain.</p>
                  )}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-[var(--color-muted)]">
                  No withdrawable balance yet.
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawStatus('idle');
                }}
                className="mt-4 w-full rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Footer note ───────────────────────────────────── */}
        <div className="text-center text-[10px] text-[var(--color-muted)]">
          {data?.lastUpdated && (
            <span>Last updated {new Date(data.lastUpdated).toLocaleString()}</span>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
