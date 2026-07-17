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

interface ProtocolEngagement {
  likes: number;
  reposts: number;
  replies: number;
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
    totalTopLevel: number;
    totalReplies: number;
  };
  tips: {
    totalUsd: number;
    byCurrency: Record<string, number>;
    byProtocol: Record<string, number>;
    history30d: number[];
    historyLabels: string[];
    totalDegen: number;
    totalEth: number;
    totalSol: number;
    totalBtc: number;
    topTippers: { name: string; totalUsd: number }[];
    last10: { amount: string; currency: string; protocol: string; createdAt: number }[];
  };
  engagement: {
    rate: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
    byProtocol: Record<string, ProtocolEngagement>;
  };
  topPosts: TopPost[];
  topTipPosts: TopPost[];
  audience: {
    byProtocol: Record<string, number>;
    byInstance: Record<string, number>;
    locations: Record<string, number>;
    byCommunity: { name: string; count: number }[];
  };
  protocols: {
    connected: string[];
    missing: string[];
  };
  lastUpdated: number;
  isMock: boolean;
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

const PROTOCOL_ORDER = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];

const CURRENCY_COLORS: Record<string, string> = {
  DEGEN: '#00ff41',
  ETH: '#627eea',
  SOL: '#9945ff',
  BTC: '#f7931a',
  USDC: '#2775ca',
  MATIC: '#8247e5',
};

const DEFAULT_ANALYTICS: AnalyticsData = {
  followers: { total: 0, byProtocol: {}, growth30d: [], growthLabels: [] },
  posts: {
    total: 0,
    byDay: [],
    dayLabels: [],
    byWeekday: [],
    weekdayLabels: [],
    totalTopLevel: 0,
    totalReplies: 0,
  },
  tips: {
    totalUsd: 0,
    byCurrency: {},
    byProtocol: {},
    history30d: [],
    historyLabels: [],
    totalDegen: 0,
    totalEth: 0,
    totalSol: 0,
    totalBtc: 0,
    topTippers: [],
    last10: [],
  },
  engagement: { rate: 0, totalLikes: 0, totalReposts: 0, totalReplies: 0, byProtocol: {} },
  topPosts: [],
  topTipPosts: [],
  audience: { byProtocol: {}, byInstance: {}, locations: {}, byCommunity: [] },
  protocols: { connected: [], missing: ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'] },
  lastUpdated: Date.now(),
  isMock: true,
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

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  sub,
}: {
  value: number;
  max: number;
  color: string;
  label?: string;
  sub?: string;
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
      {sub && <span className="w-16 text-right text-[10px] text-[var(--color-muted)]">{sub}</span>}
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
            <span className="text-[9px] font-medium text-[var(--color-muted)]">
              {labels[i]?.slice(0, 2)}
            </span>
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
        <p className="text-sm leading-snug text-[var(--color-muted)]">
          {shortenPost(post.content, 80)}
        </p>
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
          <span className="ml-auto text-[9px] text-[var(--color-muted)]">
            {formatDate(post.createdAt)}
          </span>
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

/* ── Protocol breakdown table ── */

function ProtocolBreakdownTable({
  followers,
  engagement,
  tips,
}: {
  followers: Record<string, number>;
  engagement: Record<string, ProtocolEngagement>;
  tips: Record<string, number>;
}) {
  const protocols = PROTOCOL_ORDER.filter(
    (p) => followers[p] !== undefined || engagement[p] !== undefined,
  );

  if (protocols.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            <th className="pb-2 pr-4 text-left">Protocol</th>
            <th className="pb-2 pr-4 text-right">Followers</th>
            <th className="pb-2 pr-4 text-right">Engagement</th>
            <th className="pb-2 pr-4 text-right">Likes</th>
            <th className="pb-2 pr-4 text-right">Reposts</th>
            <th className="pb-2 text-right">Tips (USD)</th>
          </tr>
        </thead>
        <tbody>
          {protocols.map((p) => {
            const color = PROTOCOL_COLORS[p] || '#666';
            const eng = engagement[p];
            const totalEng = eng ? eng.likes + eng.reposts + eng.replies : 0;
            return (
              <tr
                key={p}
                className="border-b border-[var(--color-border)]/50 transition-colors hover:bg-[var(--color-overlay)]"
              >
                <td className="py-2.5 pr-4">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-medium text-[var(--color-fg)]">
                      {PROTOCOL_LABELS[p] || p}
                    </span>
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-fg)]">
                  {followers[p] !== undefined ? formatCompact(followers[p]) : '—'}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-fg)]">
                  {totalEng > 0 ? formatCompact(totalEng) : '—'}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                  {eng?.likes ? formatCompact(eng.likes) : '—'}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                  {eng?.reposts ? formatCompact(eng.reposts) : '—'}
                </td>
                <td className="py-2.5 text-right tabular-nums text-degen-400">
                  {tips[p] !== undefined ? formatUsd(tips[p]) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Connect Protocols Banner ── */

function ConnectProtocolsBanner({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg">✦</span>
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 text-sm font-semibold text-yellow-400">
            Connect more protocols for richer analytics
          </h3>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            Your dashboard currently shows data from{' '}
            {missing.length > 0
              ? `${PROTOCOL_ORDER.length - missing.length} of ${PROTOCOL_ORDER.length} supported protocols`
              : 'no connected protocols'}
            . Link your accounts to see the full picture.
          </p>
          <div className="flex flex-wrap gap-2">
            {missing.map((p) => (
              <a
                key={p}
                href="/profile"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium transition-colors hover:opacity-80"
                style={{
                  backgroundColor: `${PROTOCOL_COLORS[p] || '#666'}20`,
                  color: PROTOCOL_COLORS[p] || '#666',
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: PROTOCOL_COLORS[p] }}
                />
                Connect {PROTOCOL_LABELS[p] || p}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tip Row (for last 10) ── */

function TipRow({
  tip,
}: {
  tip: { amount: string; currency: string; protocol: string; createdAt: number };
}) {
  const badge = protocolBadge(tip.protocol);
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-degen-400">✦</span>
        <span className="text-xs font-medium text-[var(--color-fg)]">
          {tip.amount} {tip.currency}
        </span>
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px]"
          style={{ backgroundColor: badge.bg, color: badge.fg }}
        >
          {badge.label}
        </span>
      </div>
      <span className="text-[10px] text-[var(--color-muted)]">{formatTimeAgo(tip.createdAt)}</span>
    </div>
  );
}

/* ── Export CSV ── */

function useCsvExport(data: AnalyticsData) {
  return useCallback(() => {
    const rows: string[][] = [];

    rows.push(['Section', 'Metric', 'Value']);
    rows.push(['Overview', 'Total Followers', String(data.followers.total)]);
    rows.push(['Overview', 'Total Posts', String(data.posts.total)]);
    rows.push(['Overview', 'Total Tips (USD)', String(data.tips.totalUsd)]);
    rows.push(['Overview', 'Engagement Rate', String(data.engagement.rate)]);

    for (const [protocol, count] of Object.entries(data.followers.byProtocol)) {
      rows.push(['Followers by Protocol', protocol, String(count)]);
    }
    for (const [currency, amount] of Object.entries(data.tips.byCurrency)) {
      rows.push(['Tips by Currency', currency, String(amount)]);
    }

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
  const { isConnected, account: walletAddress } = useWeb3();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [data, setData] = useState<AnalyticsData>(DEFAULT_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const hasSignedIn = Object.values(signedInProtocols).some(Boolean) || isConnected;

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        if (walletAddress) params.set('wallet', walletAddress);
        if (forceRefresh) params.set('refresh', 'true');
        const qs = params.toString();
        const res = await fetch(`/api/analytics${qs ? `?${qs}` : ''}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AnalyticsData;
        if (mountedRef.current) setData(json);
      } catch (e) {
        if (mountedRef.current)
          setError(e instanceof Error ? e.message : 'Failed to load analytics');
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [walletAddress],
  );

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

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
          <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">
            Failed to load analytics
          </h2>
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
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
            Creator Analytics
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted)]">
            Your cross-protocol reach, engagement, and earnings at a glance.
            <span className="text-[10px] text-[var(--color-muted)]">
              Updated {formatTimeAgo(data.lastUpdated)}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <svg
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 7a6 6 0 0111-3.464M13 1v4H9M13 7a6 6 0 01-11 3.464M1 13V9h4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
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
      </div>

      {/* Data freshness notice for mock data */}
      {data.isMock && data.protocols.connected.length === 0 && (
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-center text-xs text-yellow-400">
          Showing demo data. Connect accounts and add{' '}
          <code className="rounded bg-yellow-500/10 px-1 py-0.5 font-mono">?wallet=0x...</code> to
          see your real analytics.
        </div>
      )}

      {/* Connect Protocols Banner */}
      {data.protocols.missing.length > 0 && data.protocols.connected.length > 0 && (
        <div className="mb-6">
          <ConnectProtocolsBanner missing={data.protocols.missing} />
        </div>
      )}

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
              activeTab === tab.id
                ? 'text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-muted)]'
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
              value={data.followers.total > 0 ? formatCompact(data.followers.total) : '—'}
              sub={
                data.followers.total > 0
                  ? `Across ${Object.keys(data.followers.byProtocol).length} protocols`
                  : 'Connect a protocol'
              }
              accent="#00ff41"
            />
            <StatCard
              label="Total Posts Found"
              value={formatCompact(data.posts.total)}
              sub={data.posts.total > 0 ? 'Indexed in search' : 'No posts indexed yet'}
              accent="#8a63d2"
            />
            <StatCard
              label="Tips Received"
              value={data.tips.totalUsd > 0 ? formatUsd(data.tips.totalUsd) : '—'}
              sub={
                data.tips.last10.length > 0
                  ? `${data.tips.last10.length} recent tips`
                  : 'No tips yet'
              }
              accent="#f7931a"
            />
            <StatCard
              label="Engagement Rate"
              value={data.engagement.rate > 0 ? formatPercent(data.engagement.rate) : '—'}
              sub={`${formatCompact(data.engagement.totalLikes)} likes · ${formatCompact(data.engagement.totalReposts)} reposts`}
              accent="#1185fe"
            />
          </div>

          {/* Protocol breakdown table */}
          {Object.keys(data.followers.byProtocol).length > 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">By Protocol</h3>
              <ProtocolBreakdownTable
                followers={data.followers.byProtocol}
                engagement={data.engagement.byProtocol}
                tips={data.tips.byProtocol}
              />
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Followers by protocol */}
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                Followers by Protocol
              </h3>
              {Object.keys(data.followers.byProtocol).length > 0 ? (
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
              ) : (
                <div className="py-8 text-center text-sm text-[var(--color-muted)]">
                  Link a protocol to see follower data
                </div>
              )}
            </div>

            {/* Follower growth (sparkline summary) */}
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                30-Day Follower Growth
              </h3>
              {data.followers.growth30d.some((v) => v > 0) ? (
                <>
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
                      {data.followers.growth30d[0] !== undefined &&
                      data.followers.total > data.followers.growth30d[0]
                        ? `+${data.followers.total - data.followers.growth30d[0]}`
                        : ''}
                    </span>
                    <span>
                      {data.followers.growthLabels[data.followers.growthLabels.length - 1] ?? ''}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-sm text-[var(--color-muted)]">
                  Follower growth data will appear here over time
                </div>
              )}
            </div>
          </div>

          {/* Posts & Engagement mini */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                Posts per Day (7 days)
              </h3>
              {data.posts.byDay.length > 0 ? (
                <div className="overflow-x-auto pb-2">
                  <BarChart
                    data={data.posts.byDay.slice(-7)}
                    labels={data.posts.dayLabels.slice(-7)}
                    color="#8a63d2"
                    height={80}
                  />
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-[var(--color-muted)]">
                  Post data will appear once content is indexed
                </div>
              )}
            </div>
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                Engagement Breakdown
              </h3>
              {data.engagement.totalLikes +
                data.engagement.totalReposts +
                data.engagement.totalReplies >
              0 ? (
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
              ) : (
                <div className="py-8 text-center text-sm text-[var(--color-muted)]">
                  Engagement data will appear once posts are indexed
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── CONTENT ──────────────── */}
      {activeTab === 'content' && (
        <div className="space-y-8 animate-fade-in">
          {/* Top by engagement */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
              Top Posts by Engagement
            </h3>
            {data.topPosts.length > 0 ? (
              <div className="space-y-2">
                {data.topPosts.map((post, i) => (
                  <PostRow key={post.id} post={post} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-[var(--color-muted)]">
                No posts indexed yet. Start posting across your connected protocols.
              </div>
            )}
          </div>

          {/* Top by tips */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Top Posts by Tips</h3>
            {data.topTipPosts.length > 0 ? (
              <div className="space-y-2">
                {data.topTipPosts.map((post, i) => (
                  <PostRow key={`tip-${post.id}`} post={post} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-[var(--color-muted)]">
                No tipped posts yet. Enable tipping on your posts to appear here.
              </div>
            )}
          </div>

          {/* Posting frequency heatmap */}
          {data.posts.byWeekday.some((v) => v > 0) && (
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
          )}
        </div>
      )}

      {/* ──────────────── AUDIENCE ──────────────── */}
      {activeTab === 'audience' && (
        <div className="space-y-8 animate-fade-in">
          {/* Pie chart followers by protocol */}
          {Object.keys(data.audience.byProtocol).length > 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                Followers by Protocol
              </h3>
              <PieChart data={data.audience.byProtocol} colorMap={PROTOCOL_COLORS} size={160} />
            </div>
          )}

          {/* Follower growth 30-day chart */}
          {data.followers.growth30d.some((v) => v > 0) && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                Follower Growth (30 Days)
              </h3>
              <div className="overflow-x-auto pb-2">
                <BarChart
                  data={data.followers.growth30d}
                  labels={data.followers.growthLabels}
                  color="#00ff41"
                  height={140}
                />
              </div>
            </div>
          )}

          {/* Audience info or connect call to action */}
          {Object.keys(data.audience.byProtocol).length === 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-8 text-center backdrop-blur-xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] text-lg">
                <span className="text-degen-400">◆</span>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                Audience data unavailable
              </h3>
              <p className="mb-4 text-xs text-[var(--color-muted)]">
                Connect protocols to see where your audience lives.
              </p>
              <a
                href="/profile"
                className="inline-flex items-center gap-2 rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/30"
              >
                Connect accounts
              </a>
            </div>
          )}

          {/* Top instances */}
          {Object.keys(data.audience.byInstance).length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Top Instances / Domains
                </h3>
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
          )}

          {/* Communities */}
          {data.audience.byCommunity.length > 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Top Communities</h3>
              <div className="space-y-2.5">
                {data.audience.byCommunity.map((c) => (
                  <MiniBar
                    key={c.name}
                    label={c.name}
                    value={c.count}
                    max={Math.max(...data.audience.byCommunity.map((x) => x.count), 1)}
                    color="#abfe2c"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── EARNINGS ──────────────── */}
      {activeTab === 'earnings' && (
        <div className="space-y-8 animate-fade-in">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Tips (USD)"
              value={data.tips.totalUsd > 0 ? formatUsd(data.tips.totalUsd) : '—'}
              sub="All time"
              accent="#00ff41"
            />
            <StatCard
              label="$DEGEN"
              value={data.tips.totalDegen > 0 ? formatCompact(data.tips.totalDegen) : '—'}
              sub="Degen tokens"
              accent="#00ff41"
            />
            <StatCard
              label="ETH"
              value={data.tips.totalEth > 0 ? `${data.tips.totalEth.toFixed(4)}` : '—'}
              sub="Ethereum"
              accent="#627eea"
            />
            <StatCard
              label="SOL"
              value={data.tips.totalSol > 0 ? `${data.tips.totalSol.toFixed(2)}` : '—'}
              sub="Solana"
              accent="#9945ff"
            />
          </div>

          {/* No tips state */}
          {data.tips.totalUsd === 0 && data.tips.last10.length === 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-8 text-center backdrop-blur-xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] text-lg">
                <span className="text-degen-400">✦</span>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                No tips received yet
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Connect wallets and enable tipping to start receiving tips across protocols.
              </p>
            </div>
          )}

          {/* Tips history */}
          {data.tips.history30d.some((v) => v > 0) && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                Tips Received (30 Days) — USD
              </h3>
              <div className="overflow-x-auto pb-2">
                <BarChart
                  data={data.tips.history30d}
                  labels={data.tips.historyLabels}
                  color="#f7931a"
                  height={140}
                />
              </div>
            </div>
          )}

          {/* Tips by currency & protocol */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Object.keys(data.tips.byCurrency).length > 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Tips by Currency
                </h3>
                <PieChart
                  data={data.tips.byCurrency as Record<string, number>}
                  colorMap={CURRENCY_COLORS}
                  size={140}
                />
              </div>
            )}

            {Object.keys(data.tips.byProtocol).length > 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Tips by Protocol (USD)
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(data.tips.byProtocol)
                    .sort(([, a], [, b]) => b - a)
                    .map(([protocol, usd]) => {
                      const color = PROTOCOL_COLORS[protocol] || '#666';
                      const maxTip = Math.max(...Object.values(data.tips.byProtocol), 1);
                      return (
                        <MiniBar
                          key={protocol}
                          label={PROTOCOL_LABELS[protocol] || protocol}
                          value={Math.round(usd)}
                          max={Math.round(maxTip)}
                          color={color}
                          sub={formatUsd(usd)}
                        />
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Top tippers */}
          {data.tips.topTippers.length > 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Top Tippers</h3>
              <div className="space-y-2">
                {data.tips.topTippers.map((tipper, i) => (
                  <div
                    key={tipper.name}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-2.5 transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-xs font-bold text-[var(--color-muted)]">
                        #{i + 1}
                      </span>
                      <span className="text-sm font-medium text-[var(--color-fg)]">
                        {tipper.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-degen-400">
                      {formatUsd(tipper.totalUsd)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last 10 tips */}
          {data.tips.last10.length > 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Recent Tips</h3>
              <div className="space-y-2">
                {data.tips.last10.map((tip, i) => (
                  <TipRow key={`${tip.createdAt}-${i}`} tip={tip} />
                ))}
              </div>
            </div>
          )}
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
