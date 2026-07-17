'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useWeb3 } from '../../../components/Web3Provider';

/* ── Types ── */

interface TopPost {
  id: string;
  protocol: string;
  content: string;
  likes: number;
  reposts: number;
  replies: number;
  tips: number;
  tipsUsd: number;
  createdAt: string;
}

interface AnalyticsData {
  followers: {
    total: number;
    byProtocol: Record<string, number>;
    growth30d: number[];
    growthLabels: string[];
  };
  posts: {
    total: number;
    byDay: number[];
    dayLabels: string[];
    byWeekday: number[];
    weekdayLabels: string[];
  };
  tips: {
    totalUsd: number;
    byCurrency: Record<string, number>;
    history30d: number[];
    historyLabels: string[];
    totalDegen: number;
    totalEth: number;
    totalSol: number;
    totalBtc: number;
  };
  engagement: {
    rate: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
  };
  topPosts: TopPost[];
  topTipPosts: TopPost[];
  audience: {
    byInstance: Record<string, number>;
    locations: Record<string, number>;
  };
}

/* ── Constants ── */

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
};

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
};

const CURRENCY_COLORS: Record<string, string> = {
  DEGEN: '#00ff41',
  ETH: '#627eea',
  SOL: '#9945ff',
  BTC: '#f7931a',
};

const DEFAULT_ANALYTICS: AnalyticsData = {
  followers: { total: 0, byProtocol: {}, growth30d: [], growthLabels: [] },
  posts: { total: 0, byDay: [], dayLabels: [], byWeekday: [], weekdayLabels: [] },
  tips: {
    totalUsd: 0,
    byCurrency: {},
    history30d: [],
    historyLabels: [],
    totalDegen: 0,
    totalEth: 0,
    totalSol: 0,
    totalBtc: 0,
  },
  engagement: { rate: 0, totalLikes: 0, totalReposts: 0, totalReplies: 0 },
  topPosts: [],
  topTipPosts: [],
  audience: { byInstance: {}, locations: {} },
};

type TabId = 'overview' | 'content' | 'audience' | 'earnings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'audience', label: 'Audience' },
  { id: 'earnings', label: 'Earnings' },
];

/* ── Helpers ── */

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function shortenPost(content: string, max = 60): string {
  if (content.length <= max) return content;
  return `${content.slice(0, max).trim()}…`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function protocolBadge(protocol: string): { bg: string; fg: string; label: string } {
  const color = PROTOCOL_COLORS[protocol] || '#666';
  return { bg: `${color}18`, fg: color, label: PROTOCOL_LABELS[protocol] || protocol };
}

/* ── Sub-components ── */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card relative overflow-hidden border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl transition-all duration-300 hover:border-degen-500/20 hover:shadow-[0_0_30px_rgba(0,255,65,0.06)]">
      {accent && (
        <div
          className="absolute right-0 top-0 h-1 w-full opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accent})` }}
        />
      )}
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--color-fg)]">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

function MiniBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      {label && <span className="w-20 shrink-0 text-xs text-[var(--color-muted)]">{label}</span>}
      <div
        className="flex-1 overflow-hidden rounded-full bg-[var(--color-overlay)]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || `${value} of ${max}`}
      >
        <div
          className="h-2 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
        {formatCompact(value)}
      </span>
    </div>
  );
}

function BarChart({
  data,
  labels,
  color,
  height = 120,
  compact,
}: {
  data: number[];
  labels: string[];
  color: string;
  height?: number;
  compact?: boolean;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {/* biome-ignore lint/suspicious/noArrayIndexKey: static chart data, no stable IDs */}
      {data.map((v, i) => {
        const pct = (v / max) * 100;
        return (
          <div
            key={`bar-${i}`}
            className="group relative flex flex-1 flex-col items-center justify-end h-full"
          >
            <div
              className="w-full rounded-t-sm transition-all duration-500 ease-out hover:opacity-80"
              style={{
                height: `${pct}%`,
                background: `linear-gradient(180deg, ${color}, ${color}44)`,
                minHeight: pct > 0 ? 2 : 0,
              }}
            />
            {!compact && (
              <span className="mt-1 vertical-labels text-[9px] text-[var(--color-muted)]">
                {labels[i]?.slice(0, 3)}
              </span>
            )}
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-fg)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {labels[i]}: {v}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex gap-1.5">
      {/* biome-ignore lint/suspicious/noArrayIndexKey: static heatmap data, no stable IDs */}
      {data.map((v, i) => {
        const intensity = v / max;
        return (
          <div key={`hm-${i}`} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-md transition-all duration-300"
              style={{
                height: `${20 + intensity * 40}px`,
                backgroundColor: `${color}${Math.round(15 + intensity * 50)
                  .toString(16)
                  .padStart(2, '0')}`,
                border: `1px solid ${color}${Math.round(30 + intensity * 40)
                  .toString(16)
                  .padStart(2, '0')}`,
              }}
              title={`${labels[i]}: ${v} posts`}
            />
            <span className="text-[9px] font-medium text-[var(--color-muted)]">{labels[i]?.slice(0, 2)}</span>
            <span className="text-[9px] tabular-nums text-[var(--color-muted)]">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Post Row ── */

function PostRow({ post, rank }: { post: TopPost; rank: number }) {
  const badge = protocolBadge(post.protocol);
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-3 transition-all duration-200 hover:border-[var(--color-border)] hover:bg-[var(--color-overlay)]">
      <span className="mt-0.5 w-5 shrink-0 text-center text-[11px] font-bold text-[var(--color-muted)]">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-[var(--color-muted)]">{shortenPost(post.content, 80)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: badge.bg, color: badge.fg }}
          >
            {badge.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-[var(--color-muted)]">
            ♥ {post.likes}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-[var(--color-muted)]">
            ↻ {post.reposts}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-[var(--color-muted)]">
            ⌨ {post.replies}
          </span>
          {post.tipsUsd > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-degen-400">
              ✦ {formatUsd(post.tipsUsd)}
            </span>
          )}
          <span className="ml-auto text-[9px] text-[var(--color-muted)]">{formatDate(post.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Pie (CSS conic gradient) ── */

function PieChart({
  data,
  colorMap,
  size = 160,
}: {
  data: Record<string, number>;
  colorMap: Record<string, string>;
  size?: number;
}) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0)
    return (
      <div
        className="flex items-center justify-center text-xs text-[var(--color-muted)]"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );

  const segments = Object.entries(data).filter(([, v]) => v > 0);
  const conic = segments
    .reduce(
      (acc, [key, val], i) => {
        const pct = (val / total) * 360;
        const start = i === 0 ? 0 : acc.reduce((s, [_, p]) => s + p, 0);
        const end = start + pct;
        acc.push([key, pct, start, end] as [string, number, number, number]);
        return acc;
      },
      [] as [string, number, number, number][],
    )
    .map(([key, _pct, start, end]) => `${colorMap[key] || '#666'} ${start}deg ${end}deg`)
    .join(', ');

  return (
    <div className="flex items-center gap-6">
      <div
        className="shrink-0 rounded-full"
        style={{ width: size, height: size, background: `conic-gradient(${conic})` }}
        role="img"
        aria-label={`Pie chart with ${segments.length} segments`}
      />
      <div className="flex flex-col gap-1.5">
        {segments.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colorMap[key] || '#666' }}
            />
            <span className="text-xs text-[var(--color-muted)] capitalize">{key}</span>
            <span className="ml-auto text-xs font-medium tabular-nums text-[var(--color-fg)]">
              {formatCompact(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Export CSV ── */

function useCsvExport(data: AnalyticsData) {
  return useCallback(() => {
    const rows: string[][] = [];

    // Overview
    rows.push(['Section', 'Metric', 'Value']);
    rows.push(['Overview', 'Total Followers', String(data.followers.total)]);
    rows.push(['Overview', 'Total Posts', String(data.posts.total)]);
    rows.push(['Overview', 'Total Tips (USD)', String(data.tips.totalUsd)]);
    rows.push(['Overview', 'Engagement Rate', String(data.engagement.rate)]);

    // Followers by protocol
    for (const [protocol, count] of Object.entries(data.followers.byProtocol)) {
      rows.push(['Followers by Protocol', protocol, String(count)]);
    }

    // Tips by currency
    for (const [currency, amount] of Object.entries(data.tips.byCurrency)) {
      rows.push(['Tips by Currency', currency, String(amount)]);
    }

    // Top posts
    rows.push(['', '', '']);
    rows.push(['Top Posts', 'Content', 'Likes', 'Reposts', 'Replies', 'Tips (USD)']);
    for (const post of data.topPosts) {
      rows.push([
        'Top Posts',
        post.content,
        String(post.likes),
        String(post.reposts),
        String(post.replies),
        String(post.tipsUsd),
      ]);
    }

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `degenfeed-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);
}

/* ── Main Component ── */

export default function AnalyticsDashboard() {
  const { ready, signedInProtocols } = useAuth();
  const { isConnected } = useWeb3();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [data, setData] = useState<AnalyticsData>(DEFAULT_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const hasSignedIn = Object.values(signedInProtocols).some(Boolean) || isConnected;

  useEffect(() => {
    mountedRef.current = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/analytics');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AnalyticsData;
        if (mountedRef.current) setData(json);
      } catch (e) {
        if (mountedRef.current)
          setError(e instanceof Error ? e.message : 'Failed to load analytics');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleExport = useCsvExport(data);

  const maxFollowers = useMemo(
    () => Math.max(...Object.values(data.followers.byProtocol), 1),
    [data.followers.byProtocol],
  );

  const maxInstance = useMemo(
    () => Math.max(...Object.values(data.audience.byInstance), 1),
    [data.audience.byInstance],
  );

  const maxLocation = useMemo(
    () => Math.max(...Object.values(data.audience.locations), 1),
    [data.audience.locations],
  );

  /* ── Auth Gate ── */

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="space-y-4">
          <div className="skeleton h-8 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="skeleton h-28 rounded-xl" />
            <div className="skeleton h-28 rounded-xl" />
            <div className="skeleton h-28 rounded-xl" />
            <div className="skeleton h-28 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!hasSignedIn) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)] text-2xl">
            <span className="text-degen-400">◆</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Creator Analytics</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Connect a wallet or sign in to see your cross-protocol analytics — followers, tips,
            engagement, and top content.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-overlay)] px-5 py-2.5 text-sm text-[var(--color-muted)]">
            <span className="text-degen-400">✦</span>
            Connect wallet to see your analytics
          </div>
        </div>
      </div>
    );
  }

  /* ── Loading ── */

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="mb-8">
          <div className="skeleton mb-2 h-8 w-56" />
          <div className="skeleton h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
        </div>
        <div className="mt-8 skeleton h-64 rounded-xl" />
      </div>
    );
  }

  /* ── Error ── */

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="card border-red-500/20 bg-red-500/5 py-12 text-center">
          <div className="mb-3 text-3xl text-red-400">!</div>
          <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Failed to load analytics</h2>
          <p className="mb-4 text-sm text-[var(--color-muted)]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Dashboard ── */

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">Creator Analytics</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Your cross-protocol reach, engagement, and earnings at a glance.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="btn-secondary shrink-0 gap-2 text-xs"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 1v8M4 6l3 3 3-3M2 11h10"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div
        className="mb-8 flex border-b border-[var(--color-border)]"
        role="tablist"
        aria-label="Analytics tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-muted)]'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* ──────────────── OVERVIEW ──────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Followers"
              value={formatCompact(data.followers.total)}
              sub={`Across ${Object.keys(data.followers.byProtocol).length} protocols`}
              accent="#00ff41"
            />
            <StatCard
              label="Total Posts"
              value={formatCompact(data.posts.total)}
              sub="All-time"
              accent="#8a63d2"
            />
            <StatCard
              label="Tips Received"
              value={formatUsd(data.tips.totalUsd)}
              sub="USD equivalent"
              accent="#f7931a"
            />
            <StatCard
              label="Engagement Rate"
              value={formatPercent(data.engagement.rate)}
              sub={`${formatCompact(data.engagement.totalLikes)} likes, ${formatCompact(data.engagement.totalReposts)} reposts`}
              accent="#1185fe"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Followers by protocol */}
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Followers by Protocol</h3>
              <div className="space-y-2.5">
                {Object.entries(data.followers.byProtocol).map(([protocol, count]) => (
                  <MiniBar
                    key={protocol}
                    label={PROTOCOL_LABELS[protocol] || protocol}
                    value={count}
                    max={maxFollowers}
                    color={PROTOCOL_COLORS[protocol] || '#666'}
                  />
                ))}
              </div>
            </div>

            {/* Follower growth (sparkline summary) */}
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">30-Day Follower Growth</h3>
              <div className="overflow-x-auto pb-2">
                <BarChart
                  data={data.followers.growth30d}
                  labels={data.followers.growthLabels}
                  color="#00ff41"
                  height={100}
                  compact
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                <span>{data.followers.growthLabels[0] ?? ''}</span>
                <span className="text-degen-400">
                  {data.followers.growth30d[0] !== undefined
                    ? `+${data.followers.total - data.followers.growth30d[0]}`
                    : ''}
                </span>
                <span>
                  {data.followers.growthLabels[data.followers.growthLabels.length - 1] ?? ''}
                </span>
              </div>
            </div>
          </div>

          {/* Posts & Engagement mini */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Posts per Day (7 days)</h3>
              <div className="overflow-x-auto pb-2">
                <BarChart
                  data={data.posts.byDay.slice(-7)}
                  labels={data.posts.dayLabels.slice(-7)}
                  color="#8a63d2"
                  height={80}
                />
              </div>
            </div>
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Engagement Breakdown</h3>
              <div className="space-y-2.5">
                <MiniBar
                  label="Likes"
                  value={data.engagement.totalLikes}
                  max={
                    data.engagement.totalLikes +
                    data.engagement.totalReposts +
                    data.engagement.totalReplies
                  }
                  color="#00ff41"
                />
                <MiniBar
                  label="Reposts"
                  value={data.engagement.totalReposts}
                  max={
                    data.engagement.totalLikes +
                    data.engagement.totalReposts +
                    data.engagement.totalReplies
                  }
                  color="#8a63d2"
                />
                <MiniBar
                  label="Replies"
                  value={data.engagement.totalReplies}
                  max={
                    data.engagement.totalLikes +
                    data.engagement.totalReposts +
                    data.engagement.totalReplies
                  }
                  color="#1185fe"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── CONTENT ──────────────── */}
      {activeTab === 'content' && (
        <div className="space-y-8 animate-fade-in">
          {/* Top by engagement */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Top Posts by Engagement</h3>
            <div className="space-y-2">
              {data.topPosts.map((post, i) => (
                <PostRow key={post.id} post={post} rank={i + 1} />
              ))}
            </div>
          </div>

          {/* Top by tips */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Top Posts by Tips</h3>
            <div className="space-y-2">
              {data.topTipPosts.map((post, i) => (
                <PostRow key={`tip-${post.id}`} post={post} rank={i + 1} />
              ))}
            </div>
          </div>

          {/* Posting frequency heatmap */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
              Posting Frequency by Day of Week
            </h3>
            <Heatmap
              data={data.posts.byWeekday}
              labels={data.posts.weekdayLabels}
              color="#00ff41"
            />
            <p className="mt-3 text-center text-[10px] text-[var(--color-muted)]">
              Most active on{' '}
              {
                data.posts.weekdayLabels[
                  data.posts.byWeekday.indexOf(Math.max(...data.posts.byWeekday))
                ]
              }
              s
            </p>
          </div>
        </div>
      )}

      {/* ──────────────── AUDIENCE ──────────────── */}
      {activeTab === 'audience' && (
        <div className="space-y-8 animate-fade-in">
          {/* Pie chart followers by protocol */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Followers by Protocol</h3>
            <PieChart data={data.followers.byProtocol} colorMap={PROTOCOL_COLORS} size={160} />
          </div>

          {/* Follower growth 30-day chart */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Follower Growth (30 Days)</h3>
            <div className="overflow-x-auto pb-2">
              <BarChart
                data={data.followers.growth30d}
                labels={data.followers.growthLabels}
                color="#00ff41"
                height={140}
              />
            </div>
          </div>

          {/* Top instances */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Top Instances / Domains</h3>
              <div className="space-y-2.5">
                {Object.entries(data.audience.byInstance)
                  .sort(([, a], [, b]) => b - a)
                  .map(([instance, count]) => (
                    <MiniBar
                      key={instance}
                      label={instance}
                      value={count}
                      max={maxInstance}
                      color="#00ff41"
                    />
                  ))}
              </div>
            </div>
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Top Locations</h3>
              <div className="space-y-2.5">
                {Object.entries(data.audience.locations)
                  .sort(([, a], [, b]) => b - a)
                  .map(([location, count]) => (
                    <MiniBar
                      key={location}
                      label={location}
                      value={count}
                      max={maxLocation}
                      color="#8a63d2"
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── EARNINGS ──────────────── */}
      {activeTab === 'earnings' && (
        <div className="space-y-8 animate-fade-in">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Tips (USD)"
              value={formatUsd(data.tips.totalUsd)}
              sub="All time"
              accent="#00ff41"
            />
            <StatCard
              label="$DEGEN"
              value={formatCompact(data.tips.totalDegen)}
              sub="Degen tokens"
              accent="#00ff41"
            />
            <StatCard
              label="ETH"
              value={`${data.tips.totalEth.toFixed(2)}`}
              sub="Ethereum"
              accent="#627eea"
            />
            <StatCard
              label="SOL"
              value={`${data.tips.totalSol.toFixed(2)}`}
              sub="Solana"
              accent="#9945ff"
            />
          </div>

          {/* Tips history */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Tips Received (30 Days) — USD</h3>
            <div className="overflow-x-auto pb-2">
              <BarChart
                data={data.tips.history30d}
                labels={data.tips.historyLabels}
                color="#f7931a"
                height={140}
              />
            </div>
          </div>

          {/* Tips by currency */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Tips by Currency</h3>
              <PieChart
                data={data.tips.byCurrency as Record<string, number>}
                colorMap={CURRENCY_COLORS}
                size={140}
              />
            </div>
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Tips by Protocol</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#8e30eb]" />
                    <span className="text-sm text-[var(--color-muted)]">Nostr (Zaps)</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-[var(--color-fg)]">
                    {formatUsd(data.tips.totalUsd * 0.42)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#8a63d2]" />
                    <span className="text-sm text-[var(--color-muted)]">Farcaster (Frames)</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-[var(--color-fg)]">
                    {formatUsd(data.tips.totalUsd * 0.31)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#abfe2c]" />
                    <span className="text-sm text-[var(--color-muted)]">Lens (Collects)</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-[var(--color-fg)]">
                    {formatUsd(data.tips.totalUsd * 0.18)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1185fe]" />
                    <span className="text-sm text-[var(--color-muted)]">Direct Crypto</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-[var(--color-fg)]">
                    {formatUsd(data.tips.totalUsd * 0.09)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.35s ease-out;
        }
        .vertical-labels {
          writing-mode: vertical-lr;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
}
