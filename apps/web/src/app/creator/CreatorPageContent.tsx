'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useWeb3 } from '../../components/Web3Provider';
import { useScheduledPosts } from '../../hooks/useScheduledPosts';

/* ─── Dynamic imports ─── */

const ContentCalendar = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.ContentCalendar })),
  { ssr: false },
);

/* ─── Types ─── */

interface CreatorStats {
  totalPosts: number;
  totalFollowers: number;
  totalTipsUsd: number;
  totalSubscribers: number;
  engagementRate: number;
  tipsByProtocol: Record<string, number>;
  tipsByCurrency: Record<string, number>;
  earningsByMonth: number[];
  earningsMonthLabels: string[];
  topTippers: Array<{ name: string; totalUsd: number }>;
  loading: boolean;
  error: string | null;
}

type TabId = 'overview' | 'content' | 'analytics' | 'monetization' | 'publishing' | 'articles';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◆' },
  { id: 'content', label: 'Content', icon: '📝' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'monetization', label: 'Monetization', icon: '✦' },
  { id: 'articles', label: 'Articles', icon: '📄' },
  { id: 'publishing', label: 'Publishing', icon: '📤' },
];

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888888',
  ethereum: '#627eea',
  solana: '#9945ff',
  reddit: '#ff4500',
};

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads (Experimental)',
  ethereum: 'Ethereum',
  solana: 'Solana',
  reddit: 'Reddit',
};

const CURRENCY_COLORS: Record<string, string> = {
  DEGEN: '#00ff41',
  ETH: '#627eea',
  SOL: '#9945ff',
  BTC: '#f7931a',
  USDC: '#2775ca',
  MATIC: '#8247e5',
};

/* ─── Helpers ─── */

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ─── Stat Card ─── */

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: string;
}) {
  return (
    <div className="card relative overflow-hidden border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl transition-all duration-300 hover:border-degen-500/20 hover:shadow-[0_0_30px_rgba(0,255,65,0.06)]">
      {accent && (
        <div
          className="absolute right-0 top-0 h-1 w-full opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accent})` }}
        />
      )}
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-lg" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
          {label}
        </span>
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--color-fg)]">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

/* ─── Mini Bar ─── */

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

/* ─── Bar Chart ─── */

function BarChart({
  data,
  labels,
  color,
  height = 120,
}: {
  data: number[];
  labels: string[];
  color: string;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
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
            <span className="mt-1 text-[9px] text-[var(--color-muted)] writing-mode-vertical">
              {labels[i]?.slice(0, 3)}
            </span>
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-fg)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {labels[i]}: {formatUsd(v)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Pie (CSS conic gradient) ─── */

function PieChart({
  data,
  colorMap,
  size = 140,
}: {
  data: Record<string, number>;
  colorMap: Record<string, string>;
  size?: number;
}) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-[var(--color-muted)]"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const segments = Object.entries(data).filter(([, v]) => v > 0);
  const conic = segments
    .reduce(
      (acc, [_key, val], i) => {
        const pct = (val / total) * 360;
        const start = i === 0 ? 0 : acc.reduce((s, [, p]) => s + p, 0);
        const end = start + pct;
        acc.push([pct, start, end] as [number, number, number]);
        return acc;
      },
      [] as [number, number, number][],
    )
    .map(([_pct, start, end], i) => {
      const seg = segments[i];
      const key = seg ? seg[0] : '';
      return `${colorMap[key] || '#666'} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div className="flex items-center gap-4">
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

/* ─── Main Dashboard ─── */

export default function CreatorDashboard() {
  const { ready, walletAddress, primaryIdentity, signedInProtocols, openSignIn, openCompose } =
    useAuth();
  const { isConnected } = useWeb3();
  const { scheduled, schedulePost, cancelSchedule, publishNow } = useScheduledPosts();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<CreatorStats>({
    totalPosts: 0,
    totalFollowers: 0,
    totalTipsUsd: 0,
    totalSubscribers: 0,
    engagementRate: 0,
    tipsByProtocol: {},
    tipsByCurrency: {},
    earningsByMonth: [],
    earningsMonthLabels: [],
    topTippers: [],
    loading: true,
    error: null,
  });
  const [subsCount, setSubsCount] = useState(0);
  const mountedRef = useRef(true);

  const hasWallet = isConnected || !!walletAddress;
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean) || hasWallet;

  const connectedProtocols = useMemo(() => {
    return Object.entries(signedInProtocols)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }, [signedInProtocols]);

  // Fetch analytics data
  useEffect(() => {
    mountedRef.current = true;
    const fetchData = async () => {
      setStats((s) => ({ ...s, loading: true, error: null }));
      try {
        const params = new URLSearchParams();
        if (walletAddress) params.set('wallet', walletAddress);
        const qs = params.toString();
        const res = await fetch(`/api/analytics${qs ? `?${qs}` : ''}`);
        if (!res.ok) throw new Error(`Analytics API: ${res.status}`);
        const data = (await res.json()) as {
          followers?: { total?: number };
          posts?: { total?: number };
          engagement?: { rate?: number };
          tips?: {
            totalUsd?: number;
            byProtocol?: Record<string, number>;
            byCurrency?: Record<string, number>;
            history30d?: number[];
            historyLabels?: string[];
            topTippers?: Array<{ name: string; totalUsd: number }>;
          };
        };

        setStats({
          totalPosts: data.posts?.total ?? 0,
          totalFollowers: data.followers?.total ?? 0,
          totalTipsUsd: data.tips?.totalUsd ?? 0,
          totalSubscribers: subsCount,
          engagementRate: data.engagement?.rate ?? 0,
          tipsByProtocol: data.tips?.byProtocol ?? {},
          tipsByCurrency: data.tips?.byCurrency ?? {},
          earningsByMonth: data.tips?.history30d ?? [],
          earningsMonthLabels: data.tips?.historyLabels ?? [],
          topTippers: data.tips?.topTippers ?? [],
          loading: false,
          error: null,
        });
      } catch (e) {
        if (mountedRef.current) {
          setStats((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to load analytics',
          }));
        }
      }
    };

    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [walletAddress, subsCount]);

  // Load subscription data (count of subscribers)
  useEffect(() => {
    let cancelled = false;
    const loadSubscribers = async () => {
      try {
        const res = await fetch('/api/subscription/my', { credentials: 'include' });
        if (res.ok) {
          const _data = (await res.json()) as { subscriptions?: Array<unknown> };
          if (!cancelled) setSubsCount(0);
        }
      } catch {
        /* ignore */
      }
    };
    loadSubscribers();
    return () => {
      cancelled = true;
    };
  }, []);

  // Convert scheduled posts to calendar format
  const calendarPosts = useMemo(
    () =>
      scheduled.map((p) => ({
        id: p.id,
        text: p.text,
        scheduledAt: p.scheduledAt,
        targets: p.targets,
        protocol: p.targets[0] || 'unknown',
        status: 'scheduled' as const,
      })),
    [scheduled],
  );

  const handleReschedule = useCallback(
    (postId: string, newDate: Date) => {
      cancelSchedule(postId);
      const post = scheduled.find((p) => p.id === postId);
      if (post) {
        schedulePost(post.text, post.targets, newDate);
      }
    },
    [scheduled, cancelSchedule, schedulePost],
  );

  /* ─── Wallet Gate ─── */

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="space-y-4">
          <div className="skeleton h-8 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!hasSignedIn) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
            <span className="text-3xl text-degen-400">◆</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Creator Studio</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Connect a wallet to unlock your unified creator dashboard — scheduling, analytics,
            monetization, and cross-protocol publishing.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button type="button" onClick={openSignIn} className="btn-primary">
              Connect Wallet
            </button>
            <Link href="/profile" className="btn-secondary text-sm">
              Go to Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Dashboard ─── */

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
            Creator Studio
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted)]">
            Your unified creator toolkit
            {primaryIdentity?.displayName && (
              <span className="text-degen-400">· {primaryIdentity.displayName}</span>
            )}
            {walletAddress && (
              <span className="text-[10px] font-mono text-[var(--color-muted)]">
                · {shortenAddress(walletAddress)}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openCompose}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            New Post
          </button>
          <Link href="/profile/analytics" className="btn-secondary text-sm">
            Full Analytics
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-8 flex border-b border-[var(--color-border)] overflow-x-auto"
        role="tablist"
        aria-label="Creator tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* ─────── OVERVIEW ─────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="Published Posts"
              value={stats.totalPosts > 0 ? formatCompact(stats.totalPosts) : '—'}
              sub="All time across protocols"
              accent="#00ff41"
              icon="📝"
            />
            <StatCard
              label="Total Followers"
              value={stats.totalFollowers > 0 ? formatCompact(stats.totalFollowers) : '—'}
              sub={
                stats.totalFollowers > 0
                  ? `Across ${connectedProtocols.length} protocols`
                  : 'Connect protocols'
              }
              accent="#8a63d2"
              icon="👥"
            />
            <StatCard
              label="Tips Received"
              value={stats.totalTipsUsd > 0 ? formatUsd(stats.totalTipsUsd) : '—'}
              sub={stats.totalTipsUsd > 0 ? 'All time earnings' : 'Enable tipping to start'}
              accent="#f7931a"
              icon="✦"
            />
            <StatCard
              label="Subscribers"
              value={stats.totalSubscribers > 0 ? formatCompact(stats.totalSubscribers) : '—'}
              sub={stats.totalSubscribers > 0 ? 'Active subscribers' : 'Set up subscription tiers'}
              accent="#627eea"
              icon="🎯"
            />
            <StatCard
              label="Engagement Rate"
              value={stats.engagementRate > 0 ? formatPercent(stats.engagementRate) : '—'}
              sub={stats.engagementRate > 0 ? 'Across all posts' : 'Post to see engagement'}
              accent="#1185fe"
              icon="📈"
            />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openCompose}
                  className="rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
                >
                  ✦ Compose & Schedule
                </button>
                <Link
                  href="/profile/analytics"
                  className="rounded-lg bg-[var(--color-muted)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                >
                  📊 View Analytics
                </Link>
                <Link
                  href="/profile/monetization"
                  className="rounded-lg bg-[var(--color-muted)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                >
                  💰 Manage Monetization
                </Link>
                <Link
                  href="/creator/newsletter"
                  className="rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
                >
                  ✉ Newsletter
                </Link>
                <Link
                  href="/profile"
                  className="rounded-lg bg-[var(--color-muted)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                >
                  🔗 Manage Identities
                </Link>
              </div>
            </div>

            {/* Connected protocols status */}
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
                Connected Protocols
              </h3>
              {connectedProtocols.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {connectedProtocols.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${PROTOCOL_COLORS[p] || '#666'}20`,
                        color: PROTOCOL_COLORS[p] || '#666',
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PROTOCOL_COLORS[p] }}
                      />
                      {PROTOCOL_LABELS[p] || p}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-muted)]">
                  No protocols connected yet.{' '}
                  <Link
                    href="/profile"
                    className="text-degen-400 underline underline-offset-2 hover:no-underline"
                  >
                    Connect accounts
                  </Link>
                </p>
              )}
            </div>
          </div>

          {/* Monthly earnings chart */}
          {stats.earningsByMonth.length > 0 && stats.earningsByMonth.some((v) => v > 0) && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                30-Day Earnings (USD)
              </h3>
              <div className="overflow-x-auto pb-2">
                <BarChart
                  data={stats.earningsByMonth}
                  labels={stats.earningsMonthLabels}
                  color="#f7931a"
                  height={140}
                />
              </div>
            </div>
          )}

          {/* Loading / Error states */}
          {stats.loading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-xl" />
              ))}
            </div>
          )}
          {stats.error && (
            <div className="card border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-xs text-red-400">{stats.error}</p>
            </div>
          )}
        </div>
      )}

      {/* ─────── CONTENT ─────── */}
      {activeTab === 'content' && (
        <div className="space-y-8">
          {/* Quick summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Published"
              value={stats.totalPosts > 0 ? formatCompact(stats.totalPosts) : '—'}
              accent="#00ff41"
              icon="📝"
            />
            <StatCard
              label="Scheduled"
              value={String(scheduled.length)}
              sub="Pending publication"
              accent="#8a63d2"
              icon="📅"
            />
            <StatCard
              label="Top Performer Tips"
              value={stats.totalTipsUsd > 0 ? formatUsd(stats.totalTipsUsd) : '—'}
              accent="#f7931a"
              icon="✦"
            />
          </div>

          {/* Content Calendar */}
          <ContentCalendar
            posts={calendarPosts}
            onReschedule={handleReschedule}
            onEdit={(post) => {
              const newText = window.prompt('Edit post content:', post.text);
              if (newText && newText !== post.text) {
                cancelSchedule(post.id);
                schedulePost(newText, post.targets, new Date(post.scheduledAt));
              }
            }}
            onDelete={(postId) => cancelSchedule(postId)}
            onPublishNow={(postId) => publishNow(postId)}
          />

          {/* Empty state */}
          {stats.totalPosts === 0 && scheduled.length === 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] py-12 text-center backdrop-blur-xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] text-lg text-[var(--color-muted)]">
                📝
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">No content yet</h3>
              <p className="mb-4 text-xs text-[var(--color-muted)]">
                Start creating and scheduling posts across your connected protocols.
              </p>
              <button type="button" onClick={openCompose} className="btn-primary text-sm">
                Create your first post
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────── ANALYTICS ─────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="card border-degen-500/20 bg-degen-500/5 p-6 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-overlay)]">
              <span className="text-2xl text-degen-400">📊</span>
            </div>
            <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">
              Detailed Creator Analytics
            </h2>
            <p className="mb-6 text-sm text-[var(--color-muted)] max-w-lg mx-auto">
              Dive deep into your cross-protocol reach, engagement trends, audience insights, and
              earnings breakdown with our full analytics dashboard.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/profile/analytics" className="btn-primary">
                Open Full Analytics
              </Link>
              <Link href="/profile/analytics" className="btn-secondary text-sm">
                Export Data
              </Link>
            </div>
          </div>

          {/* Quick stats preview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Followers"
              value={stats.totalFollowers > 0 ? formatCompact(stats.totalFollowers) : '—'}
              sub="Across all protocols"
              accent="#00ff41"
            />
            <StatCard
              label="Total Posts"
              value={stats.totalPosts > 0 ? formatCompact(stats.totalPosts) : '—'}
              sub="All time"
              accent="#8a63d2"
            />
            <StatCard
              label="Tips (USD)"
              value={stats.totalTipsUsd > 0 ? formatUsd(stats.totalTipsUsd) : '—'}
              sub="All time earnings"
              accent="#f7931a"
            />
            <StatCard
              label="Engagement Rate"
              value={stats.engagementRate > 0 ? formatPercent(stats.engagementRate) : '—'}
              sub="Likes, reposts, replies"
              accent="#1185fe"
            />
          </div>
        </div>
      )}

      {/* ─────── MONETIZATION ─────── */}
      {activeTab === 'monetization' && (
        <div className="space-y-8">
          {/* Earnings summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Earnings"
              value={stats.totalTipsUsd > 0 ? formatUsd(stats.totalTipsUsd) : '—'}
              sub="Tips + subscriptions"
              accent="#00ff41"
              icon="💰"
            />
            <StatCard
              label="DEGEN"
              value={stats.tipsByCurrency.DEGEN ? formatCompact(stats.tipsByCurrency.DEGEN) : '—'}
              sub="Degen tokens"
              accent="#00ff41"
              icon="◆"
            />
            <StatCard
              label="ETH"
              value={stats.tipsByCurrency.ETH ? `${stats.tipsByCurrency.ETH.toFixed(4)}` : '—'}
              sub="Ethereum"
              accent="#627eea"
              icon="◆"
            />
            <StatCard
              label="SOL"
              value={stats.tipsByCurrency.SOL ? `${stats.tipsByCurrency.SOL.toFixed(2)}` : '—'}
              sub="Solana"
              accent="#9945ff"
              icon="◎"
            />
          </div>

          {/* Earnings by protocol & currency */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Object.keys(stats.tipsByProtocol).length > 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Earnings by Platform
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(stats.tipsByProtocol)
                    .sort(([, a], [, b]) => b - a)
                    .map(([protocol, usd]) => {
                      const color = PROTOCOL_COLORS[protocol] || '#666';
                      const maxTip = Math.max(...Object.values(stats.tipsByProtocol), 1);
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

            {Object.keys(stats.tipsByCurrency).length > 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Earnings by Currency
                </h3>
                <PieChart data={stats.tipsByCurrency} colorMap={CURRENCY_COLORS} size={140} />
              </div>
            )}
          </div>

          {/* Empty earnings state */}
          {Object.keys(stats.tipsByProtocol).length === 0 &&
            Object.keys(stats.tipsByCurrency).length === 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] py-12 text-center backdrop-blur-xl">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] text-lg text-[var(--color-muted)]">
                  ✦
                </div>
                <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                  No earnings yet
                </h3>
                <p className="mb-4 text-xs text-[var(--color-muted)]">
                  Connect wallets and enable tipping to start earning across protocols.
                </p>
                <Link href="/profile/monetization" className="btn-primary text-sm">
                  Set Up Monetization
                </Link>
              </div>
            )}

          {/* Top tippers */}
          {stats.topTippers.length > 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">Top Tippers</h3>
                <span className="text-[10px] text-[var(--color-muted)]">All time</span>
              </div>
              <div className="space-y-2">
                {stats.topTippers.map((tipper, i) => (
                  <div
                    key={tipper.name}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-2.5 transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-xs font-bold text-[var(--color-muted)]">
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                      </span>
                      <span className="text-sm font-medium text-[var(--color-fg)]">
                        {tipper.name.length > 20 ? shortenAddress(tipper.name) : tipper.name}
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

          {/* Monthly earnings trend */}
          {stats.earningsByMonth.length > 0 && stats.earningsByMonth.some((v) => v > 0) && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Monthly Trend</h3>
              <div className="overflow-x-auto pb-2">
                <BarChart
                  data={stats.earningsByMonth}
                  labels={stats.earningsMonthLabels}
                  color="#f7931a"
                  height={160}
                />
              </div>
            </div>
          )}

          {/* Monetization settings link */}
          <div className="card border-yellow-500/20 bg-yellow-500/5 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-yellow-400">Monetization Settings</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Configure your tipping addresses, subscription tiers, and preferred payment
                  methods.
                </p>
              </div>
              <Link href="/profile/monetization" className="btn-secondary text-xs shrink-0">
                Manage Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─────── PUBLISHING ─────── */}
      {activeTab === 'publishing' && (
        <div className="space-y-8">
          {/* Cross-Protocol Composer */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                  Cross-Protocol Composer
                </h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Write once, publish to multiple platforms with per-platform scheduling and
                  previews.
                </p>
              </div>
              <button type="button" onClick={openCompose} className="btn-primary text-sm">
                Compose
              </button>
            </div>

            {/* Quick compose explanation */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/20 text-degen-400 text-sm">
                  ✦
                </span>
                <div>
                  <div className="text-sm font-medium text-[var(--color-fg)]">
                    Cross-protocol posting with Postiz
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Mastodon · Bluesky · Nostr · Farcaster · Lens · Threads · LinkedIn · Reddit ·
                    Telegram · Discord
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-xs text-[var(--color-muted)]">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">1.</span>
                  <span>Write your post in the composer</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">2.</span>
                  <span>Select which platforms to publish to</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">3.</span>
                  <span>Set different publish times per platform, or publish immediately</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-degen-400">4.</span>
                  <span>Preview how your post will look on each platform</span>
                </div>
              </div>
            </div>
          </div>

          {/* Connected publishing platforms */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
              Publishing Platforms
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(PROTOCOL_LABELS).map(([id, label]) => {
                const connected = signedInProtocols[id];
                const protocolColor = PROTOCOL_COLORS[id] || '#666';
                return (
                  <div
                    key={id}
                    className={`rounded-lg border p-3 transition-all ${
                      connected
                        ? 'border-degen-500/20 bg-degen-500/5'
                        : 'border-[var(--color-border)] bg-[var(--color-card)] opacity-50'
                    }`}
                    style={
                      connected
                        ? {
                            borderColor: `${protocolColor}40`,
                            backgroundColor: `${protocolColor}08`,
                          }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          connected
                            ? 'shadow-[0_0_4px_rgba(0,255,65,0.5)]'
                            : 'bg-[var(--color-muted)]'
                        }`}
                        style={connected ? { backgroundColor: protocolColor } : {}}
                      />
                      <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
                    </div>
                    <span
                      className={`mt-1 inline-block text-[10px] font-medium ${
                        connected ? 'text-degen-400' : 'text-[var(--color-muted)]'
                      }`}
                    >
                      {connected ? 'Connected' : 'Not linked'}
                    </span>
                  </div>
                );
              })}
            </div>

            {!connectedProtocols.length && (
              <div className="mt-4 rounded-lg bg-yellow-500/5 p-3 text-center text-xs text-yellow-400">
                Connect accounts in your{' '}
                <Link href="/profile" className="underline underline-offset-2 hover:no-underline">
                  Profile settings
                </Link>{' '}
                to enable cross-protocol publishing.
              </div>
            )}
          </div>

          {/* Content calendar in publishing tab */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                  Publishing Schedule
                </h3>
                <p className="text-xs text-[var(--color-muted)]">
                  {scheduled.length} scheduled post{scheduled.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {scheduled.length > 0 ? (
              <div className="space-y-2">
                {scheduled.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/10 text-degen-400 text-xs">
                      📅
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--color-fg)] line-clamp-1">{post.text}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
                          {formatDate(post.scheduledAt)}
                        </span>
                        <span className="text-[10px] text-[var(--color-muted)]">·</span>
                        <div className="flex gap-1">
                          {post.targets.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium"
                              style={{
                                backgroundColor: `${PROTOCOL_COLORS[t] || '#666'}18`,
                                color: PROTOCOL_COLORS[t] || '#666',
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => publishNow(post.id)}
                        className="rounded px-2 py-1 text-[10px] text-degen-400 transition-colors hover:bg-degen-500/10"
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelSchedule(post.id)}
                        className="rounded px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-overlay)] text-sm text-[var(--color-muted)]">
                  📅
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  No posts scheduled. Use the composer to schedule posts.
                </p>
              </div>
            )}
          </div>

          {/* Post History placeholder */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Post History</h3>
            <p className="text-xs text-[var(--color-muted)]">
              View your published post history with per-platform status, engagement metrics, and
              cross-protocol analytics.
            </p>
            <div className="mt-4">
              <Link href="/profile/analytics" className="btn-secondary text-xs">
                View in Analytics
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─────── ARTICLES ─────── */}
      {activeTab === 'articles' && (
        <div className="space-y-6">
          {/* Article Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">Published</p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-fg)]">--</p>
            </div>
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">Total Tips</p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-fg)]">--</p>
            </div>
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">Subscribers</p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-fg)]">--</p>
            </div>
          </div>

          {/* Write Article CTA */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">Ghost CMS Articles</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Write and publish long-form articles via our headless Ghost CMS.
                  Articles appear on the DegenFeed Articles page and can be sent as newsletters.
                </p>
              </div>
              <a href="/articles" className="btn-primary shrink-0 text-xs">
                View Articles
              </a>
            </div>
          </div>

          {/* Article List */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">Recent Articles</h3>
              <a
                href="/articles"
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                View All
              </a>
            </div>
            <div className="py-8 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-overlay)] text-sm text-[var(--color-muted)]">
                📄
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                Articles from Ghost CMS will appear here. Subscribe to the newsletter to get notified
                of new articles.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <a href="/articles" className="btn-secondary text-xs">
                  Browse Articles
                </a>
                <a
                  href="/api/ghost/subscribe"
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)]"
                >
                  Subscribe to Newsletter
                </a>
              </div>
            </div>
          </div>

          {/* Newsletter Settings */}
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Newsletter Settings</h3>
            <div className="space-y-4 text-xs text-[var(--color-muted)]">
              <div className="flex items-center justify-between">
                <span>Free newsletter tier</span>
                <span className="rounded-full bg-degen-500/10 px-2 py-0.5 text-degen-400">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Premium newsletter tier</span>
                <span className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[var(--color-muted)]">Not configured</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cross-platform announcements</span>
                <span className="rounded-full bg-degen-500/10 px-2 py-0.5 text-degen-400">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Email provider</span>
                <span className="text-[var(--color-fg)]">SendGrid / Mailgun</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
