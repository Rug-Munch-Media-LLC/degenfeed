'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProtocolsHealthResponse } from './page';

interface ProtocolMeta {
  label: string;
  icon: string;
  color: string;
  description: string;
}

const PROTOCOL_META: Record<string, ProtocolMeta> = {
  nostr: {
    label: 'Nostr',
    icon: '⟠',
    color: '#8e30eb',
    description: 'Decentralized notes via WebSocket relays',
  },
  farcaster: {
    label: 'Farcaster',
    icon: '○',
    color: '#8a63d2',
    description: 'Casts via Farcaster Hub',
  },
  lens: {
    label: 'Lens',
    icon: '◈',
    color: '#abfe2c',
    description: 'Lens Protocol GraphQL API',
  },
  bluesky: {
    label: 'Bluesky',
    icon: '☁',
    color: '#1185fe',
    description: 'AT Protocol public API',
  },
  mastodon: {
    label: 'Mastodon / GotoSocial',
    icon: '🐘',
    color: '#6364ff',
    description: 'Fediverse public timeline',
  },
  threads: {
    label: 'Threads (Experimental)',
    icon: '⊛',
    color: '#888',
    description: 'Meta Threads web scraper (Experimental)',
  },
  reddit: {
    label: 'Reddit',
    icon: '▶',
    color: '#ff4500',
    description: 'Subreddit RSS hot feeds',
  },
  rss: {
    label: 'RSS / News',
    icon: '📡',
    color: '#ffa500',
    description: 'RSS sources + Hacker News + RMI',
  },
  lemmy: {
    label: 'Lemmy',
    icon: '☰',
    color: '#4ade80',
    description: 'Federated link aggregation',
  },
  ponder: {
    label: 'Ponder',
    icon: '⚡',
    color: '#f59e0b',
    description: 'On-chain indexer (Helios)',
  },
};

function StatusBadge({ status }: { status: 'up' | 'degraded' | 'down' | 'unknown' }) {
  const config: Record<string, { label: string; dot: string; textClass: string; bgClass: string }> =
    {
      up: {
        label: 'Operational',
        dot: '🟢',
        textClass: 'text-degen-400',
        bgClass: 'bg-degen-500/10 border-degen-500/20',
      },
      degraded: {
        label: 'Degraded',
        dot: '🟡',
        textClass: 'text-yellow-400',
        bgClass: 'bg-yellow-500/10 border-yellow-500/20',
      },
      down: {
        label: 'Down',
        dot: '🔴',
        textClass: 'text-red-400',
        bgClass: 'bg-red-500/10 border-red-500/20',
      },
      unknown: {
        label: 'Unknown',
        dot: '○',
        textClass: 'text-[var(--color-muted)]',
        bgClass: 'bg-gray-500/10 border-gray-500/20',
      },
    };

  const c = (config[status] ?? config.unknown) as {
    label: string;
    dot: string;
    textClass: string;
    bgClass: string;
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.bgClass} ${c.textClass}`}
    >
      <span className="text-[10px]">{c.dot}</span>
      {c.label}
    </span>
  );
}

function SummaryBanner({
  summary,
  checkedAt,
}: {
  summary: ProtocolsHealthResponse['summary'];
  checkedAt: number;
}) {
  const allUp = summary.down === 0 && summary.degraded === 0;
  const hasDown = summary.down > 0;
  const _hasDegraded = summary.degraded > 0;

  let bgClass: string;
  let icon: string;
  let label: string;

  if (allUp) {
    bgClass = 'bg-degen-500/10 border-degen-500/20';
    icon = '🟢';
    label = 'All protocols operational';
  } else if (hasDown) {
    bgClass = 'bg-red-500/10 border-red-500/20';
    icon = '🔴';
    label = `${summary.down} protocol${summary.down === 1 ? '' : 's'} down`;
  } else {
    bgClass = 'bg-yellow-500/10 border-yellow-500/20';
    icon = '🟡';
    label = `${summary.degraded} protocol${summary.degraded === 1 ? '' : 's'} degraded`;
  }

  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${bgClass}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-lg font-bold text-[var(--color-fg)]">
            {summary.up}/{summary.total} operational
          </div>
          <div className="text-sm text-[var(--color-muted)]">
            {label}
            {checkedAt > 0 && <span className="ml-2">&middot; {timeAgo(checkedAt)}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        {summary.degraded > 0 && (
          <span className="text-yellow-400">&bull; {summary.degraded} degraded</span>
        )}
        {summary.down > 0 && <span className="text-red-400">&bull; {summary.down} down</span>}
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function StatusClient({ initialData }: { initialData: ProtocolsHealthResponse | null }) {
  const [data, setData] = useState<ProtocolsHealthResponse | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health/protocols', {
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      if (res.ok) setData((await res.json()) as ProtocolsHealthResponse);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  const protocols = Object.entries(PROTOCOL_META);
  const health = data?.protocols ?? {};
  const checkedAt = data?.checkedAt ?? 0;
  const summary = data?.summary ?? { total: protocols.length, up: 0, degraded: 0, down: 0 };

  return (
    <div>
      <SummaryBanner summary={summary} checkedAt={checkedAt} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">Per-Protocol Status</h2>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3 w-3 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
            />
            Auto-refresh (60s)
          </label>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {loading ? 'Checking…' : 'Refresh now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {protocols.map(([id, meta]) => {
          const h = health[id];
          const status: 'up' | 'degraded' | 'down' | 'unknown' = h?.status ?? 'unknown';
          const latency = h?.latency ?? null;

          return (
            <div
              key={id}
              className="card-hover relative flex flex-col"
              style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
            >
              {/* Header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden="true">
                    {meta.icon}
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-fg)]">{meta.label}</span>
                </div>
                <StatusBadge status={status} />
              </div>

              {/* Description */}
              <p className="mb-2 text-xs text-[var(--color-muted)]">{meta.description}</p>

              {/* Metrics row */}
              <div className="mt-auto flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
                {latency !== null && (
                  <span>
                    Latency:{' '}
                    <span className="font-mono text-[var(--color-fg)]">
                      {latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`}
                    </span>
                  </span>
                )}
                <span>
                  Last checked:{' '}
                  <span className="font-mono text-[var(--color-fg)]">
                    {h?.lastChecked ? timeAgo(h.lastChecked) : '—'}
                  </span>
                </span>
              </div>

              {/* Circuit breaker indicator */}
              {h?.circuitBreakerOpen && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-orange-500/10 px-2 py-1 text-[10px] font-medium text-orange-400">
                  <span>⚠</span>
                  <span>Circuit breaker open — auto-skipping this protocol</span>
                </div>
              )}

              {/* Error message */}
              {h?.error && (
                <div className="mt-1 truncate text-[10px] text-red-400" title={h.error}>
                  {h.error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data === null && (
        <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-400">
          Could not reach the health endpoint. The worker may still be warming up — try refreshing
          in a moment.
        </div>
      )}
    </div>
  );
}
