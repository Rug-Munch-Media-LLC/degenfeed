'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

interface PlatformEarning {
  platform: string;
  followers: number;
  posts: number;
  tipsUsd: number;
  coinValueUsd: number;
  growth: number; // percent
  color: string;
  icon: string;
}

interface ContentItem {
  id: string;
  title: string;
  platform: string;
  postedAt: string;
  likes: number;
  comments: number;
  tips: number;
  reach: number;
}

/* ─── Data ────────────────────────────────────────────────────── */

const PLATFORMS: PlatformEarning[] = [
  {
    platform: 'Farcaster',
    followers: 12400,
    posts: 342,
    tipsUsd: 1280,
    coinValueUsd: 4500,
    growth: 12.4,
    color: '#8a63d2',
    icon: 'F',
  },
  {
    platform: 'Nostr',
    followers: 6900,
    posts: 187,
    tipsUsd: 890,
    coinValueUsd: 2100,
    growth: 8.7,
    color: '#8b5cf6',
    icon: 'N',
  },
  {
    platform: 'Bluesky',
    followers: 15700,
    posts: 523,
    tipsUsd: 2100,
    coinValueUsd: 3200,
    growth: 24.1,
    color: '#1185fe',
    icon: 'B',
  },
  {
    platform: 'Lens',
    followers: 4800,
    posts: 156,
    tipsUsd: 560,
    coinValueUsd: 1800,
    growth: 5.3,
    color: '#abfe2c',
    icon: 'L',
  },
  {
    platform: 'Mastodon',
    followers: 3200,
    posts: 98,
    tipsUsd: 340,
    coinValueUsd: 600,
    growth: 3.2,
    color: '#6364ff',
    icon: 'M',
  },
];

const RECENT_CONTENT: ContentItem[] = [
  {
    id: '1',
    title: 'gm — new creator coin drop on base 🪙',
    platform: 'Farcaster',
    postedAt: '2h ago',
    likes: 234,
    comments: 56,
    tips: 12,
    reach: 8900,
  },
  {
    id: '2',
    title: "just crossed 10k followers on bsky! thanks y'all",
    platform: 'Bluesky',
    postedAt: '5h ago',
    likes: 512,
    comments: 89,
    tips: 34,
    reach: 15200,
  },
  {
    id: '3',
    title: 'nostr relays have been fire lately 🔥',
    platform: 'Nostr',
    postedAt: '8h ago',
    likes: 145,
    comments: 32,
    tips: 8,
    reach: 4200,
  },
  {
    id: '4',
    title: 'thinking about building a new web3 tool... thoughts?',
    platform: 'Lens',
    postedAt: '1d ago',
    likes: 89,
    comments: 67,
    tips: 5,
    reach: 3100,
  },
];

/* ─── Mini Chart Sparkline ────────────────────────────────────── */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const w = 80;
  const h = 28;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/* ─── Stat Card ───────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.06)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/10 text-sm text-degen-400">
          {icon}
        </span>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-semibold ${trend.positive ? 'text-degen-400' : 'text-red-400'}`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={trend.positive ? '' : 'rotate-180'}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {trend.value}%
          </span>
        )}
      </div>
      <div className="text-2xl font-black tabular-nums text-[var(--color-fg)]">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--color-muted)]">{label}</div>
      {sub && <div className="mt-1 text-[10px] text-degen-400">{sub}</div>}
    </div>
  );
}

/* ─── Platform Earnings Row ───────────────────────────────────── */

function PlatformRow({ p }: { p: PlatformEarning }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 transition-all hover:border-degen-500/20">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: `${p.color}18`, color: p.color }}
      >
        {p.icon}
      </span>
      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-xs font-semibold text-[var(--color-fg)]">{p.platform}</div>
          <div className="text-[10px] text-[var(--color-muted)]">
            {p.followers.toLocaleString()} followers
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-[var(--color-fg)] tabular-nums">
            ${p.tipsUsd.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">Tips</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-degen-400 tabular-nums">
            ${p.coinValueUsd.toLocaleString()}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">Coin Value</div>
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-1">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-degen-400"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span className="text-xs font-semibold text-degen-400 tabular-nums">+{p.growth}%</span>
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">30d growth</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Content Card ────────────────────────────────────────────── */

function ContentCard({ item }: { item: ContentItem }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3.5 transition-all hover:border-degen-500/20">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-degen-500/10 px-2 py-0.5 text-[9px] font-semibold text-degen-400">
          {item.platform}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">{item.postedAt}</span>
      </div>
      <p className="mb-3 text-sm font-medium text-[var(--color-fg)] line-clamp-2">{item.title}</p>
      <div className="flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
        <span className="flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
          </svg>
          {item.likes}
        </span>
        <span className="flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {item.comments}
        </span>
        <span className="flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          {item.tips}
        </span>
        <span className="ml-auto">{item.reach.toLocaleString()} reached</span>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────── */

type DashboardTab = 'overview' | 'content' | 'analytics' | 'monetization';

export default function CreatorDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [goLiveOpen, setGoLiveOpen] = useState(false);

  const totalEarnings = useMemo(() => {
    const tips = PLATFORMS.reduce((s, p) => s + p.tipsUsd, 0);
    const coins = PLATFORMS.reduce((s, p) => s + p.coinValueUsd, 0);
    return { tips, coins, total: tips + coins };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-page-enter">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Creator Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Track earnings, content performance, and audience growth across all protocols.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGoLiveOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition-all hover:from-red-500 hover:to-rose-500 hover:shadow-red-600/35 active:scale-95"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Go Live
          </button>
          <Link
            href="/creator/coins"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-bold text-[var(--color-fg)] transition-all hover:border-degen-500/30"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M9 9.5c-.87-.5-2-.5-2.5-.5s-1.5.5-1.5 1.5.67 1.5 1.5 2 3.5.5 4.5 1 1 1.5 1 2.5-1.5 2-3 2-2.5-.5-3-1" />
            </svg>
            Coins
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1 scrollbar-none"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {(['overview', 'content', 'analytics', 'monetization'] as DashboardTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium transition-all capitalize ${
              activeTab === tab
                ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab === 'overview' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
            )}
            {tab === 'content' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            )}
            {tab === 'analytics' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            )}
            {tab === 'monetization' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M9 9.5c-.87-.5-2-.5-2.5-.5s-1.5.5-1.5 1.5.67 1.5 1.5 2 3.5.5 4.5 1 1 1.5 1 2.5-1.5 2-3 2-2.5-.5-3-1" />
              </svg>
            )}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Top Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Earnings"
              value={`$${totalEarnings.total.toLocaleString()}`}
              sub="All time"
              icon="💰"
              trend={{ value: 18.5, positive: true }}
            />
            <StatCard
              label="Total Followers"
              value="43,000"
              sub="Across 5 platforms"
              icon="👥"
              trend={{ value: 12.4, positive: true }}
            />
            <StatCard
              label="Tips Received"
              value={`$${totalEarnings.tips.toLocaleString()}`}
              sub="0% platform fee"
              icon="⚡"
              trend={{ value: 24.1, positive: true }}
            />
            <StatCard
              label="Engagement Rate"
              value="8.4%"
              sub="+2.1% this month"
              icon="📈"
              trend={{ value: 2.1, positive: true }}
            />
          </div>

          {/* Earnings by Platform */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Earnings by Platform</h2>
              <span className="text-[10px] text-[var(--color-muted)]">30-day view</span>
            </div>
            <div className="space-y-2">
              {PLATFORMS.map((p) => (
                <PlatformRow key={p.platform} p={p} />
              ))}
            </div>
          </div>

          {/* Recent Content */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Recent Content</h2>
              <Link
                href="/creator?tab=content"
                className="text-[10px] font-semibold text-degen-400 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {RECENT_CONTENT.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'content' && (
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-degen-500/10 text-2xl text-degen-400">
            📝
          </div>
          <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Content Manager</h3>
          <p className="mx-auto mb-5 max-w-sm text-xs text-[var(--color-muted)]">
            Schedule, manage, and analyze all your cross-protocol content in one place.
          </p>
          <button type="button" className="btn-primary text-sm">
            Create Post
          </button>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl text-purple-400">
            📊
          </div>
          <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Advanced Analytics</h3>
          <p className="mx-auto mb-5 max-w-sm text-xs text-[var(--color-muted)]">
            Deep audience insights, cross-protocol growth charts, and engagement benchmarks.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-degen-500/20 bg-degen-500/5 px-4 py-2 text-xs text-degen-400">
            Available on Creator plan
          </div>
        </div>
      )}

      {activeTab === 'monetization' && (
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl text-amber-400">
            🪙
          </div>
          <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Creator Coin Management</h3>
          <p className="mx-auto mb-5 max-w-sm text-xs text-[var(--color-muted)]">
            Deploy, manage, and analyze your creator coins on Base and Solana. Anti-bot, anti-whale,
            anti-rug.
          </p>
          <Link href="/creator/coins" className="btn-primary text-sm">
            Manage Coins
          </Link>
        </div>
      )}

      {/* Go Live Modal (inline fallback) */}
      {goLiveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setGoLiveOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--color-fg)]">Go Live</h3>
              <button
                type="button"
                onClick={() => setGoLiveOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-overlay)]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                  Stream Title
                </span>
                <input
                  type="text"
                  placeholder="What are you streaming?"
                  className="input text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                  Stream Type
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'solo', label: '🎥 Solo Stream', desc: 'Just you' },
                    { value: 'spaces', label: '🎙️ Audio Space', desc: 'Talk show' },
                    { value: 'collab', label: '👥 Collab', desc: 'Multi-creator' },
                    { value: 'launch', label: '🪙 Coin Launch', desc: 'Token event' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3 text-left transition-colors hover:border-degen-500/30"
                    >
                      <div className="text-xs font-semibold text-[var(--color-fg)]">
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-[var(--color-muted)]">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                  Platforms
                </span>
                <div className="flex flex-wrap gap-2">
                  {['Farcaster', 'Nostr', 'Bluesky', 'Lens', 'YouTube'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded-full border border-[var(--color-glass-border)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
                    >
                      + {p}
                    </button>
                  ))}
                </div>
              </label>
              <button
                type="button"
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition-all hover:from-red-500 hover:to-rose-500 active:scale-[0.98]"
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  Start Stream
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
