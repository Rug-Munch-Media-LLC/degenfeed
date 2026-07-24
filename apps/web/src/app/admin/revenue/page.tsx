'use client';

import { useCallback, useEffect, useState } from 'react';

// === Types ============================================================

interface RevenueStats {
  totalFees: number;
  feesToday: number;
  feesThisWeek: number;
  feesThisMonth: number;
  tippingVolume: number;
  tippingVolumeUsd: number;
  activeSubscriptions: number;
  newSubscriptionsToday: number;
  churnRate: number;
  revenueByProtocol: { protocol: string; icon: string; amount: number; percentage: number }[];
  recentTransactions: RevenueTransaction[];
  subscriptionTiers: { name: string; subscribers: number; revenue: number; price: number }[];
  dailyRevenue: { date: string; amount: number }[];
}

interface RevenueTransaction {
  id: string;
  type: 'fee' | 'tip' | 'subscription' | 'creator_coin';
  protocol: string;
  amount: number;
  usdValue: number;
  user: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
}

// === Helpers ==========================================================

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

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// === Default Data =====================================================

const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🟣',
  lens: '🌿',
  bluesky: '🦋',
  mastodon: '🐘',
  threads: '🧵',
  reddit: '🔴',
  rss: '📡',
};

const DEFAULT_STATS: RevenueStats = {
  totalFees: 84720,
  feesToday: 1240,
  feesThisWeek: 8920,
  feesThisMonth: 38400,
  tippingVolume: 28450,
  tippingVolumeUsd: 28450,
  activeSubscriptions: 1247,
  newSubscriptionsToday: 38,
  churnRate: 4.2,
  revenueByProtocol: [
    { protocol: 'farcaster', icon: '🟣', amount: 28400, percentage: 33.5 },
    { protocol: 'nostr', icon: '⚡', amount: 22100, percentage: 26.1 },
    { protocol: 'bluesky', icon: '🦋', amount: 15400, percentage: 18.2 },
    { protocol: 'lens', icon: '🌿', amount: 9800, percentage: 11.6 },
    { protocol: 'mastodon', icon: '🐘', amount: 5200, percentage: 6.1 },
    { protocol: 'reddit', icon: '🔴', amount: 3800, percentage: 4.5 },
  ],
  recentTransactions: [
    {
      id: 'tx1',
      type: 'tip',
      protocol: 'farcaster',
      amount: 0.5,
      usdValue: 1650,
      user: '0x8f3E…bD91',
      timestamp: Date.now() - 60000,
      status: 'completed',
    },
    {
      id: 'tx2',
      type: 'subscription',
      protocol: 'nostr',
      amount: 9.99,
      usdValue: 9.99,
      user: 'npub1…4x7t',
      timestamp: Date.now() - 300000,
      status: 'completed',
    },
    {
      id: 'tx3',
      type: 'fee',
      protocol: 'bluesky',
      amount: 0.01,
      usdValue: 32,
      user: 'did:plc:…abc1',
      timestamp: Date.now() - 600000,
      status: 'completed',
    },
    {
      id: 'tx4',
      type: 'tip',
      protocol: 'lens',
      amount: 0.1,
      usdValue: 330,
      user: '0x7B2f…9E34',
      timestamp: Date.now() - 1800000,
      status: 'completed',
    },
    {
      id: 'tx5',
      type: 'subscription',
      protocol: 'mastodon',
      amount: 4.99,
      usdValue: 4.99,
      user: '@alice…odon.social',
      timestamp: Date.now() - 3600000,
      status: 'pending',
    },
    {
      id: 'tx6',
      type: 'fee',
      protocol: 'nostr',
      amount: 0.005,
      usdValue: 16,
      user: 'npub1…k9f2',
      timestamp: Date.now() - 7200000,
      status: 'completed',
    },
    {
      id: 'tx7',
      type: 'creator_coin',
      protocol: 'farcaster',
      amount: 5,
      usdValue: 5,
      user: '0x4D1e…F782',
      timestamp: Date.now() - 10800000,
      status: 'completed',
    },
    {
      id: 'tx8',
      type: 'tip',
      protocol: 'reddit',
      amount: 0.05,
      usdValue: 165,
      user: 'u/degod_42',
      timestamp: Date.now() - 14400000,
      status: 'failed',
    },
  ],
  subscriptionTiers: [
    { name: 'Degen Basic', subscribers: 742, revenue: 3705.58, price: 4.99 },
    { name: 'Degen Pro', subscribers: 384, revenue: 3836.16, price: 9.99 },
    { name: 'Degen Whale', subscribers: 121, revenue: 3629.99, price: 29.99 },
  ],
  dailyRevenue: [
    { date: 'Jul 18', amount: 1240 },
    { date: 'Jul 19', amount: 1380 },
    { date: 'Jul 20', amount: 1120 },
    { date: 'Jul 21', amount: 1560 },
    { date: 'Jul 22', amount: 1420 },
    { date: 'Jul 23', amount: 1280 },
    { date: 'Jul 24', amount: 980 },
  ],
};

// === Component ========================================================

export default function AdminRevenuePage() {
  const [stats, setStats] = useState<RevenueStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'subscriptions'>(
    'overview',
  );
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/revenue?range=${dateRange}`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { stats: RevenueStats };
        if (data.stats) setStats(data.stats);
      }
    } catch {
      /* use defaults */
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats().finally(() => setLoading(false));
    const pi = setInterval(fetchStats, 30000);
    return () => clearInterval(pi);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--color-muted)]">Loading revenue data…</p>
        </div>
      </div>
    );
  }

  const maxRev = Math.max(...stats.dailyRevenue.map((d) => d.amount));

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl transition-all ${
            toast.kind === 'success'
              ? 'border border-green-500/30 bg-green-900/40 text-green-300'
              : 'border border-red-500/30 bg-red-900/40 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Revenue Management</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Creator coin fees, tipping volume, subscriptions, and protocol earnings
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDateRange(range)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                dateRange === range
                  ? 'bg-degen-500/15 text-degen-400'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Top metrics */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Total Revenue
          </p>
          <p className="text-xl font-bold text-degen-400">{formatUsd(stats.totalFees)}</p>
          <p className="text-[10px] text-[var(--color-muted)]">
            +{formatUsd(stats.feesToday)} today
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Tipping Volume
          </p>
          <p className="text-xl font-bold text-[var(--color-fg)]">
            {formatUsd(stats.tippingVolumeUsd)}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">Across all protocols</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Subscriptions
          </p>
          <p className="text-xl font-bold text-[var(--color-fg)]">
            {formatCount(stats.activeSubscriptions)}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            +{stats.newSubscriptionsToday} today
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Churn Rate
          </p>
          <p
            className={`text-xl font-bold ${stats.churnRate > 5 ? 'text-red-400' : 'text-[var(--color-fg)]'}`}
          >
            {stats.churnRate}%
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">Monthly</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[var(--color-border)] pb-2">
        {(
          [
            { key: 'overview', label: '📊 Overview' },
            { key: 'transactions', label: '💳 Transactions' },
            { key: 'subscriptions', label: '📋 Subscriptions' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-degen-500/15 text-degen-400 border-b-2 border-degen-500'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* == Overview Tab == */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue by Protocol */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
              Revenue by Protocol
            </h2>
            <div className="space-y-3">
              {stats.revenueByProtocol.map((p) => (
                <div key={p.protocol}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span>{p.icon}</span>
                      <span className="text-[var(--color-fg)]">{p.protocol}</span>
                    </span>
                    <span className="font-medium text-[var(--color-fg)]">
                      {formatUsd(p.amount)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                    <div
                      className="h-full rounded-full bg-degen-500 transition-all"
                      style={{ width: `${p.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Daily Revenue</h2>
            <div className="flex items-end gap-2" style={{ height: 160 }}>
              {stats.dailyRevenue.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-degen-500/40 to-degen-500/20 transition-all hover:from-degen-500/60"
                    style={{ height: `${(d.amount / maxRev) * 100}%`, minHeight: 4 }}
                  />
                  <span className="text-[8px] text-[var(--color-muted)] rotate-45 origin-left whitespace-nowrap">
                    {d.date}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Tiers */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
              Subscription Tiers
            </h2>
            <div className="space-y-3">
              {stats.subscriptionTiers.map((tier) => (
                <div
                  key={tier.name}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-fg)]">{tier.name}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">
                      {formatCount(tier.subscribers)} subscribers
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-degen-400">${tier.price.toFixed(2)}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">
                      {formatUsd(tier.revenue)}/mo
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Revenue Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <ActionButton
                icon="📄"
                label="Export Report"
                onClick={() => showToast('Revenue report export started')}
              />
              <ActionButton
                icon="📊"
                label="View Analytics"
                onClick={() => showToast('Opening full analytics…')}
              />
              <ActionButton
                icon="🏷️"
                label="Manage Tiers"
                onClick={() => setActiveTab('subscriptions')}
              />
              <ActionButton
                icon="📋"
                label="Payouts"
                onClick={() => showToast('Opening payout dashboard…')}
              />
            </div>
          </div>
        </div>
      )}

      {/* == Transactions Tab == */}
      {activeTab === 'transactions' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-[var(--color-muted)]">
              {stats.recentTransactions.length} recent transactions
            </p>
            <button
              type="button"
              onClick={() => showToast('Exporting transactions…')}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Type
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Protocol
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    USD Value
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    User
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {stats.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="bg-[var(--color-card)]">
                    <td className="px-4 py-3">
                      <span className="text-xs">
                        {tx.type === 'tip'
                          ? '💸'
                          : tx.type === 'subscription'
                            ? '📋'
                            : tx.type === 'fee'
                              ? '💳'
                              : '🪙'}{' '}
                        {tx.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {PROTOCOL_ICONS[tx.protocol] || ''} {tx.protocol}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg)]">
                      {tx.amount}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg)]">
                      {formatUsd(tx.usdValue)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted)]">
                      {shortAddr(tx.user)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          tx.status === 'completed'
                            ? 'bg-green-500/15 text-green-400'
                            : tx.status === 'pending'
                              ? 'bg-yellow-500/15 text-yellow-400'
                              : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-[var(--color-muted)]">
                      {formatTime(tx.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* == Subscriptions Tab == */}
      {activeTab === 'subscriptions' && (
        <div>
          <div className="mb-4 flex items-center gap-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                Active
              </p>
              <p className="text-lg font-bold text-[var(--color-fg)]">
                {formatCount(stats.activeSubscriptions)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                New Today
              </p>
              <p className="text-lg font-bold text-degen-400">+{stats.newSubscriptionsToday}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                Monthly Churn
              </p>
              <p
                className={`text-lg font-bold ${stats.churnRate > 5 ? 'text-red-400' : 'text-[var(--color-fg)]'}`}
              >
                {stats.churnRate}%
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Price
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Subscribers
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Monthly Revenue
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {stats.subscriptionTiers.map((tier) => (
                  <tr key={tier.name} className="bg-[var(--color-card)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-fg)]">{tier.name}</td>
                    <td className="px-4 py-3 font-mono text-[var(--color-fg)]">
                      ${tier.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {formatCount(tier.subscribers)}
                    </td>
                    <td className="px-4 py-3 font-mono text-degen-400">
                      {formatUsd(tier.revenue)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => showToast(`Editing ${tier.name}…`)}
                        className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              🎯 Subscription Insights
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--color-muted)] p-4 text-center">
                <p className="text-2xl font-bold text-degen-400">
                  {(stats.subscriptionTiers.reduce((s, t) => s + t.subscribers, 0) > 0
                    ? ((stats.subscriptionTiers[1]?.subscribers ?? 0) /
                        stats.subscriptionTiers.reduce((s, t) => s + t.subscribers, 0)) *
                      100
                    : 0
                  ).toFixed(0)}
                  %
                </p>
                <p className="text-[10px] text-[var(--color-muted)]">on Pro plan or higher</p>
              </div>
              <div className="rounded-xl bg-[var(--color-muted)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--color-fg)]">
                  $
                  {(
                    stats.subscriptionTiers.reduce((s, t) => s + t.revenue, 0) /
                    stats.subscriptionTiers.reduce((s, t) => s + t.subscribers, 0)
                  ).toFixed(2)}
                </p>
                <p className="text-[10px] text-[var(--color-muted)]">Avg Revenue Per User</p>
              </div>
              <div className="rounded-xl bg-[var(--color-muted)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--color-fg)]">{stats.churnRate}%</p>
                <p className="text-[10px] text-[var(--color-muted)]">Monthly Churn Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Sub-components ===================================================

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-4 text-center transition-colors hover:border-degen-500/30 hover:bg-[var(--color-muted)]"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium text-[var(--color-fg)]">{label}</span>
    </button>
  );
}
