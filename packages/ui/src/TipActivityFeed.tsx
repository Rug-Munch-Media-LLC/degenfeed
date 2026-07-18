'use client';

/**
 * @degenfeed/ui — TipActivityFeed
 *
 * Live cross-platform tip activity feed. Polls the unified tip activity
 * endpoint (`GET /api/tip/unified/activity`) every 15 seconds.
 *
 *   ⚡ Alice tipped $5 to Bob on Lemmy
 *   ⚡ Charlie tipped $10 to Dave on PeerTube
 *   ⚡ Eve tipped $1 to Frank on DegenFeed
 */

import { useCallback, useEffect, useState } from 'react';
import { PlatformBadge, TIP_PLATFORM_META, type TipDashboardPlatform } from './UnifiedTipDashboard';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  platform: TipDashboardPlatform;
  entityId: string;
  entityType: 'post' | 'comment' | 'video' | 'space';
  entityLabel?: string;
  amountUsd: number;
  fromUserId?: string;
  toUserId?: string;
  fromLabel: string;
  toLabel: string;
  at: number;
}

interface ActivityResponse {
  activity: ActivityItem[];
  updatedAt: number;
}

export interface TipActivityFeedProps {
  apiBase?: string;
  limit?: number;
  /** Polling interval in ms (default 15s). Set to 0 to disable. */
  pollIntervalMs?: number;
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────

export function TipActivityFeed({
  apiBase = '',
  limit = 30,
  pollIntervalMs = 15_000,
  compact = false,
}: TipActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(
        `${apiBase}/api/tip/unified/activity?limit=${encodeURIComponent(limit)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ActivityResponse;
      setItems(data.activity ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [apiBase, limit]);

  useEffect(() => {
    void load();
    if (pollIntervalMs <= 0) return;
    const timer = setInterval(() => void load(), pollIntervalMs);
    return () => clearInterval(timer);
  }, [load, pollIntervalMs]);

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--color-muted)]" />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
        <p className="mb-2 text-xs text-red-400">Could not load activity: {error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-lg bg-[var(--color-muted)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--color-muted)]">
        No recent tips. Be the first to tip! ⚡
      </p>
    );
  }

  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {items.map((item) => {
        const meta = TIP_PLATFORM_META[item.platform] ?? TIP_PLATFORM_META.degenfeed;
        return (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs"
          >
            <span className="shrink-0 text-sm" style={{ color: meta.color }}>
              ⚡
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">
              <span className="font-medium text-[var(--color-fg)]">{item.fromLabel}</span>
              {' tipped '}
              <span className="font-semibold text-green-400">{formatUsd(item.amountUsd)}</span>
              {' to '}
              <span className="font-medium text-[var(--color-fg)]">{item.toLabel}</span>
              {' on '}
              <span>{meta.icon}</span>
              <span style={{ color: meta.color }}>{meta.label}</span>
            </span>
            <PlatformBadge platform={item.platform} />
            <span className="shrink-0 text-[10px] text-gray-600">{timeAgo(item.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
