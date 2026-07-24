'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface ProtocolStatus {
  status: 'up' | 'degraded' | 'down';
  latency: number;
  lastChecked: number;
  circuitBreakerOpen: boolean;
  error?: string;
}

interface ProtocolsHealthResponse {
  protocols: Record<string, ProtocolStatus>;
  summary: {
    total: number;
    up: number;
    degraded: number;
    down: number;
  };
  checkedAt: number;
}

interface ProtocolMeta {
  label: string;
  icon: string;
  color: string;
}

const PROTOCOL_META: Record<string, ProtocolMeta> = {
  nostr: { label: 'Nostr', icon: '⟠', color: '#8e30eb' },
  farcaster: { label: 'Farcaster', icon: '○', color: '#8a63d2' },
  lens: { label: 'Lens', icon: '◈', color: '#abfe2c' },
  bluesky: { label: 'Bluesky', icon: '☁', color: '#1185fe' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364ff' },
  threads: { label: 'Threads', icon: '⊛', color: '#888' },
  reddit: { label: 'Reddit', icon: '▶', color: '#ff4500' },
  rss: { label: 'RSS / News', icon: '📡', color: '#ffa500' },
  lemmy: { label: 'Lemmy', icon: '☰', color: '#4ade80' },
  ponder: { label: 'Ponder', icon: '⚡', color: '#f59e0b' },
};

/**
 * ProtocolHealthBanner — Shows a warning banner at the top of feed pages
 * when one or more protocols are degraded or down.
 *
 * Polls /api/health/protocols every 30 seconds, only shows when there's
 * an issue, and auto-dismisses when health is restored.
 */
export function ProtocolHealthBanner() {
  const [degraded, setDegraded] = useState<
    Array<{ id: string; status: 'degraded' | 'down'; meta: ProtocolMeta }>
  >([]);
  const [dismissed, setDismissed] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/protocols', {
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      if (!res.ok) return;
      const data = (await res.json()) as ProtocolsHealthResponse;
      const problems: Array<{ id: string; status: 'degraded' | 'down'; meta: ProtocolMeta }> = [];
      for (const [id, status] of Object.entries(data.protocols)) {
        if (status.status === 'degraded' || status.status === 'down') {
          const meta = PROTOCOL_META[id];
          if (meta) problems.push({ id, status: status.status, meta });
        }
      }
      setDegraded(problems);
    } catch {
      // silently fail
    }
  }, []);

  // Check on mount, then every 30 seconds
  useEffect(() => {
    void checkHealth();
    const id = setInterval(checkHealth, 30_000);
    return () => clearInterval(id);
  }, [checkHealth]);

  if (degraded.length === 0 || dismissed) return null;

  const isDown = degraded.some((d) => d.status === 'down');
  const borderColor = isDown ? 'border-red-500/30' : 'border-yellow-500/30';
  const bgColor = isDown ? 'bg-red-500/5' : 'bg-yellow-500/5';
  const textColor = isDown ? 'text-red-400' : 'text-yellow-400';
  const icon = isDown ? '🔴' : '🟡';

  return (
    <div
      className={`relative mx-auto mb-3 flex max-w-[600px] items-start gap-3 rounded-xl border px-4 py-3 ${borderColor} ${bgColor}`}
      role="alert"
    >
      <span className="mt-0.5 shrink-0 text-sm" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium ${textColor}`}>
          {degraded.length === 1
            ? `${degraded[0]?.meta.label ?? 'A protocol'} is currently ${degraded[0]?.status === 'down' ? 'offline' : 'degraded'}`
            : `${degraded.length} protocols experiencing issues`}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {degraded.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              style={{
                backgroundColor: `${d.meta.color}18`,
                color: d.meta.color,
              }}
            >
              <span className="text-[10px]">{d.meta.icon}</span>
              {d.meta.label}
              <span className="opacity-60">{d.status === 'down' ? '↓' : '⚠'}</span>
            </span>
          ))}
        </div>
        <Link
          href="/status"
          className={`mt-1 inline-block text-[10px] font-medium underline-offset-2 hover:underline ${textColor} opacity-70 hover:opacity-100 transition-opacity`}
        >
          View details →
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-0.5 shrink-0 rounded-full p-1 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
        aria-label="Dismiss health warning"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
