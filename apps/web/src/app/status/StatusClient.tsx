'use client';

import { useCallback, useEffect, useState } from 'react';

interface ProtocolHealth {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

interface FeedHealthResponse {
  health: Record<string, ProtocolHealth>;
  checkedAt: number;
}

const PROTOCOL_LABELS: Record<string, { label: string; color: string; description: string }> = {
  nostr: {
    label: 'Nostr',
    color: '#8e30eb',
    description: 'Decentralized notes via WebSocket relays',
  },
  farcaster: {
    label: 'Farcaster',
    color: '#8a63d2',
    description: 'Casts via Farcaster Hub',
  },
  lens: {
    label: 'Lens',
    color: '#abfe2c',
    description: 'Lens Protocol GraphQL API',
  },
  bluesky: {
    label: 'Bluesky',
    color: '#1185fe',
    description: 'AT Protocol public API',
  },
  mastodon: {
    label: 'Mastodon / GotoSocial',
    color: '#6364ff',
    description: 'Fediverse public timeline',
  },
  threads: {
    label: 'Threads',
    color: '#888',
    description: 'Meta Threads web scraper',
  },
  reddit: {
    label: 'Reddit',
    color: '#ff4500',
    description: 'Subreddit RSS hot feeds',
  },
  rss: {
    label: 'RSS / News',
    color: '#ffa500',
    description: '30+ RSS sources + Hacker News',
  },
};

function statusLabel(healthy: boolean): { text: string; className: string } {
  if (healthy) return { text: 'Operational', className: 'text-degen-400' };
  return { text: 'Degraded', className: 'text-yellow-400' };
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

export function StatusClient({ initialData }: { initialData: FeedHealthResponse | null }) {
  const [data, setData] = useState<FeedHealthResponse | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/feed/health', {
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      if (res.ok) setData((await res.json()) as FeedHealthResponse);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  const protocols = Object.entries(PROTOCOL_LABELS);
  const health = data?.health ?? {};
  const checkedAt = data?.checkedAt ?? 0;

  const healthy = protocols.filter(([id]) => health[id]?.healthy).length;
  const degraded = protocols.length - healthy;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[var(--color-card)] p-4">
        <div>
          <div className="text-2xl font-bold text-[var(--color-fg)]">
            {healthy}/{protocols.length} operational
          </div>
          <div className="text-sm text-gray-500">
            {degraded === 0
              ? 'All protocols responding normally'
              : `${degraded} protocol${degraded === 1 ? '' : 's'} degraded`}
            {checkedAt > 0 && <span className="ml-2 text-gray-600">· {timeAgo(checkedAt)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3 w-3 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
            />
            Auto-refresh
          </label>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-[var(--color-fg)] disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Refresh now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {protocols.map(([id, meta]) => {
          const h = health[id];
          const status = h
            ? statusLabel(h.healthy)
            : { text: 'Unknown', className: 'text-gray-500' };
          const latency = h?.latencyMs ?? null;
          return (
            <div
              key={id}
              className="rounded-xl border border-white/10 bg-[var(--color-card)] p-4"
              style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-fg)]">{meta.label}</span>
                <span className={`text-xs font-medium ${status.className}`}>
                  {h ? '●' : '○'} {status.text}
                </span>
              </div>
              <p className="mb-2 text-xs text-gray-500">{meta.description}</p>
              {latency !== null && (
                <div className="text-[10px] text-gray-600">
                  Latency: <span className="font-mono text-gray-400">{latency}ms</span>
                </div>
              )}
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
          Could not reach the health endpoint. Try refreshing once the worker warms up.
        </div>
      )}
    </div>
  );
}
