'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

interface ProtocolFollowerData {
  protocol: string;
  label: string;
  followers: number;
  growth30d: number;
  color: string;
}

interface EngagementMetric {
  label: string;
  value: string;
  sub: string;
  trend: 'up' | 'down' | 'neutral';
  accent: string;
}

interface TopPost {
  id: string;
  content: string;
  protocol: string;
  likes: number;
  reposts: number;
  replies: number;
  engagement: number;
  date: string;
}

interface Demographics {
  region: string;
  pct: number;
  count: number;
}

interface HourlyActivity {
  hour: number;
  posts: number;
  engagement: number;
}

/* ─── Protocol Color Helper ────────────────────────────────────── */

function protocolColor(p: string): string {
  const map: Record<string, string> = {
    farcaster: 'var(--color-protocol-farcaster)',
    nostr: 'var(--color-protocol-nostr)',
    lens: 'var(--color-protocol-lens)',
    bluesky: 'var(--color-protocol-bluesky)',
    mastodon: 'var(--color-protocol-mastodon)',
  };
  return map[p] || 'var(--color-muted)';
}

/* ─── Mock Data ────────────────────────────────────────────────── */

const PROTOCOL_FOLLOWERS: ProtocolFollowerData[] = [
  {
    protocol: 'farcaster',
    label: 'Farcaster',
    followers: 15700,
    growth30d: 8.2,
    color: 'var(--color-protocol-farcaster)',
  },
  {
    protocol: 'bluesky',
    label: 'Bluesky',
    followers: 12400,
    growth30d: 24.1,
    color: 'var(--color-protocol-bluesky)',
  },
  {
    protocol: 'nostr',
    label: 'Nostr',
    followers: 8900,
    growth30d: 12.4,
    color: 'var(--color-protocol-nostr)',
  },
  {
    protocol: 'lens',
    label: 'Lens',
    followers: 4800,
    growth30d: 5.3,
    color: 'var(--color-protocol-lens)',
  },
  {
    protocol: 'mastodon',
    label: 'Mastodon',
    followers: 3200,
    growth30d: 3.2,
    color: 'var(--color-protocol-mastodon)',
  },
];

const FOLLOWER_GROWTH_30D = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }),
  followers: 42000 + Math.sin(i * 0.2) * 2000 + i * 80 + Math.random() * 300,
}));

const ENGAGEMENT_METRICS: EngagementMetric[] = [
  {
    label: 'Avg Likes per Post',
    value: '128',
    sub: '+24% vs last month',
    trend: 'up',
    accent: 'var(--color-like-active)',
  },
  {
    label: 'Avg Reposts per Post',
    value: '47',
    sub: '+12% vs last month',
    trend: 'up',
    accent: 'var(--color-repost-active)',
  },
  {
    label: 'Avg Replies per Post',
    value: '23',
    sub: '-2% vs last month',
    trend: 'down',
    accent: 'var(--color-accent-secondary)',
  },
  {
    label: 'Engagement Rate',
    value: '8.4%',
    sub: '+2.1 pp vs last month',
    trend: 'up',
    accent: 'var(--color-accent)',
  },
];

const TOP_POSTS: TopPost[] = [
  {
    id: '1',
    content: 'gm — new creator coin drop on base 🪙',
    protocol: 'farcaster',
    likes: 234,
    reposts: 89,
    replies: 56,
    engagement: 8.9,
    date: '2d ago',
  },
  {
    id: '2',
    content: "just crossed 10k followers on bsky! thanks y'all",
    protocol: 'bluesky',
    likes: 512,
    reposts: 156,
    replies: 89,
    engagement: 12.4,
    date: '3d ago',
  },
  {
    id: '3',
    content: "nostr relays have been 🔥 lately — here's a thread on why",
    protocol: 'nostr',
    likes: 189,
    reposts: 67,
    replies: 32,
    engagement: 7.2,
    date: '4d ago',
  },
  {
    id: '4',
    content: 'thinking about building a new web3 tool... thoughts?',
    protocol: 'lens',
    likes: 145,
    reposts: 34,
    replies: 78,
    engagement: 9.1,
    date: '5d ago',
  },
  {
    id: '5',
    content: 'my take on the current state of decentralized social 🧵',
    protocol: 'mastodon',
    likes: 98,
    reposts: 28,
    replies: 45,
    engagement: 6.8,
    date: '6d ago',
  },
];

const DEMOGRAPHICS: Demographics[] = [
  { region: 'United States', pct: 31, count: 13700 },
  { region: 'Germany', pct: 9, count: 3980 },
  { region: 'United Kingdom', pct: 8, count: 3540 },
  { region: 'Japan', pct: 7, count: 3090 },
  { region: 'France', pct: 5, count: 2210 },
  { region: 'Canada', pct: 5, count: 2210 },
  { region: 'Brazil', pct: 4, count: 1770 },
  { region: 'Others', pct: 31, count: 13700 },
];

const HOURLY_ACTIVITY: HourlyActivity[] = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  posts: 5 + Math.sin((i - 8) * 0.4) * 8 + Math.random() * 10,
  engagement: 20 + Math.sin((i - 10) * 0.3) * 30 + Math.random() * 40,
}));

const CROSS_PROTOCOL_OVERLAP = [
  { label: '2+ Protocols', pct: 23, count: 10166 },
  { label: '3+ Protocols', pct: 8, count: 3536 },
  { label: '4+ Protocols', pct: 2, count: 884 },
  { label: 'All 5 Protocols', pct: 0.4, count: 177 },
];

const LOYAL_FANS = [
  { name: '@cryptonaut', protocols: ['farcaster', 'bluesky', 'nostr', 'lens'], avatar: 'CN' },
  {
    name: '@degenqueen',
    protocols: ['bluesky', 'nostr', 'farcaster', 'lens', 'mastodon'],
    avatar: 'DQ',
  },
  { name: '@web3alice', protocols: ['nostr', 'lens', 'farcaster'], avatar: 'WA' },
  { name: '@bob_onchain', protocols: ['farcaster', 'bluesky', 'mastodon'], avatar: 'BO' },
  { name: '@satoshi_d', protocols: ['lens', 'nostr', 'bluesky'], avatar: 'SD' },
];

/* ─── Sub-Components ──────────────────────────────────────────── */

function StatBadge({ label, value, sub, trend, accent }: EngagementMetric) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20">
      <div
        className="absolute right-0 top-0 h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${accent})`, opacity: 0.6 }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {label}
          </div>
          <div className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
            {value}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px]">
            {trend === 'up' && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            )}
            {trend === 'down' && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-danger)"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
            <span
              className={
                trend === 'up'
                  ? 'text-degen-400'
                  : trend === 'down'
                    ? 'text-red-400'
                    : 'text-[var(--color-muted)]'
              }
            >
              {sub}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtocolFollowersBar() {
  const max = Math.max(...PROTOCOL_FOLLOWERS.map((p) => p.followers));
  return (
    <div className="space-y-3">
      {PROTOCOL_FOLLOWERS.map((p) => {
        const pct = (p.followers / max) * 100;
        return (
          <div key={p.protocol} className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium text-[var(--color-fg)]">{p.label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
              <div
                className="h-3 rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${p.color}, ${p.color}66)`,
                }}
              />
            </div>
            <span className="w-20 text-right text-xs font-bold tabular-nums text-[var(--color-fg)]">
              {p.followers.toLocaleString()}
            </span>
            <span className="flex w-14 items-center gap-0.5 text-[10px] font-semibold text-degen-400">
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              +{p.growth30d}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FollowerGrowthChart({ data }: { data: typeof FOLLOWER_GROWTH_30D }) {
  const w = 600;
  const h = 160;
  const pad = { top: 8, right: 8, bottom: 20, left: 0 };
  const maxVal = Math.max(...data.map((d) => d.followers));
  const minVal = Math.min(...data.map((d) => d.followers));
  const range = maxVal - minVal || 1;

  const xScale = (i: number) => pad.left + (i / (data.length - 1)) * (w - pad.left - pad.right);
  const yScale = (v: number) =>
    pad.top + h - pad.bottom - ((v - minVal) / range) * (h - pad.top - pad.bottom);

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.followers)}`)
    .join('');
  const areaPath = `${linePath}L${xScale(data.length - 1)},${yScale(minVal)}L${xScale(0)},${yScale(minVal)}Z`;

  const ticks = data.filter((_, i) => i % 5 === 0 || i === data.length - 1);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Follower growth over 30 days"
    >
      <defs>
        <linearGradient id="growthArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.left}
          y1={pad.top + (1 - f) * (h - pad.top - pad.bottom)}
          x2={w - pad.right}
          y2={pad.top + (1 - f) * (h - pad.top - pad.bottom)}
          stroke="var(--color-glass-border)"
          strokeWidth="0.5"
          opacity="0.4"
        />
      ))}
      <path d={areaPath} fill="url(#growthArea)" opacity="0.5" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {ticks.map((d) => (
        <text
          key={d.date}
          x={xScale(data.indexOf(d))}
          y={h - 4}
          textAnchor="middle"
          fill="var(--color-muted)"
          fontSize="7"
          fontFamily="var(--font-mono)"
        >
          {d.date}
        </text>
      ))}
    </svg>
  );
}

function EngagementByProtocolPie() {
  const total = PROTOCOL_FOLLOWERS.reduce((s, p) => s + p.followers, 0);
  const segments = PROTOCOL_FOLLOWERS.filter((p) => p.followers > 0);
  const conic = segments
    .map((p, i) => {
      const pct = (p.followers / total) * 360;
      const start =
        i === 0 ? 0 : segments.slice(0, i).reduce((s, sp) => s + (sp.followers / total) * 360, 0);
      return `${p.color} ${start}deg ${start + pct}deg`;
    })
    .join(', ');

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div
        className="h-[140px] w-[140px] shrink-0 rounded-full"
        style={{ background: `conic-gradient(${conic})` }}
        role="img"
        aria-label="Follower distribution by protocol"
      />
      <div className="space-y-1.5">
        {segments.map((p) => (
          <div key={p.protocol} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-xs text-[var(--color-muted)]">{p.label}</span>
            <span className="ml-auto text-xs font-medium tabular-nums text-[var(--color-fg)]">
              {((p.followers / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeHeatmap({ data }: { data: HourlyActivity[] }) {
  const maxEng = Math.max(...data.map((d) => d.engagement), 1);
  return (
    <div className="grid grid-cols-12 gap-1">
      {data.map((d) => {
        const intensity = (d.engagement / maxEng) * 100;
        const bg =
          intensity > 70
            ? 'rgba(0,255,65,0.5)'
            : intensity > 40
              ? 'rgba(0,255,65,0.25)'
              : intensity > 15
                ? 'rgba(0,255,65,0.1)'
                : 'var(--color-glass-border)';
        return (
          <div key={d.hour} className="group relative">
            <div
              className="h-8 w-full rounded-md transition-all"
              style={{ backgroundColor: bg }}
              title={`${d.hour}:00 — ${Math.round(d.engagement)} engagements`}
            />
            <span className="mt-0.5 block text-center text-[7px] text-[var(--color-muted)]">
              {d.hour % 3 === 0 ? `${d.hour}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TopPostRow({ post, index }: { post: TopPost; index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 transition-all hover:border-degen-500/20">
      <span className="w-5 text-center text-xs font-bold text-[var(--color-muted)]">
        #{index + 1}
      </span>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold"
        style={{
          backgroundColor: `${protocolColor(post.protocol)}18`,
          color: protocolColor(post.protocol),
        }}
      >
        {post.protocol.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[var(--color-fg)]">{post.content}</p>
        <span className="text-[9px] text-[var(--color-muted)]">{post.date}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] tabular-nums text-[var(--color-muted)]">
        <span>❤️ {post.likes}</span>
        <span>🔄 {post.reposts}</span>
        <span>💬 {post.replies}</span>
        <span className="font-semibold text-degen-400">{post.engagement}%</span>
      </div>
    </div>
  );
}

/* ─── Cross-Protocol Overlap ──────────────────────────────────── */

function OverlapVisualizer() {
  // Simplified venn-like visualization using stacked bars
  const max = Math.max(...CROSS_PROTOCOL_OVERLAP.map((o) => o.pct));
  return (
    <div className="space-y-3">
      {CROSS_PROTOCOL_OVERLAP.map((o) => {
        const pct = (o.pct / max) * 100;
        return (
          <div key={o.label} className="flex items-center gap-3">
            <span className="w-24 text-xs text-[var(--color-muted)]">{o.label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
              <div
                className="h-2.5 rounded-full"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, var(--color-accent), var(--color-accent-secondary))`,
                }}
              />
            </div>
            <span className="w-12 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
              {o.pct}%
            </span>
            <span className="w-16 text-right text-[10px] text-[var(--color-muted)]">
              {o.count.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────── */

type AudienceTab = 'overview' | 'demographics' | 'engagement';

export default function AudienceAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AudienceTab>('overview');

  const totalFollowers = useMemo(() => PROTOCOL_FOLLOWERS.reduce((s, p) => s + p.followers, 0), []);
  const newToday = 142;
  const newThisWeek = 856;
  const newThisMonth = 2124;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/creator" className="hover:text-degen-400 transition-colors">
          Creator Studio
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <Link href="/creator/analytics/audience" className="text-degen-400">
          Audience Analytics
        </Link>
      </div>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-[28px] font-black tracking-tight text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Audience Analytics
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Deep insights into your cross-protocol audience
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-degen-500/10 px-3 py-1.5 text-[10px] font-semibold text-degen-400">
            Updated just now
          </span>
          <Link href="/creator/analytics/revenue" className="btn-secondary text-sm">
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
            Revenue
          </Link>
        </div>
      </div>

      {/* ── Audience Overview ──────────────────────────────────── */}
      <section aria-label="Audience numbers" className="mb-8">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Total Followers
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
              {totalFollowers.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[10px] text-degen-400">
              Across {PROTOCOL_FOLLOWERS.length} protocols
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              New Today
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
              {newToday}
            </div>
            <div className="mt-0.5 text-[10px] text-degen-400">+{newThisWeek} this week</div>
          </div>
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              This Month
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
              +{newThisMonth.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[10px] text-degen-400">+18.5% growth rate</div>
          </div>
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Cross-Protocol
            </div>
            <div className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">23%</div>
            <div className="mt-0.5 text-[10px] text-degen-400">Follow on 2+ protocols</div>
          </div>
        </div>
      </section>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div
        className="mb-6 flex gap-1 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1 w-fit"
        role="tablist"
        aria-label="Audience sections"
      >
        {(['overview', 'demographics', 'engagement'] as AudienceTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-4 py-2 text-xs font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview (Protocol followers + Growth) ────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Followers by protocol + growth chart */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                Followers by Protocol
              </h2>
              <ProtocolFollowersBar />
            </div>
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                Follower Growth (30 days)
              </h2>
              <div className="h-[160px]">
                <FollowerGrowthChart data={FOLLOWER_GROWTH_30D} />
              </div>
            </div>
          </div>

          {/* Follower breakdown + Cross-protocol overlap */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                Protocol Distribution
              </h2>
              <EngagementByProtocolPie />
            </div>
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                Cross-Protocol Overlap
              </h2>
              <OverlapVisualizer />
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold text-[var(--color-fg)]">
                  Your Most Loyal Fans
                </h3>
                <div className="space-y-1.5">
                  {LOYAL_FANS.map((fan) => (
                    <div
                      key={fan.name}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-degen-500/20 text-[8px] font-bold text-degen-400">
                        {fan.avatar}
                      </span>
                      <span className="text-xs font-medium text-[var(--color-fg)]">{fan.name}</span>
                      <span className="ml-auto flex gap-1">
                        {fan.protocols.map((p) => (
                          <span
                            key={p}
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: protocolColor(p) }}
                            title={p}
                          />
                        ))}
                      </span>
                      <span className="text-[9px] text-[var(--color-muted)]">
                        {fan.protocols.length}p
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Demographics ───────────────────────────────────── */}
      {activeTab === 'demographics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Top countries */}
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Top Regions</h2>
              <div className="space-y-2">
                {DEMOGRAPHICS.map((d) => (
                  <div key={d.region} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-[var(--color-muted)]">{d.region}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                      <div
                        className="h-2.5 rounded-full"
                        style={{
                          width: `${d.pct}%`,
                          background:
                            'linear-gradient(90deg, var(--color-accent), var(--color-accent-secondary))',
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
                      {d.pct}%
                    </span>
                    <span className="w-16 text-right text-[10px] text-[var(--color-muted)]">
                      {d.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active hours heatmap */}
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Active Hours</h2>
              <TimeHeatmap data={HOURLY_ACTIVITY} />
              <div className="mt-3 flex items-center justify-between text-[9px] text-[var(--color-muted)]">
                <span>Low activity</span>
                <div className="flex gap-1">
                  {[10, 25, 50, 75].map((v) => (
                    <div
                      key={v}
                      className="h-3 w-6 rounded-sm"
                      style={{
                        backgroundColor:
                          v > 70
                            ? 'rgba(0,255,65,0.5)'
                            : v > 40
                              ? 'rgba(0,255,65,0.25)'
                              : v > 15
                                ? 'rgba(0,255,65,0.1)'
                                : 'var(--color-glass-border)',
                      }}
                    />
                  ))}
                </div>
                <span>High activity</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Engagement ─────────────────────────────────────── */}
      {activeTab === 'engagement' && (
        <div className="space-y-6">
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ENGAGEMENT_METRICS.map((m) => (
              <StatBadge key={m.label} {...m} />
            ))}
          </div>

          {/* Best performing posts */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Best Performing Posts</h2>
              <span className="text-[9px] text-[var(--color-muted)]">
                Sorted by engagement rate
              </span>
            </div>
            <div className="space-y-2">
              {TOP_POSTS.map((post, i) => (
                <TopPostRow key={post.id} post={post} index={i} />
              ))}
            </div>
          </div>

          {/* Quick engagement stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
              <div className="text-lg" aria-hidden="true">
                ❤️
              </div>
              <div className="mt-1 text-xl font-black tabular-nums text-[var(--color-fg)]">
                12,847
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">Total Likes (30d)</div>
            </div>
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
              <div className="text-lg" aria-hidden="true">
                🔄
              </div>
              <div className="mt-1 text-xl font-black tabular-nums text-[var(--color-fg)]">
                4,231
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">Total Reposts (30d)</div>
            </div>
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center">
              <div className="text-lg" aria-hidden="true">
                💬
              </div>
              <div className="mt-1 text-xl font-black tabular-nums text-[var(--color-fg)]">
                2,098
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">Total Replies (30d)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
