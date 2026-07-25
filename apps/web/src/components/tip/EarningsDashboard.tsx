'use client';

/**
 * @degenfeed/web — EarningsDashboard
 *
 * TASK 4: Creator Earnings Consolidation
 *
 * Shows ALL income sources per post in a unified dashboard:
 *   - "This post earned: 5,000 sats (Lightning) + $2.50 (ETH) + 100 $CREATOR (coin)"
 *   - Total tips per post
 *   - Tips by protocol
 *   - Tips by chain
 *   - Tips by time period
 *
 * @see ../../../workers/api/src/routes/unified-tip-leaderboard.ts
 * @see ../../../workers/api/src/routes/tip-streaks.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export interface EarningsEntry {
  /** Amount in USD */
  amountUsd: number;
  /** Tipping method */
  method: string;
  /** Chain used */
  chain?: string;
  /** Protocol where tip originated */
  protocol: string;
  /** Tip ID */
  id: string;
  /** Timestamp */
  at: number;
  /** Tipper name */
  fromLabel?: string;
  /** Whether this was private */
  private: boolean;
}

export interface EarningsSummary {
  /** Total earned across all methods */
  totalUsd: number;
  /** Breakdown by method/chain */
  byMethod: Record<string, { totalUsd: number; count: number }>;
  /** Breakdown by protocol */
  byProtocol: Record<string, { totalUsd: number; count: number }>;
  /** Breakdown by chain */
  byChain: Record<string, { totalUsd: number; count: number }>;
  /** Breakdown by time period */
  byPeriod: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  };
  /** Recent earnings entries */
  recent: EarningsEntry[];
  /** Total tip count */
  tipCount: number;
  /** Number of unique tippers */
  uniqueTippers: number;
}

export interface EarningsDashboardProps {
  /** Creator user ID */
  userId: string;
  /** Optional post ID to scope earnings to a single post */
  postId?: string;
  /** Optional initial data (pre-fetched from server) */
  initialData?: EarningsSummary;
  /** Compact variant for inline display */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ─── Formatting helpers ──────────────────────────────────────────────────

function formatUsd(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  return `¢${Math.round(amount * 100)}`;
}

function formatMethod(method: string): string {
  const labels: Record<string, string> = {
    lightning: '⚡ Lightning',
    lightning_zap: '⚡ Lightning Zap',
    onchain_tip: '⛓️ On-Chain',
    ethereum: '◆ Ethereum',
    base: '🔵 Base',
    solana: '◎ Solana',
    creator_coin: '🪙 Creator Coin',
    farcaster_frame: '◈ Frame',
    lens_collect: '◎ Lens Collect',
    usdc: '● USDC',
    bridge: '🌉 Bridge',
    link: '🔗 Link',
    qr_code: '📱 QR Code',
    native: '🔗 Native',
  };
  return labels[method] ?? method;
}

function formatChain(chain: string): string {
  const icons: Record<string, string> = {
    lightning: '⚡',
    ethereum: '◆',
    base: '🔵',
    solana: '◎',
    polygon: '⬡',
    optimism: '🔴',
    arbitrum: '🔶',
  };
  return `${icons[chain] ?? '⛓️'} ${chain}`;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────

export function EarningsDashboard({
  userId,
  postId,
  initialData,
  compact = false,
  className = '',
}: EarningsDashboardProps) {
  const [data, setData] = useState<EarningsSummary | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // ── Fetch earnings data ───────────────────────────────────────────────
  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ userId });
      if (postId) params.set('entityId', postId);
      const res = await fetch(`/api/tip/analytics?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch earnings');
      const json = (await res.json()) as EarningsSummary;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId, postId]);

  useEffect(() => {
    if (!initialData) fetchEarnings();
  }, [fetchEarnings, initialData]);

  // ── Filtered entries based on time period ────────────────────────────
  const filteredEntries = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const dayMs = 86_400_000;
    switch (timeFilter) {
      case 'today':
        return data.recent.filter((e) => now - e.at < dayMs);
      case 'week':
        return data.recent.filter((e) => now - e.at < 7 * dayMs);
      case 'month':
        return data.recent.filter((e) => now - e.at < 30 * dayMs);
      default:
        return data.recent;
    }
  }, [data, timeFilter]);

  // ── Per-post earnings summary line ───────────────────────────────────
  const earningsLine = useMemo(() => {
    if (!data || data.tipCount === 0) return null;
    const parts: string[] = [];
    for (const [method, info] of Object.entries(data.byMethod)) {
      if (info.totalUsd > 0) {
        parts.push(`${formatUsd(info.totalUsd)} (${formatMethod(method)})`);
      }
    }
    return parts.join(' + ');
  }, [data]);

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex items-center gap-2 py-4 ${className}`}>
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
        <span className="text-xs text-[var(--color-muted)]">Loading earnings...</span>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`rounded-lg bg-red-900/10 border border-red-900/30 p-3 ${className}`}>
        <p className="text-xs text-red-400">{error}</p>
        <button
          type="button"
          onClick={fetchEarnings}
          className="mt-1 text-[10px] text-degen-500 hover:text-degen-400"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────
  if (!data || data.tipCount === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center ${className}`}
      >
        <p className="text-sm text-[var(--color-muted)]">
          {postId ? 'No tips on this post yet' : 'No tips received yet'}
        </p>
        {!postId && (
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            Share your profile to start receiving tips
          </p>
        )}
      </div>
    );
  }

  // ── Compact variant ──────────────────────────────────────────────────
  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        {/* Earnings summary line */}
        {earningsLine && (
          <div className="rounded-lg bg-gradient-to-r from-degen-500/5 to-transparent border border-degen-500/20 px-3 py-2">
            <p className="text-[10px] text-[var(--color-muted)]">This post earned:</p>
            <p className="text-xs font-semibold text-[var(--color-fg)]">{earningsLine}</p>
          </div>
        )}

        {/* Total + count */}
        <div className="flex items-center gap-3">
          <div>
            <span className="text-lg font-bold text-degen-400">{formatUsd(data.totalUsd)}</span>
            <span className="ml-1 text-[10px] text-[var(--color-muted)]">total</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">
            {data.tipCount} tip{data.tipCount !== 1 ? 's' : ''} · {data.uniqueTippers} tipper
            {data.uniqueTippers !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    );
  }

  // ── Full variant ─────────────────────────────────────────────────────
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">
          {postId ? 'Post Earnings' : 'Creator Earnings'}
        </h2>
        <button
          type="button"
          onClick={fetchEarnings}
          className="rounded-lg px-2 py-1 text-[9px] text-[var(--color-muted)] hover:text-degen-400 transition-colors"
          title="Refresh"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Total revenue */}
      <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-degen-500/5 to-transparent p-4">
        <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1">
          Total Revenue
        </p>
        <p className="text-2xl font-bold text-[var(--color-fg)]">{formatUsd(data.totalUsd)}</p>
        <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
          {data.tipCount} tips from {data.uniqueTippers} tippers
        </p>

        {/* Earnings breakdown line */}
        {earningsLine && (
          <div className="mt-2 rounded-lg bg-[var(--color-card)]/50 px-2.5 py-1.5">
            <p className="text-[9px] text-[var(--color-muted)]">Breakdown:</p>
            <p className="text-[11px] text-[var(--color-fg)]">{earningsLine}</p>
          </div>
        )}
      </div>

      {/* Period filter tabs */}
      <div className="flex gap-1">
        {(['today', 'week', 'month', 'all'] as const).map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setTimeFilter(period)}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors ${
              timeFilter === period
                ? 'bg-degen-500/15 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {period === 'today'
              ? 'Today'
              : period === 'week'
                ? 'Week'
                : period === 'month'
                  ? 'Month'
                  : 'All Time'}
          </button>
        ))}
      </div>

      {/* Breakdown by method */}
      <div>
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          By Method
        </h3>
        <div className="space-y-1">
          {Object.entries(data.byMethod)
            .sort(([, a], [, b]) => b.totalUsd - a.totalUsd)
            .map(([method, info]) => (
              <div
                key={method}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-card)] transition-colors"
              >
                <span className="text-[11px] text-[var(--color-fg)]">{formatMethod(method)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-[var(--color-fg)]">
                    {formatUsd(info.totalUsd)}
                  </span>
                  <span className="text-[9px] text-[var(--color-muted)]">{info.count}x</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Breakdown by chain */}
      {Object.keys(data.byChain).length > 0 && (
        <div>
          <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            By Chain
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.byChain)
              .sort(([, a], [, b]) => b.totalUsd - a.totalUsd)
              .map(([chain, info]) => (
                <div
                  key={chain}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1"
                >
                  <span className="text-xs">{formatChain(chain)}</span>
                  <span className="text-[10px] font-medium text-[var(--color-fg)]">
                    {formatUsd(info.totalUsd)}
                  </span>
                  <span className="text-[8px] text-[var(--color-muted)]">{info.count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent tips list */}
      <div>
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Recent Tips
        </h3>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <p className="text-[10px] text-[var(--color-muted)]">No tips in this period</p>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-card)] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] text-[var(--color-fg)] truncate">
                    {entry.fromLabel ?? 'Anonymous'}
                  </span>
                  <span className="text-[9px] text-[var(--color-muted)] shrink-0">
                    {formatMethod(entry.method)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-medium text-[var(--color-fg)]">
                    {formatUsd(entry.amountUsd)}
                  </span>
                  <span className="text-[8px] text-[var(--color-muted)]">
                    {formatTime(entry.at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Time period summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[var(--color-border)] px-3 py-2">
          <p className="text-[9px] text-[var(--color-muted)]">Today</p>
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            {formatUsd(data.byPeriod.today)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] px-3 py-2">
          <p className="text-[9px] text-[var(--color-muted)]">This Week</p>
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            {formatUsd(data.byPeriod.thisWeek)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] px-3 py-2">
          <p className="text-[9px] text-[var(--color-muted)]">This Month</p>
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            {formatUsd(data.byPeriod.thisMonth)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] px-3 py-2">
          <p className="text-[9px] text-[var(--color-muted)]">All Time</p>
          <p className="text-sm font-semibold text-[var(--color-fg)]">
            {formatUsd(data.byPeriod.allTime)}
          </p>
        </div>
      </div>
    </div>
  );
}
