'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

interface StatsHero {
  label: string;
  value: string;
  sub: string;
  icon: string;
  trend: number;
  positive: boolean;
  accent: string;
}

interface QuickAction {
  label: string;
  desc: string;
  href?: string;
  onClick?: () => void;
  icon: string;
  accent: string;
}

interface RevenueDay {
  date: string;
  tips: number;
  coinFees: number;
  subs: number;
}

interface ActivityItem {
  icon: string;
  text: string;
  time: string;
  protocol: string;
  highlight?: boolean;
}

/* ─── Mock Data ────────────────────────────────────────────────── */

const HERO_STATS: StatsHero[] = [
  {
    label: 'Total Followers',
    value: '44.2K',
    sub: 'Across 5 protocols',
    icon: '👥',
    trend: 12.4,
    positive: true,
    accent: 'var(--color-protocol-farcaster)',
  },
  {
    label: 'Coins Launched',
    value: '3',
    sub: '$DEGEN · $TICKER · $CRE8',
    icon: '🪙',
    trend: 0,
    positive: true,
    accent: 'var(--color-accent)',
  },
  {
    label: 'Revenue (30d)',
    value: '$8,420',
    sub: '$3,200 tips · $4,100 fees · $1,120 subs',
    icon: '💰',
    trend: 24.1,
    positive: true,
    accent: 'var(--color-accent-tertiary)',
  },
  {
    label: 'Growth (30d)',
    value: '+18.5%',
    sub: '+2,100 new followers this month',
    icon: '📈',
    trend: 18.5,
    positive: true,
    accent: 'var(--color-protocol-bluesky)',
  },
];

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Create New Coin',
    desc: 'Launch on Base or Solana',
    href: '/creator/coins',
    icon: '🪙',
    accent: 'var(--color-accent)',
  },
  {
    label: 'Compose Post',
    desc: 'Cross-post to all protocols',
    href: '/creator/cross-post',
    icon: '✍️',
    accent: 'var(--color-protocol-farcaster)',
  },
  {
    label: 'Schedule AMA',
    desc: 'Live audio across platforms',
    href: '/creator/live',
    icon: '🎙️',
    accent: 'var(--color-accent-secondary)',
  },
  {
    label: 'View Analytics',
    desc: 'Deep audience insights',
    href: '/creator/analytics/audience',
    icon: '📊',
    accent: 'var(--color-protocol-bluesky)',
  },
];

const REVENUE_30D: RevenueDay[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.now() - (29 - i) * 86400000);
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return {
    date: label,
    tips: 40 + Math.sin(i * 0.5) * 30 + Math.random() * 60,
    coinFees: 20 + Math.sin(i * 0.3 + 1) * 20 + Math.random() * 40,
    subs: 5 + Math.sin(i * 0.2 + 2) * 5 + Math.random() * 20,
  };
});

const ACTIVITY: ActivityItem[] = [
  {
    icon: 'F',
    text: 'New follower: @alice from Farcaster',
    time: '12m ago',
    protocol: 'farcaster',
    highlight: false,
  },
  {
    icon: '🪙',
    text: 'New coin holder: 0x1234...5678 bought 500 $TICKER',
    time: '34m ago',
    protocol: 'base',
    highlight: true,
  },
  {
    icon: '⚡',
    text: 'Tip received: 10,000 sats from @bob via Nostr',
    time: '1h ago',
    protocol: 'nostr',
    highlight: false,
  },
  {
    icon: '🔥',
    text: 'Post went viral: 1.2K likes on your Bluesky post',
    time: '2h ago',
    protocol: 'bluesky',
    highlight: true,
  },
  {
    icon: 'L',
    text: '@charlie subscribed to your premium tier',
    time: '3h ago',
    protocol: 'lens',
    highlight: false,
  },
  {
    icon: 'M',
    text: 'New mention from @dave on Mastodon',
    time: '5h ago',
    protocol: 'mastodon',
    highlight: false,
  },
  {
    icon: '📝',
    text: 'Your Lens post reached 5K impressions',
    time: '6h ago',
    protocol: 'lens',
    highlight: false,
  },
  {
    icon: '🔄',
    text: '$CRE8 crossed 100 holders on Base',
    time: '8h ago',
    protocol: 'base',
    highlight: true,
  },
];

/* ─── Protocol Color Helper ────────────────────────────────────── */

function protocolColor(p: string): string {
  const map: Record<string, string> = {
    farcaster: 'var(--color-protocol-farcaster)',
    nostr: 'var(--color-protocol-nostr)',
    lens: 'var(--color-protocol-lens)',
    bluesky: 'var(--color-protocol-bluesky)',
    mastodon: 'var(--color-protocol-mastodon)',
    base: 'var(--color-accent)',
  };
  return map[p] || 'var(--color-muted)';
}

/* ─── Stat Card ────────────────────────────────────────────────── */

function HeroStatCard({ stat, index }: { stat: StatsHero; index: number }) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 transition-all duration-300 hover:border-degen-500/20 hover:shadow-[0_0_30px_rgba(0,255,65,0.06)]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Accent stripe */}
      <div
        className="absolute right-0 top-0 h-1 w-full opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${stat.accent})` }}
      />

      <div className="mb-3 flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: `${stat.accent}18` }}
        >
          {stat.icon}
        </span>
        {stat.trend > 0 && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-bold ${stat.positive ? 'text-degen-400' : 'text-red-400'}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={stat.positive ? '' : 'rotate-180'}
              aria-hidden="true"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            +{stat.trend}%
          </span>
        )}
      </div>

      <div className="text-[28px] font-black tracking-tight tabular-nums text-[var(--color-fg)]">
        {stat.value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-[var(--color-muted)]">{stat.label}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-degen-400/80">{stat.sub}</div>
    </div>
  );
}

/* ─── Revenue Line Chart ─────────────────────────────────────── */

function RevenueChart({ data }: { data: RevenueDay[] }) {
  const w = 700;
  const h = 180;
  const pad = { top: 16, right: 8, bottom: 20, left: 0 };

  const maxVal = useMemo(
    () => Math.max(...data.map((d) => d.tips + d.coinFees + d.subs), 1),
    [data],
  );

  const xScale = (i: number) => pad.left + (i / (data.length - 1)) * (w - pad.left - pad.right);
  const yScale = (v: number) =>
    pad.top + h - pad.bottom - (v / maxVal) * (h - pad.top - pad.bottom);

  const tipsPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.tips + d.coinFees + d.subs)}`)
    .join('');
  const coinPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.coinFees + d.subs)}`)
    .join('');
  const subsPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.subs)}`)
    .join('');
  const areaBase = yScale(0);

  const areaPath = `${tipsPath}L${xScale(data.length - 1)},${areaBase}L${xScale(0)},${areaBase}Z`;

  // X-axis labels every 5 days
  const ticks = data.filter((_, i) => i % 5 === 0 || i === data.length - 1);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Revenue chart for last 30 days"
    >
      <defs>
        <linearGradient id="tipsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = pad.top + (1 - f) * (h - pad.top - pad.bottom);
        return (
          <line
            key={f}
            x1={pad.left}
            y1={y}
            x2={w - pad.right}
            y2={y}
            stroke="var(--color-glass-border)"
            strokeWidth="1"
            opacity="0.5"
          />
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#tipsGrad)" opacity="0.6" />

      {/* Stacked line: tips */}
      <path
        d={tipsPath}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Line: coin fees */}
      <path
        d={coinPath}
        fill="none"
        stroke="var(--color-accent-secondary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />

      {/* Line: subs */}
      <path
        d={subsPath}
        fill="none"
        stroke="var(--color-accent-tertiary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />

      {/* X-axis labels */}
      {ticks.map((d, i) => (
        <text
          key={i}
          x={xScale(data.indexOf(d))}
          y={h - 4}
          textAnchor="middle"
          fill="var(--color-muted)"
          fontSize="8"
          fontFamily="var(--font-mono)"
        >
          {d.date}
        </text>
      ))}
    </svg>
  );
}

/* ─── Activity Row ────────────────────────────────────────────── */

function ActivityRow({ item, index }: { item: ActivityItem; index: number }) {
  const color = protocolColor(item.protocol);
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3.5 transition-all hover:border-degen-500/20"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Icon */}
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {item.icon}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-[var(--color-fg)]">
          {item.text}
          {item.highlight && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-degen-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-degen-400">
              NEW
            </span>
          )}
        </p>
        <span className="mt-0.5 block text-[10px] font-mono text-[var(--color-muted)]">
          {item.time}
        </span>
      </div>

      {/* Protocol dot */}
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        title={item.protocol}
      />
    </div>
  );
}

/* ─── Protocol Revenue Breakdown ──────────────────────────────── */

const PROTOCOL_REVENUE = [
  {
    protocol: 'farcaster',
    label: 'Farcaster',
    amount: 3840,
    color: 'var(--color-protocol-farcaster)',
  },
  { protocol: 'bluesky', label: 'Bluesky', amount: 2150, color: 'var(--color-protocol-bluesky)' },
  { protocol: 'nostr', label: 'Nostr', amount: 1420, color: 'var(--color-protocol-nostr)' },
  { protocol: 'lens', label: 'Lens', amount: 680, color: 'var(--color-protocol-lens)' },
  { protocol: 'mastodon', label: 'Mastodon', amount: 330, color: 'var(--color-protocol-mastodon)' },
];

function ProtocolBreakdown() {
  const total = PROTOCOL_REVENUE.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="space-y-3">
      {PROTOCOL_REVENUE.map((p) => {
        const pct = ((p.amount / total) * 100).toFixed(1);
        return (
          <div key={p.protocol} className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="w-20 text-xs font-medium text-[var(--color-fg)]">{p.label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${p.color}, ${p.color}88)`,
                }}
              />
            </div>
            <span className="w-16 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
              ${p.amount.toLocaleString()}
            </span>
            <span className="w-10 text-right text-[10px] text-[var(--color-muted)]">{pct}%</span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 border-t border-[var(--color-glass-border)] pt-3">
        <span className="w-20 text-xs font-bold text-[var(--color-fg)]">Total</span>
        <div className="flex-1" />
        <span className="w-16 text-right text-xs font-bold tabular-nums text-degen-400">
          ${total.toLocaleString()}
        </span>
        <span className="w-10 text-right text-[10px] text-[var(--color-muted)]">100%</span>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────── */

export default function CreatorDashboardPage() {
  const [ready] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  const totalRevenue = useMemo(
    () => REVENUE_30D.reduce((s, d) => s + d.tips + d.coinFees + d.subs, 0),
    [],
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="skeleton h-8 w-64 rounded-lg mb-6" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
        <div className="mt-6 skeleton h-64 rounded-2xl" />
        <div className="mt-6 skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-[28px] font-black tracking-tight text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Creator Studio
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted)]">
            Your command center for Web3 creation
            <span className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
              <span className="h-1.5 w-1.5 rounded-full bg-degen-500 shadow-[0_0_6px_rgba(0,255,65,0.5)]" />
              Live
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/creator/coins" className="btn-primary text-sm">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M9 9.5c-.87-.5-2-.5-2.5-.5s-1.5.5-1.5 1.5.67 1.5 1.5 2 3.5.5 4.5 1 1 1.5 1 2.5-1.5 2-3 2-2.5-.5-3-1" />
            </svg>
            Launch Coin
          </Link>
          <Link
            href="/creator/settings"
            className="btn-secondary text-sm px-3"
            aria-label="Creator settings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Hero Stats ───────────────────────────────────────── */}
      <section aria-label="Key metrics" className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HERO_STATS.map((stat, i) => (
            <HeroStatCard key={stat.label} stat={stat} index={i} />
          ))}
        </div>
      </section>

      {/* ── Quick Actions ────────────────────────────────────── */}
      <section aria-label="Quick actions" className="mb-8">
        <h2 className="mb-3 text-sm font-bold tracking-wide text-[var(--color-fg)] uppercase">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((action) => {
            const sharedClasses =
              'group relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.04)]';
            const inner = (
              <>
                <div
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${action.accent}18` }}
                >
                  {action.icon}
                </div>
                <div className="text-sm font-bold text-[var(--color-fg)]">{action.label}</div>
                <div className="mt-0.5 text-[10px] text-[var(--color-muted)] leading-relaxed">
                  {action.desc}
                </div>
                <svg
                  className="absolute right-3 top-3 h-3.5 w-3.5 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            );
            return action.href ? (
              <Link key={action.label} href={action.href} className={sharedClasses}>
                {inner}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={sharedClasses}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Revenue Chart + Protocol Breakdown ───────────────── */}
      <section aria-label="Revenue overview" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Chart — spans 2 cols */}
          <div className="lg:col-span-2 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Revenue (Last 30 Days)</h2>
              <div className="flex items-center gap-3">
                <LegendDot color="var(--color-accent)" label="Tips" />
                <LegendDot color="var(--color-accent-secondary)" label="Coin Fees" />
                <LegendDot color="var(--color-accent-tertiary)" label="Subs" />
                <span className="text-[11px] font-bold tabular-nums text-degen-400">
                  ${Math.round(totalRevenue).toLocaleString()}
                </span>
              </div>
            </div>
            <div ref={chartRef} className="h-[180px]">
              <RevenueChart data={REVENUE_30D} />
            </div>
          </div>

          {/* Protocol breakdown */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Revenue by Protocol</h2>
            <ProtocolBreakdown />
          </div>
        </div>
      </section>

      {/* ── Activity Feed + Quick Stats ──────────────────────── */}
      <section aria-label="Recent activity" className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Activity Feed — spans 2 cols */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--color-fg)]">Recent Activity</h2>
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-degen-500" />
              </span>
              Live
            </span>
          </div>
          <div className="space-y-2">
            {ACTIVITY.map((item, i) => (
              <ActivityRow key={i} item={item} index={i} />
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">This Month</h2>
          <div className="space-y-4">
            {[
              {
                label: 'Posts Published',
                value: '47',
                sub: '+12 vs last month',
                accent: 'var(--color-accent)',
              },
              {
                label: 'Tips Received',
                value: '$3,200',
                sub: 'From 89 transactions',
                accent: 'var(--color-accent-tertiary)',
              },
              {
                label: 'New Followers',
                value: '2,124',
                sub: 'Best day: +312',
                accent: 'var(--color-protocol-bluesky)',
              },
              {
                label: 'Coin Volume',
                value: '$142K',
                sub: '$TICKER: $98K · $CRE8: $44K',
                accent: 'var(--color-accent-secondary)',
              },
              {
                label: 'Engagement Rate',
                value: '8.4%',
                sub: 'Top post: 1.2K likes',
                accent: 'var(--color-protocol-farcaster)',
              },
            ].map((stat) => (
              <div key={stat.label} className="relative">
                <div
                  className="absolute left-0 top-0 h-full w-0.5 rounded-full opacity-60"
                  style={{ backgroundColor: stat.accent }}
                />
                <div className="pl-3">
                  <div className="text-[11px] font-medium text-[var(--color-muted)]">
                    {stat.label}
                  </div>
                  <div className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                    {stat.value}
                  </div>
                  <div className="text-[9px] text-degen-400/70">{stat.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Legend Dot ──────────────────────────────────────────────── */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[9px] text-[var(--color-muted)]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
