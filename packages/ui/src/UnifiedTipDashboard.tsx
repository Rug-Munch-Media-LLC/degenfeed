'use client';

/**
 * @degenfeed/ui — UnifiedTipDashboard
 *
 * Cross-platform tipping activity for one user, backed by the unified tip
 * ledger (`GET /api/tip/unified/stats?userId=…`).
 *
 *   Sent:     "$120.00 across 45 tips (DegenFeed: $80, Lemmy: $25, PeerTube: $15)"
 *   Received: "$350.00 from 12 tippers"
 *   History:  recent tips with platform badges
 */

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

export type TipDashboardPlatform = 'degenfeed' | 'lemmy' | 'peertube';

interface PlatformBreakdown {
  totalUsd: number;
  count: number;
}

export interface UnifiedTipHistoryItem {
  id: string;
  platform: TipDashboardPlatform;
  entityId: string;
  entityType: 'post' | 'comment' | 'video' | 'space';
  entityLabel?: string;
  amountUsd: number;
  fromLabel: string;
  toLabel: string;
  at: number;
  direction: 'sent' | 'received';
}

export interface UnifiedTipStats {
  userId: string;
  sent: {
    totalUsd: number;
    count: number;
    lastTipAt: number | null;
    byPlatform: Partial<Record<TipDashboardPlatform, PlatformBreakdown>>;
  };
  received: {
    totalUsd: number;
    count: number;
    lastTipAt: number | null;
    byPlatform: Partial<Record<TipDashboardPlatform, PlatformBreakdown>>;
    tipperCount: number;
  };
  history: UnifiedTipHistoryItem[];
}

export interface UnifiedTipDashboardProps {
  /** Wallet address or identity id whose tips to show */
  userId: string;
  /** Base URL for the API (defaults to same-origin) */
  apiBase?: string;
  /** Cap the number of history rows shown (default 10) */
  historyLimit?: number;
}

// ─── Platform meta ────────────────────────────────────────────────────────

export const TIP_PLATFORM_META: Record<
  TipDashboardPlatform,
  { label: string; icon: string; color: string }
> = {
  degenfeed: { label: 'DegenFeed', icon: '◆', color: '#22c55e' },
  lemmy: { label: 'Lemmy', icon: 'L', color: '#00bc8c' },
  peertube: { label: 'PeerTube', icon: '▶', color: '#f2690d' },
};

const PLATFORM_ORDER: TipDashboardPlatform[] = ['degenfeed', 'lemmy', 'peertube'];

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function breakdownLine(
  byPlatform: Partial<Record<TipDashboardPlatform, PlatformBreakdown>>,
): string {
  const parts = PLATFORM_ORDER.filter((p) => (byPlatform[p]?.count ?? 0) > 0).map(
    (p) => `${TIP_PLATFORM_META[p].label}: ${formatUsd(byPlatform[p]?.totalUsd ?? 0)}`,
  );
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

function timeAgo(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PlatformBadge({ platform }: { platform: TipDashboardPlatform }) {
  const meta = TIP_PLATFORM_META[platform] ?? TIP_PLATFORM_META.degenfeed;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function UnifiedTipDashboard({
  userId,
  apiBase = '',
  historyLimit = 10,
}: UnifiedTipDashboardProps) {
  const [stats, setStats] = useState<UnifiedTipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await fetch(
        `${apiBase}/api/tip/unified/stats?userId=${encodeURIComponent(userId)}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats((await res.json()) as UnifiedTipStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tip stats');
    } finally {
      setLoading(false);
    }
  }, [userId, apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!userId) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center text-xs text-gray-500">
        Connect a wallet to see your cross-platform tipping activity.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-xl bg-[var(--color-muted)]" />
        <div className="h-20 animate-pulse rounded-xl bg-[var(--color-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
        <p className="mb-2 text-xs text-red-400">Could not load tip stats: {error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-lg bg-[var(--color-muted)] px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-[var(--color-fg)]"
        >
          Retry
        </button>
      </div>
    );
  }

  const sent = stats?.sent ?? { totalUsd: 0, count: 0, lastTipAt: null, byPlatform: {} };
  const received = stats?.received ?? {
    totalUsd: 0,
    count: 0,
    lastTipAt: null,
    byPlatform: {},
    tipperCount: 0,
  };
  const history = (stats?.history ?? []).slice(0, historyLimit);
  const sentBreakdown = breakdownLine(sent.byPlatform);
  const receivedBreakdown = breakdownLine(received.byPlatform);

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            <span>↑</span>
            <span>Sent</span>
          </div>
          <div className="text-xl font-bold text-[var(--color-fg)]">
            {formatUsd(sent.totalUsd)}
            <span className="ml-1.5 text-xs font-normal text-gray-500">
              across {sent.count} tip{sent.count !== 1 ? 's' : ''}
            </span>
          </div>
          {sentBreakdown && <div className="mt-1 text-[10px] text-gray-500">{sentBreakdown}</div>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLATFORM_ORDER.filter((p) => (sent.byPlatform[p]?.count ?? 0) > 0).map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-green-500/80">
            <span>↓</span>
            <span>Received</span>
          </div>
          <div className="text-xl font-bold text-[var(--color-fg)]">
            {formatUsd(received.totalUsd)}
            <span className="ml-1.5 text-xs font-normal text-gray-500">
              from {received.tipperCount} tipper{received.tipperCount !== 1 ? 's' : ''}
            </span>
          </div>
          {receivedBreakdown && (
            <div className="mt-1 text-[10px] text-gray-500">{receivedBreakdown}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLATFORM_ORDER.filter((p) => (received.byPlatform[p]?.count ?? 0) > 0).map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>
        </div>
      </div>

      {/* Tip history */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Tip History
        </h3>
        {history.length === 0 ? (
          <p className="py-3 text-center text-xs text-gray-500">
            No tips yet — tip a post, comment, or video to get started. ⚡
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {history.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-2 text-xs">
                <span
                  className={`shrink-0 font-bold ${
                    item.direction === 'received' ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {item.direction === 'received' ? '↓' : '↑'}
                </span>
                <span className="shrink-0 font-semibold text-[var(--color-fg)]">
                  {formatUsd(item.amountUsd)}
                </span>
                <span className="min-w-0 flex-1 truncate text-gray-500">
                  {item.direction === 'received'
                    ? `from ${item.fromLabel}`
                    : `to ${item.toLabel}`}
                  {item.entityLabel ? ` · ${item.entityLabel}` : ''}
                </span>
                <PlatformBadge platform={item.platform} />
                <span className="shrink-0 text-[10px] text-gray-600">{timeAgo(item.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
