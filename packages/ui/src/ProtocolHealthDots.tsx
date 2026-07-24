'use client';

/**
 * @degenfeed/ui — ProtocolHealthDots
 *
 * Shows colored status dots for each protocol's health.
 * Green = up, Yellow = degraded, Red = down, Grey = unknown.
 *
 * Used in feed header, compose modal, search bar, and status page.
 * Fetches from /v1/health/protocols with 60s polling interval.
 */

import { memo, useCallback, useEffect, useState } from 'react';

export interface ProtocolHealth {
  status: 'up' | 'degraded' | 'down';
  latency: number;
  lastChecked: number;
  circuitBreakerOpen: boolean;
}

export interface ProtocolHealthDotsProps {
  /** If true, show protocol names alongside dots */
  showLabels?: boolean;
  /** If true, show "X of Y up" summary */
  showSummary?: boolean;
  /** CSS class for the container */
  className?: string;
  /** Called when a degraded/down protocol needs alternative suggestion */
  onProtocolDegraded?: (protocol: string, alternatives: string[]) => void;
}

const STATUS_COLORS: Record<string, string> = {
  up: 'var(--color-accent)',
  degraded: '#facc15',
  down: 'var(--color-danger)',
};

const PROTOCOL_DISPLAY_ORDER = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'activitypub',
  'lemmy',
  'rss',
  'reddit',
];

export const ProtocolHealthDots = memo(function ProtocolHealthDots({
  showLabels = false,
  showSummary = false,
  className = '',
  onProtocolDegraded,
}: ProtocolHealthDotsProps) {
  const [health, setHealth] = useState<Record<string, ProtocolHealth> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/v1/health/protocols');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        protocols: Record<string, ProtocolHealth>;
        summary: { total: number; up: number; degraded: number; down: number };
      };
      if (data?.protocols) {
        setHealth(data.protocols);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch health');
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const protocols = health
    ? Object.entries(health).sort(([a], [b]) => {
        const ai = PROTOCOL_DISPLAY_ORDER.indexOf(a);
        const bi = PROTOCOL_DISPLAY_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
    : [];

  const summary = health
    ? {
        total: protocols.length,
        up: protocols.filter(([, s]) => s.status === 'up').length,
        degraded: protocols.filter(([, s]) => s.status === 'degraded').length,
        down: protocols.filter(([, s]) => s.status === 'down').length,
      }
    : null;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {showSummary && summary && (
        <span className="mr-2 text-[11px] text-[var(--color-muted)] tabular-nums">
          {summary.up}/{summary.total} up
        </span>
      )}
      {protocols.map(([protocol, status]) => (
        <button
          key={protocol}
          type="button"
          className="group relative flex items-center"
          title={`${protocol}: ${status.status} (${status.latency}ms)`}
          onClick={() => {
            if (status.status !== 'up' && onProtocolDegraded) {
              const alternatives = protocols
                .filter(([, s]) => s.status === 'up')
                .map(([p]) => p)
                .filter((p) => p !== protocol);
              onProtocolDegraded(protocol, alternatives);
            }
          }}
          aria-label={`${protocol} is ${status.status}`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full transition-colors"
            style={{
              backgroundColor: STATUS_COLORS[status.status] ?? 'var(--color-muted)',
              boxShadow:
                status.status === 'degraded'
                  ? '0 0 4px rgba(250, 204, 21, 0.5)'
                  : status.status === 'down'
                    ? '0 0 4px rgba(244, 33, 46, 0.5)'
                    : 'none',
            }}
          />
          {showLabels && (
            <span className="ml-1.5 text-[10px] text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
              {protocol}
            </span>
          )}
        </button>
      ))}
      {error && (
        <span className="ml-1 text-[10px] text-red-400" title={error}>
          !
        </span>
      )}
    </div>
  );
});
