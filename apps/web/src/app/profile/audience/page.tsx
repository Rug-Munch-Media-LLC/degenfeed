'use client';

/**
 * /profile/audience — Audience Dashboard
 *
 * Total followers across ALL protocols (deduplicated), growth charts,
 * top followers, demographics, acquisition sources.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PROTOCOL_COLORS, PROTOCOL_LABELS } from '../constants';
import type { AudienceData } from '../types';

export default function AudiencePage() {
  const [data, setData] = useState<AudienceData | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Same-origin relative by default: /api/analytics is proxied by the
      // Next.js server (rewrite) to the self-hosted API — no CF worker.
      const workerBase = process.env.NEXT_PUBLIC_WORKER_API_URL || '';
      const res = await fetch(`${workerBase}/api/analytics`, { credentials: 'include' });
      if (res.ok) {
        const json = (await res.json()) as {
          followers: {
            total: number;
            byProtocol: Record<string, number>;
            growth30d: number[];
            growthLabels: string[];
          };
          audience: {
            byInstance: Record<string, number>;
            byProtocol: Record<string, number>;
            byCommunity: Array<{ name: string; count: number }>;
          };
        };
        if (mountedRef.current) {
          setData({
            totalFollowers: json.followers.total,
            byProtocol: json.followers.byProtocol,
            growth: {
              labels: json.followers.growthLabels,
              values: json.followers.growth30d,
            },
            topFollowers: [],
            demographics: {
              byInstance: json.audience.byInstance ?? {},
              byLocation: {},
              byCommunity: json.audience.byCommunity ?? [],
            },
            sources: {},
            lastUpdated: Date.now(),
          });
        }
      }
    } catch {
      /* silent fail */
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
        <div className="mb-8 h-8 w-48 skeleton rounded-lg" />
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-48 skeleton rounded-xl" />
      </div>
    );
  }

  const maxProtocol = Math.max(...Object.values(data?.byProtocol ?? {}), 1);
  const maxGrowth = Math.max(...(data?.growth.values ?? [1]), 1);
  const protocolEntries = Object.entries(data?.byProtocol ?? {});

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 text-lg">
              👥
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Audience</h1>
              <p className="text-xs text-[var(--color-muted)]">
                Your followers across all connected protocols
              </p>
            </div>
          </div>
        </div>

        {/* ── Total Followers ───────────────────────────────── */}
        <div className="mb-8 rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-br from-pink-500/[0.08] via-rose-500/[0.05] to-transparent p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Total Audience
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-4xl font-bold tabular-nums text-[var(--color-fg)]">
              {data?.totalFollowers.toLocaleString() || '0'}
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              followers across {protocolEntries.length} protocol
              {protocolEntries.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ── Followers by Protocol ─────────────────────────── */}
        {protocolEntries.length > 0 && (
          <div className="mb-8 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Followers by Protocol</h3>
            <div className="space-y-3">
              {protocolEntries
                .sort(([, a], [, b]) => b - a)
                .map(([protocol, count]) => (
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
                          {count.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--color-overlay)]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(count / maxProtocol) * 100}%`,
                            backgroundColor: PROTOCOL_COLORS[protocol] || '#666',
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {((count / (data?.totalFollowers || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Follower Growth Chart ─────────────────────────── */}
        {(data?.growth.values ?? []).some((v) => v > 0) && (
          <div className="mb-8 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Follower Growth</h3>
            <div className="relative h-40">
              <div className="absolute inset-0 flex items-end gap-[2px]">
                {data?.growth.values.map((value, i) => {
                  const height = (value / maxGrowth) * 100;
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: bar-chart ticks are positional, no stable id exists
                      key={i}
                      className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-80"
                      style={{
                        height: `${Math.max(height, 1)}%`,
                        background: `linear-gradient(to top, rgba(236,72,153,0.2), rgba(236,72,153,0.7))`,
                      }}
                      title={`${data?.growth.labels[i] ?? ''}: ${value}`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
              <span>{data?.growth.labels[0] ?? ''}</span>
              <span>{data?.growth.labels[data.growth.labels.length - 1] ?? ''}</span>
            </div>
          </div>
        )}

        {/* ── Demographics ──────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* By Instance */}
          {Object.keys(data?.demographics.byInstance ?? {}).length > 0 && (
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Top Instances</h3>
              <div className="space-y-2">
                {Object.entries(data?.demographics.byInstance ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([instance, count]) => {
                    const max = Math.max(...Object.values(data?.demographics.byInstance ?? {}), 1);
                    return (
                      <div key={instance} className="flex items-center gap-2">
                        <span className="w-0 flex-1 truncate text-[11px] text-[var(--color-fg)]">
                          {instance}
                        </span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-overlay)]">
                          <div
                            className="h-full rounded-full bg-pink-400"
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
                          {count}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* By Community */}
          {(data?.demographics.byCommunity ?? []).length > 0 && (
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Top Communities</h3>
              <div className="space-y-2">
                {data?.demographics.byCommunity
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 8)
                  .map((c) => {
                    const max = Math.max(
                      ...(data?.demographics.byCommunity ?? []).map((x) => x.count),
                      1,
                    );
                    return (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="w-0 flex-1 truncate text-[11px] text-[var(--color-fg)]">
                          {c.name}
                        </span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-overlay)]">
                          <div
                            className="h-full rounded-full bg-rose-400"
                            style={{ width: `${(c.count / max) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
                          {c.count}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ── Empty ─────────────────────────────────────────── */}
        {protocolEntries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--color-glass-border)] py-16 text-center">
            <div className="mb-3 text-3xl">👥</div>
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
              No audience data yet
            </h3>
            <p className="mx-auto max-w-xs text-xs text-[var(--color-muted)]">
              Connect protocols and start building your audience. Follower data will appear here.
            </p>
          </div>
        )}

        <div className="text-center text-[10px] text-[var(--color-muted)]">
          {data?.lastUpdated && (
            <span>Last updated {new Date(data.lastUpdated).toLocaleString()}</span>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
