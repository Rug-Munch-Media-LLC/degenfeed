'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCached, setCache } from '../../lib/fetchWithCache';
import { retryFetch } from '../../lib/retryFetch';
import { useAuth } from '../AuthProvider';
import { useWeb3 } from '../Web3Provider';
import { BarChart } from './BarChart';
import { ConnectProtocolsBanner } from './ConnectProtocolsBanner';
import {
  CURRENCY_COLORS,
  DEFAULT_ANALYTICS,
  PROTOCOL_COLORS,
  PROTOCOL_LABELS,
  TABS,
} from './constants';
import { Heatmap } from './Heatmap';
import { MiniBar } from './MiniBar';
import { PieChart } from './PieChart';
import { PostRow } from './PostRow';
import { ProtocolBreakdownTable } from './ProtocolBreakdownTable';
import { StatCard } from './StatCard';
import { TipRow } from './TipRow';
import type { AnalyticsData, TabId } from './types';
import { useCsvExport } from './useCsvExport';
import { formatCompact, formatPercent, formatTimeAgo, formatUsd } from './utils';

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
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (walletAddress) params.set('wallet', walletAddress);
        if (forceRefresh) params.set('refresh', 'true');
        const qs = params.toString();
        // Same-origin relative by default: /api/analytics is proxied by the
        // Next.js server (rewrite) to the self-hosted API — no CF worker.
        const workerBase = process.env.NEXT_PUBLIC_WORKER_API_URL || '';
        const res = await retryFetch(`${workerBase}/api/analytics${qs ? `?${qs}` : ''}`, {
          maxRetries: 2,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AnalyticsData;
        if (mountedRef.current) {
          setData(json);
          setCache('analytics', json);
        }
      } catch (e) {
        if (mountedRef.current) {
          const cached = getCached<AnalyticsData>('analytics');
          if (cached) {
            setData(cached);
            setError('Showing last known analytics (offline)');
          } else {
            setError(e instanceof Error ? e.message : 'Failed to load analytics');
          }
        }
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

  const handleRefresh = useCallback(() => fetchData(true), [fetchData]);
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

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="space-y-4">
          <div className="skeleton h-8 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
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
            Connect a wallet or sign in to see your cross-protocol analytics.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-overlay)] px-5 py-2.5 text-sm text-[var(--color-muted)]">
            <span className="text-degen-400">✦</span> Connect wallet to see your analytics
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="mb-8">
          <div className="skeleton mb-2 h-8 w-56" />
          <div className="skeleton h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="mt-8 skeleton h-64 rounded-xl" />
      </div>
    );
  }

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

      {data.isMock && data.protocols.connected.length === 0 && (
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-center text-xs text-yellow-400">
          Showing demo data. Connect accounts to see your real analytics.
        </div>
      )}

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
            className={`relative px-5 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-muted)]'}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                      {data.followers.growth30d[0] !== undefined
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

      {/* CONTENT */}
      {activeTab === 'content' && (
        <div className="space-y-8 animate-fade-in">
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
                No posts indexed yet.
              </div>
            )}
          </div>
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
                No tipped posts yet.
              </div>
            )}
          </div>
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
            </div>
          )}
        </div>
      )}

      {/* AUDIENCE */}
      {activeTab === 'audience' && (
        <div className="space-y-8 animate-fade-in">
          {Object.keys(data.audience.byProtocol).length > 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                Followers by Protocol
              </h3>
              <PieChart data={data.audience.byProtocol} colorMap={PROTOCOL_COLORS} size={160} />
            </div>
          )}
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
          {Object.keys(data.audience.byProtocol).length === 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-8 text-center backdrop-blur-xl">
              <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                Audience data unavailable
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Connect protocols to see where your audience lives.
              </p>
            </div>
          )}
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

      {/* EARNINGS */}
      {activeTab === 'earnings' && (
        <div className="space-y-8 animate-fade-in">
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
          {data.tips.totalUsd === 0 && data.tips.last10.length === 0 && (
            <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-8 text-center backdrop-blur-xl">
              <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                No tips received yet
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Connect wallets and enable tipping to start receiving tips.
              </p>
            </div>
          )}
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Object.keys(data.tips.byCurrency).length > 0 && (
              <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
                  Tips by Currency
                </h3>
                <PieChart data={data.tips.byCurrency} colorMap={CURRENCY_COLORS} size={140} />
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
    </div>
  );
}
