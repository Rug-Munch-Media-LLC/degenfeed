'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScheduledPosts } from '../../../hooks/useScheduledPosts';
import { useAuth } from '../../AuthProvider';
import { useWeb3 } from '../../Web3Provider';
import { BarChart } from './BarChart';
import { MiniBar } from './MiniBar';
import { PieChart } from './PieChart';
import { StatCard } from './StatCard';
import StorageUsage from './StorageUsage';
import type { CreatorStats, TabId } from './types';
import {
  formatCompact,
  formatDate,
  formatPercent,
  formatUsd,
  PROTOCOL_COLORS,
  PROTOCOL_LABELS,
  shortenAddress,
  TABS,
} from './types';

const ContentCalendar = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.ContentCalendar })),
  { ssr: false },
);

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
  const [subsCount] = useState(0);
  const mountedRef = useRef(true);

  const hasWallet = isConnected || !!walletAddress;
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean) || hasWallet;

  const connectedProtocols = useMemo(
    () =>
      Object.entries(signedInProtocols)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [signedInProtocols],
  );

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
        if (mountedRef.current)
          setStats((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to load analytics',
          }));
      }
    };
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [walletAddress, subsCount]);

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
      if (post) schedulePost(post.text, post.targets, newDate);
    },
    [scheduled, cancelSchedule, schedulePost],
  );

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
            Connect a wallet to unlock your unified creator dashboard.
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
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
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
                <p className="text-xs text-[var(--color-muted)]">No protocols connected yet.</p>
              )}
            </div>
          </div>
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

      {/* CONTENT */}
      {activeTab === 'content' && (
        <div className="space-y-8">
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
          <ContentCalendar
            posts={calendarPosts}
            onReschedule={handleReschedule}
            onEdit={(post) => {
              const nt = window.prompt('Edit post content:', post.text);
              if (nt && nt !== post.text) {
                cancelSchedule(post.id);
                schedulePost(nt, post.targets, new Date(post.scheduledAt));
              }
            }}
            onDelete={(postId) => cancelSchedule(postId)}
            onPublishNow={(postId) => publishNow(postId)}
          />
          {stats.totalPosts === 0 && scheduled.length === 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] py-12 text-center backdrop-blur-xl">
              <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">No content yet</h3>
              <p className="mb-4 text-xs text-[var(--color-muted)]">
                Start creating and scheduling posts.
              </p>
              <button type="button" onClick={openCompose} className="btn-primary text-sm">
                Create your first post
              </button>
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS */}
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
              Dive deep into your cross-protocol reach, engagement trends, and earnings.
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

      {/* MONETIZATION */}
      {activeTab === 'monetization' && (
        <div className="space-y-8">
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Object.keys(stats.tipsByProtocol).length > 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Earnings by Platform
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(stats.tipsByProtocol)
                    .sort(([, a], [, b]) => b - a)
                    .map(([protocol, usd]) => (
                      <MiniBar
                        key={protocol}
                        label={PROTOCOL_LABELS[protocol] || protocol}
                        value={Math.round(usd)}
                        max={Math.round(Math.max(...Object.values(stats.tipsByProtocol), 1))}
                        color={PROTOCOL_COLORS[protocol] || '#666'}
                        sub={formatUsd(usd)}
                      />
                    ))}
                </div>
              </div>
            )}
            {Object.keys(stats.tipsByCurrency).length > 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Earnings by Currency
                </h3>
                <PieChart
                  data={stats.tipsByCurrency}
                  colorMap={{
                    DEGEN: '#00ff41',
                    ETH: '#627eea',
                    SOL: '#9945ff',
                    BTC: '#f7931a',
                    USDC: '#2775ca',
                    MATIC: '#8247e5',
                  }}
                  size={140}
                />
              </div>
            )}
          </div>
          {Object.keys(stats.tipsByProtocol).length === 0 &&
            Object.keys(stats.tipsByCurrency).length === 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] py-12 text-center backdrop-blur-xl">
                <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                  No earnings yet
                </h3>
                <p className="mb-4 text-xs text-[var(--color-muted)]">
                  Connect wallets and enable tipping to start earning.
                </p>
                <Link href="/profile/monetization" className="btn-primary text-sm">
                  Set Up Monetization
                </Link>
              </div>
            )}
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
          <div className="card border-yellow-500/20 bg-yellow-500/5 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-yellow-400">Monetization Settings</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Configure tipping addresses, subscription tiers, and payment methods.
                </p>
              </div>
              <Link href="/profile/monetization" className="btn-secondary text-xs shrink-0">
                Manage Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISHING */}
      {activeTab === 'publishing' && (
        <div className="space-y-8">
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                  Cross-Protocol Composer
                </h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Write once, publish to multiple platforms.
                </p>
              </div>
              <button type="button" onClick={openCompose} className="btn-primary text-sm">
                Compose
              </button>
            </div>
          </div>
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-overlay)] text-lg">
                  📤
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                    Cross-Post to Centralized Platforms
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Medium · Substack · YouTube · TikTok · Instagram · LinkedIn
                  </p>
                </div>
              </div>
              <Link href="/creator/cross-post" className="btn-primary text-sm shrink-0">
                Manage
              </Link>
            </div>
          </div>
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
                    className={`rounded-lg border p-3 transition-all ${connected ? 'border-degen-500/20 bg-degen-500/5' : 'border-[var(--color-border)] bg-[var(--color-card)] opacity-50'}`}
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
                        className={`h-2 w-2 rounded-full ${connected ? 'shadow-[0_0_4px_rgba(0,255,65,0.5)]' : 'bg-[var(--color-muted)]'}`}
                        style={connected ? { backgroundColor: protocolColor } : {}}
                      />
                      <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
                    </div>
                    <span
                      className={`mt-1 inline-block text-[10px] font-medium ${connected ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
                    >
                      {connected ? 'Connected' : 'Not linked'}
                    </span>
                  </div>
                );
              })}
            </div>
            {!connectedProtocols.length && (
              <div className="mt-4 rounded-lg bg-yellow-500/5 p-3 text-center text-xs text-yellow-400">
                Connect accounts in Profile settings to enable cross-protocol publishing.
              </div>
            )}
          </div>
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
                <p className="text-xs text-[var(--color-muted)]">No posts scheduled.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ARTICLES */}
      {activeTab === 'articles' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Published
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-fg)]">--</p>
            </div>
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Total Tips
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-fg)]">--</p>
            </div>
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Subscribers
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-fg)]">--</p>
            </div>
          </div>
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">Ghost CMS Articles</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Write and publish long-form articles via our headless Ghost CMS.
                </p>
              </div>
              <a href="/articles" className="btn-primary shrink-0 text-xs">
                View Articles
              </a>
            </div>
          </div>
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
              Newsletter Settings
            </h3>
            <div className="space-y-4 text-xs text-[var(--color-muted)]">
              <div className="flex items-center justify-between">
                <span>Free newsletter tier</span>
                <span className="rounded-full bg-degen-500/10 px-2 py-0.5 text-degen-400">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Premium newsletter tier</span>
                <span className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[var(--color-muted)]">
                  Not configured
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cross-platform announcements</span>
                <span className="rounded-full bg-degen-500/10 px-2 py-0.5 text-degen-400">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Email provider</span>
                <span className="text-[var(--color-fg)]">SendGrid / Mailgun</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STORAGE */}
      {activeTab === 'storage' && <StorageUsage />}
    </div>
  );
}
