'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

interface ProtocolHealth {
  protocol: string;
  protocolLabel: string;
  totalPosts: number;
  activeCreators: number;
  avgQualityScore: number;
  totalEngagement: number;
  engagementPerPost: number;
  freshness: { breaking: number; recent: number; today: number; older: number };
  topPosts: Array<{ id: string; text: string; author: string; qualityScore: number; engagement: number }>;
  isEmpty: boolean;
}

interface HealthReport {
  generatedAt: number;
  totalPosts: number;
  totalProtocols: number;
  protocolHealth: ProtocolHealth[];
  diversityScore: number;
  freshnessScore: number;
  emptyFeedAlerts: string[];
  topContentOverall: Array<{ id: string; protocol: string; text: string; author: string; qualityScore: number }>;
}

// ─── Color helpers ────────────────────────────────────────────────────

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb', farcaster: '#8a63d2', lens: '#abfe2c', bluesky: '#1185fe',
  mastodon: '#6364ff', reddit: '#ff4500', rss: '#ffa500', threads: '#888',
  lemmy: '#2d9cdb', pixelfed: '#f9a825', peertube: '#f1680d', zora: '#6b21a8',
  mirror: '#222', paragraph: '#6c5ce7', github: '#6e40c9', youtube: '#ff0000',
  telegram: '#26a5e4', discord: '#5865f2', hive: '#e31337',
};

function getColor(protocol: string): string {
  return PROTOCOL_COLORS[protocol] ?? '#666';
}

// ─── Stat Card ────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: color ?? 'var(--color-fg)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function FeedHealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [expandedProtocol, setExpandedProtocol] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feed-health', {
        credentials: 'include',
        headers: { 'cache-control': 'no-store' },
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as HealthReport;
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchHealth(); }, [fetchHealth]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="skeleton h-8 w-64 rounded-lg mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button type="button" onClick={fetchHealth} className="btn-primary mt-4">Retry</button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const now = new Date(report.generatedAt);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Feed Health Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Last updated: {now.toLocaleTimeString()} · Auto-refreshes every 60s
        </p>
      </div>

      {/* Overview stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Posts" value={report.totalPosts} color="#22c55e" />
        <StatCard label="Active Protocols" value={report.totalProtocols} color="#8b5cf6" />
        <StatCard
          label="Diversity Score"
          value={`${(report.diversityScore * 100).toFixed(0)}%`}
          color={report.diversityScore > 0.6 ? '#22c55e' : report.diversityScore > 0.3 ? '#eab308' : '#ef4444'}
        />
        <StatCard
          label="Freshness Score"
          value={`${report.freshnessScore}/100`}
          color={report.freshnessScore > 60 ? '#22c55e' : report.freshnessScore > 30 ? '#eab308' : '#ef4444'}
        />
      </div>

      {/* Empty feed alerts */}
      {report.emptyFeedAlerts.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-400">
            ⚠ {report.emptyFeedAlerts.length} protocol{report.emptyFeedAlerts.length > 1 ? 's' : ''} with empty feeds
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {report.emptyFeedAlerts.map((p) => (
              <span
                key={p}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `${getColor(p)}15`, color: getColor(p) }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top content overall */}
      {report.topContentOverall.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">🏆 Top Performing Content</h2>
          <div className="space-y-1.5">
            {report.topContentOverall.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getColor(item.protocol) }}
                />
                <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{item.text}</span>
                <span className="shrink-0 text-[var(--color-fg)]">@{item.author}</span>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                  style={{ backgroundColor: `${getColor(item.protocol)}15`, color: getColor(item.protocol) }}
                >
                  {item.qualityScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-protocol breakdown */}
      <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Per-Protocol Breakdown</h2>
      <div className="space-y-2">
        {report.protocolHealth
          .sort((a, b) => b.totalPosts - a.totalPosts)
          .map((ph) => {
            const color = getColor(ph.protocol);
            const isExpanded = expandedProtocol === ph.protocol;
            const totalFresh = ph.freshness.breaking + ph.freshness.recent;

            return (
              <div key={ph.protocol}>
                <button
                  type="button"
                  onClick={() => setExpandedProtocol(isExpanded ? null : ph.protocol)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-glass-border)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-overlay)]"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="w-24 text-sm font-medium text-[var(--color-fg)]">{ph.protocolLabel}</span>
                  <span className="flex-1 text-xs text-[var(--color-muted)]">
                    {ph.isEmpty ? (
                      <span className="text-amber-400">Empty feed</span>
                    ) : (
                      <>
                        <span className="tabular-nums">{ph.totalPosts} posts</span>
                        <span className="mx-1.5 opacity-30">·</span>
                        <span className="tabular-nums">{ph.activeCreators} creators</span>
                        <span className="mx-1.5 opacity-30">·</span>
                        <span className="tabular-nums">QS {ph.avgQualityScore}</span>
                        <span className="mx-1.5 opacity-30">·</span>
                        <span className="tabular-nums">{totalFresh} fresh</span>
                      </>
                    )}
                  </span>
                  <span className="text-[9px] text-[var(--color-muted)] opacity-50">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded && !ph.isEmpty && (
                  <div className="ml-8 mt-1 grid grid-cols-2 gap-3 rounded-lg border border-[var(--color-glass-border)] p-4">
                    {/* Freshness distribution */}
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                        Freshness
                      </p>
                      <div className="mt-2 space-y-1">
                        <FreshnessRow label="Breaking (<15m)" count={ph.freshness.breaking} color="#22c55e" />
                        <FreshnessRow label="Recent (15-60m)" count={ph.freshness.recent} color="#06b6d4" />
                        <FreshnessRow label="Today (1-24h)" count={ph.freshness.today} color="#f59e0b" />
                        <FreshnessRow label="Older (>24h)" count={ph.freshness.older} color="#6b7280" />
                      </div>
                    </div>

                    {/* Top posts */}
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                        Top Posts
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {ph.topPosts.map((tp) => (
                          <div key={tp.id} className="text-xs text-[var(--color-muted)]">
                            <span className="text-[var(--color-fg)]">@{tp.author}</span>
                            <span className="ml-1 opacity-50">— {tp.text.slice(0, 60)}</span>
                            <span className="ml-1 text-[9px] opacity-40">QS:{tp.qualityScore}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Engagement metrics */}
                    <div className="col-span-2 flex gap-4 text-xs text-[var(--color-muted)]">
                      <span>Total engagement: <strong className="text-[var(--color-fg)]">{ph.totalEngagement.toLocaleString()}</strong></span>
                      <span>Eng/post: <strong className="text-[var(--color-fg)]">{ph.engagementPerPost}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Auto-refresh */}
      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={fetchHealth}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}

// ─── Freshness Row ────────────────────────────────────────────────────

function FreshnessRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-[var(--color-muted)]">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-[var(--color-glass-border)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, count * 10)}%`, backgroundColor: color }} />
      </div>
      <span className="w-6 text-right tabular-nums text-[var(--color-muted)]">{count}</span>
    </div>
  );
}
