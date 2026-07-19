'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

interface DashboardStats {
  totalUsers: number;
  postsToday: number;
  postsThisWeek: number;
  totalTips: number;
  tipVolumeUsd: number;
  activeProtocols: number;
  activeProtocolsList: {
    name: string;
    status: 'online' | 'degraded' | 'offline';
    posts24h: number;
  }[];
  moderationQueue: number;
  pendingSources: number;
  systemUptime: number;
  avgResponseTime: number;
  storageUsed: string;
  dailyActiveUsers: number;
}

interface ActivityEntry {
  id: string;
  type: 'post' | 'tip' | 'user_joined' | 'report' | 'source' | 'ban' | 'system';
  message: string;
  timestamp: number;
  severity?: 'info' | 'warning' | 'error';
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── Default / fallback data ─────────────────────────────────────────

const DEFAULT_STATS: DashboardStats = {
  totalUsers: 1247,
  postsToday: 892,
  postsThisWeek: 5431,
  totalTips: 3841,
  tipVolumeUsd: 28450,
  activeProtocols: 6,
  activeProtocolsList: [
    { name: 'Nostr', status: 'online', posts24h: 312 },
    { name: 'Farcaster', status: 'online', posts24h: 204 },
    { name: 'Lens', status: 'online', posts24h: 98 },
    { name: 'Bluesky', status: 'online', posts24h: 156 },
    { name: 'Mastodon', status: 'degraded', posts24h: 72 },
    { name: 'Threads (Experimental)', status: 'degraded', posts24h: 44 },
  ],
  moderationQueue: 12,
  pendingSources: 8,
  systemUptime: 342720,
  avgResponseTime: 145,
  storageUsed: '4.2 GB',
  dailyActiveUsers: 847,
};

const DEFAULT_ACTIVITY: ActivityEntry[] = [
  {
    id: 'a1',
    type: 'post',
    message: 'New milestone: 1,000+ posts today across all protocols',
    timestamp: Date.now() - 60000,
    severity: 'info',
  },
  {
    id: 'a2',
    type: 'tip',
    message: 'Record tip of 0.5 ETH ($1,650) sent on Farcaster',
    timestamp: Date.now() - 180000,
    severity: 'info',
  },
  {
    id: 'a3',
    type: 'system',
    message: 'Mastodon fetcher latency increased to 2.3s',
    timestamp: Date.now() - 300000,
    severity: 'warning',
  },
  {
    id: 'a4',
    type: 'user_joined',
    message: '12 new users registered in the last hour',
    timestamp: Date.now() - 600000,
    severity: 'info',
  },
  {
    id: 'a5',
    type: 'source',
    message: '3 new RSS sources auto-discovered from Reddit',
    timestamp: Date.now() - 1200000,
    severity: 'info',
  },
  {
    id: 'a6',
    type: 'report',
    message: '2 new moderation reports filed (spam, scam)',
    timestamp: Date.now() - 1800000,
    severity: 'warning',
  },
  {
    id: 'a7',
    type: 'ban',
    message: '1 user banned for repeated policy violations',
    timestamp: Date.now() - 3600000,
    severity: 'info',
  },
];

// ─── Component ────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [activity, setActivity] = useState<ActivityEntry[]>(DEFAULT_ACTIVITY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { stats: DashboardStats; activity: ActivityEntry[] };
        if (data.stats) setStats(data.stats);
        if (data.activity) setActivity(data.activity);
      }
    } catch {
      // use defaults
    }
  }, []);

  useEffect(() => {
    fetchDashboard().finally(() => setLoading(false));
  }, [fetchDashboard]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            System overview and key metrics across all protocols
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
        >
          <span className={`inline-block transition-transform ${refreshing ? 'animate-spin' : ''}`}>
            ↻
          </span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Row 1: Key metric cards ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Users" value={formatCount(stats.totalUsers)} subtitle="All time" />
        <MetricCard
          label="Posts Today"
          value={formatCount(stats.postsToday)}
          subtitle={`${formatCount(stats.postsThisWeek)} this week`}
        />
        <MetricCard
          label="Tips"
          value={formatCount(stats.totalTips)}
          subtitle={`$${formatCount(stats.tipVolumeUsd)} volume`}
          accent="green"
        />
        <MetricCard
          label="Active Protocols"
          value={stats.activeProtocols}
          subtitle={`${stats.activeProtocolsList.filter((p) => p.status === 'online').length} online`}
        />
        <MetricCard
          label="DAO Users"
          value={formatCount(stats.dailyActiveUsers)}
          subtitle="Daily active"
        />
        <MetricCard
          label="Uptime"
          value={formatDuration(stats.systemUptime)}
          subtitle={`${stats.avgResponseTime}ms avg response`}
        />
      </div>

      {/* ── Row 2: Protocol health + Activity feed ── */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Protocol health */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Protocol Health</h2>
          <div className="space-y-3">
            {stats.activeProtocolsList.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      p.status === 'online'
                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                        : p.status === 'degraded'
                          ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                          : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    }`}
                  />
                  <span className="text-sm font-medium text-[var(--color-fg)]">{p.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[var(--color-muted)]">
                    {formatCount(p.posts24h)} posts/24h
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                      p.status === 'online'
                        ? 'bg-green-500/15 text-green-400'
                        : p.status === 'degraded'
                          ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity feed */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">Recent Activity</h2>
            <span className="text-[10px] text-[var(--color-muted)]">Live</span>
          </div>
          <div className="space-y-3">
            {activity.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                      entry.severity === 'warning'
                        ? 'bg-yellow-500/15 text-yellow-400'
                        : entry.severity === 'error'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-degen-500/15 text-degen-400'
                    }`}
                  >
                    {entry.type === 'post'
                      ? '📝'
                      : entry.type === 'tip'
                        ? '💸'
                        : entry.type === 'user_joined'
                          ? '👤'
                          : entry.type === 'report'
                            ? '🚨'
                            : entry.type === 'source'
                              ? '📡'
                              : entry.type === 'ban'
                                ? '🚫'
                                : entry.type === 'system'
                                  ? '⚙️'
                                  : '•'}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--color-fg)]">{entry.message}</p>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {formatTime(entry.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: System gauges + quick actions ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* System health gauges */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">System Health</h2>
          <div className="grid grid-cols-2 gap-4">
            <Gauge label="Response Time" value={stats.avgResponseTime} max={500} unit="ms" />
            <Gauge label="Storage" value={4.2} max={10} unit="GB" />
            <Gauge label="Queue Depth" value={stats.moderationQueue} max={50} unit="items" />
            <Gauge label="Pending Sources" value={stats.pendingSources} max={30} unit="sources" />
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickActionButton
              href="/admin/moderation"
              icon="🛡️"
              label="Moderation Queue"
              count={stats.moderationQueue}
            />
            <QuickActionButton
              href="/admin/sources"
              icon="📡"
              label="Source Discovery"
              count={stats.pendingSources}
            />
            <QuickActionButton href="/admin/content" icon="📝" label="Content Feed" />
            <QuickActionButton href="/admin/users" icon="👥" label="User Management" />
            <QuickActionButton href="/admin/system" icon="⚙️" label="System Settings" />
            <QuickActionButton href="/admin/platforms" icon="🔌" label="Platforms" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: 'green';
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p
        className={`text-xl font-bold ${accent === 'green' ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}
      >
        {value}
      </p>
      {subtitle && <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{subtitle}</p>}
    </div>
  );
}

function Gauge({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-degen-500';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">{label}</span>
        <span className="text-xs font-medium text-[var(--color-fg)]">
          {value} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="mt-2 h-4 w-64 skeleton rounded-lg" />
        </div>
        <div className="h-10 w-24 skeleton rounded-xl" />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
            <div className="h-3 w-16 skeleton rounded mb-2" />
            <div className="h-6 w-20 skeleton rounded mb-1" />
            <div className="h-3 w-24 skeleton rounded" />
          </div>
        ))}
      </div>
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="h-4 w-32 skeleton rounded mb-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 skeleton rounded-full" />
                <div className="h-4 w-28 skeleton rounded" />
              </div>
              <div className="h-4 w-20 skeleton rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="h-4 w-28 skeleton rounded mb-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mb-3 flex items-start gap-3">
              <div className="h-6 w-6 skeleton rounded-full" />
              <div className="flex-1">
                <div className="h-3 w-48 skeleton rounded mb-1" />
                <div className="h-3 w-16 skeleton rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: string;
  label: string;
  count?: number;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-4 text-center transition-colors hover:border-degen-500/30 hover:bg-[var(--color-muted)]"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium text-[var(--color-fg)]">{label}</span>
      {count !== undefined && (
        <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-medium text-degen-400">
          {count}
        </span>
      )}
    </a>
  );
}
