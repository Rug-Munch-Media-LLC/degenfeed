'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

interface RevenueSource {
  label: string;
  amount: number;
  icon: string;
  color: string;
  sub: string;
}

interface MonthlyRevenue {
  month: string;
  tips: number;
  coinFees: number;
  subs: number;
  tokenGate: number;
}

interface TopTipper {
  rank: number;
  name: string;
  address: string;
  totalUsd: number;
  count: number;
  protocol: string;
}

interface RevenuePost {
  id: string;
  content: string;
  protocol: string;
  earnings: number;
  likes: number;
  date: string;
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

const REVENUE_SOURCES: RevenueSource[] = [
  {
    label: 'Tips (Lightning + On-chain)',
    amount: 3200,
    icon: '⚡',
    color: 'var(--color-accent-tertiary)',
    sub: '89 transactions from 42 unique tippers',
  },
  {
    label: 'Creator Coin Fees (0.5%)',
    amount: 4100,
    icon: '🪙',
    color: 'var(--color-accent)',
    sub: '3 coins × trading volume $820K',
  },
  {
    label: 'Token-Gated Content',
    amount: 870,
    icon: '🔐',
    color: 'var(--color-accent-secondary)',
    sub: '12 purchases of gated posts',
  },
  {
    label: 'Subscriptions',
    amount: 1120,
    icon: '🎯',
    color: 'var(--color-protocol-bluesky)',
    sub: '47 active subscribers',
  },
];

const MONTHLY_REVENUE: MonthlyRevenue[] = [
  { month: 'Feb', tips: 2100, coinFees: 1800, subs: 650, tokenGate: 320 },
  { month: 'Mar', tips: 2400, coinFees: 2200, subs: 780, tokenGate: 410 },
  { month: 'Apr', tips: 1900, coinFees: 2600, subs: 850, tokenGate: 380 },
  { month: 'May', tips: 2800, coinFees: 3100, subs: 920, tokenGate: 560 },
  { month: 'Jun', tips: 3100, coinFees: 3800, subs: 1040, tokenGate: 720 },
  { month: 'Jul', tips: 3200, coinFees: 4100, subs: 1120, tokenGate: 870 },
];

const TOP_TIPPERS: TopTipper[] = [
  {
    rank: 1,
    name: '@cryptonaut',
    address: '0x1234...5678',
    totalUsd: 2400,
    count: 34,
    protocol: 'farcaster',
  },
  {
    rank: 2,
    name: '@degenqueen',
    address: 'bc1q...9xyz',
    totalUsd: 1850,
    count: 28,
    protocol: 'nostr',
  },
  {
    rank: 3,
    name: '@web3alice',
    address: '0xabcd...ef01',
    totalUsd: 1200,
    count: 19,
    protocol: 'bluesky',
  },
  {
    rank: 4,
    name: 'bob_onchain.sol',
    address: '5Yw4...H3mN',
    totalUsd: 890,
    count: 14,
    protocol: 'lens',
  },
  {
    rank: 5,
    name: '@satoshi_d',
    address: '0x9876...5432',
    totalUsd: 760,
    count: 11,
    protocol: 'mastodon',
  },
  {
    rank: 6,
    name: '@vitalik_fan',
    address: '0x2468...1357',
    totalUsd: 620,
    count: 9,
    protocol: 'farcaster',
  },
  {
    rank: 7,
    name: '@nft_artist',
    address: 'bc1q...7abc',
    totalUsd: 510,
    count: 7,
    protocol: 'nostr',
  },
];

const REVENUE_POSTS: RevenuePost[] = [
  {
    id: '1',
    content: 'gm — exclusive alpha thread for supporters 🧵',
    protocol: 'farcaster',
    earnings: 480,
    likes: 312,
    date: '2d ago',
  },
  {
    id: '2',
    content: 'my latest Solana trading strategy (token-gated)',
    protocol: 'bluesky',
    earnings: 350,
    likes: 189,
    date: '4d ago',
  },
  {
    id: '3',
    content: 'deep dive: why Base is the best L2 for creators',
    protocol: 'nostr',
    earnings: 290,
    likes: 245,
    date: '5d ago',
  },
  {
    id: '4',
    content: 'exclusive: upcoming coin launch details 🪙',
    protocol: 'lens',
    earnings: 210,
    likes: 167,
    date: '1w ago',
  },
  {
    id: '5',
    content: 'weekly market analysis — subscribers only',
    protocol: 'mastodon',
    earnings: 180,
    likes: 98,
    date: '1w ago',
  },
];

const PROTOCOL_REVENUE = [
  {
    protocol: 'farcaster',
    label: 'Farcaster',
    amount: 3840,
    color: 'var(--color-protocol-farcaster)',
  },
  { protocol: 'bluesky', label: 'Bluesky', amount: 2150, color: 'var(--color-protocol-bluesky)' },
  { protocol: 'nostr', label: 'Nostr', amount: 1780, color: 'var(--color-protocol-nostr)' },
  { protocol: 'lens', label: 'Lens', amount: 1120, color: 'var(--color-protocol-lens)' },
  { protocol: 'mastodon', label: 'Mastodon', amount: 590, color: 'var(--color-protocol-mastodon)' },
];

/* ─── Sub-Components ──────────────────────────────────────────── */

function SourceCard({ source }: { source: RevenueSource }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 transition-all hover:border-degen-500/20">
      <div
        className="absolute right-0 top-0 h-0.5 w-full opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${source.color})` }}
      />
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: `${source.color}18` }}
        >
          {source.icon}
        </span>
        <span className="text-xs font-medium text-[var(--color-muted)]">{source.label}</span>
      </div>
      <div className="text-2xl font-black tabular-nums text-[var(--color-fg)]">
        ${source.amount.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{source.sub}</div>
    </div>
  );
}

function StackedBarChart({ data }: { data: MonthlyRevenue[] }) {
  const w = 600;
  const h = 200;
  const pad = { top: 16, right: 8, bottom: 24, left: 36 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...data.map((d) => d.tips + d.coinFees + d.subs + d.tokenGate), 1);
  const barW = (chartW / data.length) * 0.6;
  const gap = (chartW / data.length) * 0.4;

  const colors = [
    'var(--color-accent-tertiary)',
    'var(--color-accent)',
    'var(--color-protocol-bluesky)',
    'var(--color-accent-secondary)',
  ];
  const labels = ['Tips', 'Coin Fees', 'Subs', 'Token Gate'];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Monthly revenue stacked bar chart"
    >
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={pad.left}
            y1={pad.top + (1 - f) * chartH}
            x2={w - pad.right}
            y2={pad.top + (1 - f) * chartH}
            stroke="var(--color-glass-border)"
            strokeWidth="0.5"
            opacity="0.4"
          />
          <text
            x={pad.left - 4}
            y={pad.top + (1 - f) * chartH + 3}
            textAnchor="end"
            fill="var(--color-muted)"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            ${Math.round(maxVal * f).toLocaleString()}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const x = pad.left + i * (chartW / data.length) + gap / 2;
        const _total = d.tips + d.coinFees + d.subs + d.tokenGate;
        const hTips = (d.tips / maxVal) * chartH;
        const hCoin = (d.coinFees / maxVal) * chartH;
        const hSubs = (d.subs / maxVal) * chartH;
        const hGate = (d.tokenGate / maxVal) * chartH;
        const yBase = pad.top + chartH;

        return (
          <g key={d.month}>
            {/* Token Gate (bottom) */}
            <rect
              x={x}
              y={yBase - hTips - hCoin - hSubs - hGate}
              width={barW}
              height={hGate}
              fill={colors[3]}
              rx={2}
              opacity={0.8}
            />
            {/* Subs */}
            <rect
              x={x}
              y={yBase - hTips - hCoin - hSubs}
              width={barW}
              height={hSubs}
              fill={colors[2]}
              rx={2}
              opacity={0.8}
            />
            {/* Coin Fees */}
            <rect
              x={x}
              y={yBase - hTips - hCoin}
              width={barW}
              height={hCoin}
              fill={colors[1]}
              rx={2}
              opacity={0.85}
            />
            {/* Tips (top) */}
            <rect
              x={x}
              y={yBase - hTips}
              width={barW}
              height={hTips}
              fill={colors[0]}
              rx={2}
              opacity={0.9}
            />
            {/* Label */}
            <text
              x={x + barW / 2}
              y={h - 4}
              textAnchor="middle"
              fill="var(--color-muted)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {d.month}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {labels.map((l, i) => (
        <g key={l} transform={`translate(${pad.left + i * 70}, ${h - 18})`}>
          <rect width={8} height={8} rx={1} fill={colors[i]} />
          <text x={12} y={8} fill="var(--color-muted)" fontSize="8">
            {l}
          </text>
        </g>
      ))}
    </svg>
  );
}

function TipperRow({ tipper }: { tipper: TopTipper }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 transition-all hover:border-degen-500/20">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{
          backgroundColor: `${protocolColor(tipper.protocol)}18`,
          color: protocolColor(tipper.protocol),
        }}
      >
        {tipper.rank <= 3 ? ['🥇', '🥈', '🥉'][tipper.rank - 1] : `#${tipper.rank}`}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-fg)]">{tipper.name}</span>
          <span className="text-[9px] font-mono text-[var(--color-muted)]">{tipper.address}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">{tipper.count} tips</span>
          <span
            className="flex h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: protocolColor(tipper.protocol) }}
          />
          <span className="text-[10px] text-[var(--color-muted)]">{tipper.protocol}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold tabular-nums text-degen-400">
          ${tipper.totalUsd.toLocaleString()}
        </div>
        <div className="text-[9px] text-[var(--color-muted)]">total tipped</div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────── */

export default function RevenueDashboardPage() {
  const [autoWithdraw, setAutoWithdraw] = useState(false);
  const [withdrawEth, _setWithdrawEth] = useState(0.45);
  const [withdrawSol, _setWithdrawSol] = useState(2.8);

  const totalRevenue = useMemo(() => REVENUE_SOURCES.reduce((s, r) => s + r.amount, 0), []);

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
        <Link href="/creator/analytics/revenue" className="text-degen-400">
          Revenue
        </Link>
      </div>

      {/* ── Header with total ────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-[28px] font-black tracking-tight text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Revenue Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Track earnings, manage payouts, and export tax data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Total Earned (30d)
            </div>
            <div className="text-2xl font-black tabular-nums text-degen-400">
              ${totalRevenue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Revenue Sources ─────────────────────────────────────── */}
      <section aria-label="Revenue sources" className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)] uppercase">Revenue Sources</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {REVENUE_SOURCES.map((source) => (
            <SourceCard key={source.label} source={source} />
          ))}
        </div>
      </section>

      {/* ── Charts Row ──────────────────────────────────────────── */}
      <section aria-label="Revenue charts" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Monthly trend */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Monthly Revenue Trend</h2>
            <div className="h-[200px]">
              <StackedBarChart data={MONTHLY_REVENUE} />
            </div>
          </div>

          {/* Protocol revenue breakdown */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Revenue by Protocol</h2>
            <div className="space-y-3">
              {PROTOCOL_REVENUE.map((p) => {
                const pct = ((p.amount / totalRevenue) * 100).toFixed(1);
                return (
                  <div key={p.protocol} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="w-20 text-xs font-medium text-[var(--color-fg)]">
                      {p.label}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                      <div
                        className="h-2.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${p.color}, ${p.color}66)`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
                      ${p.amount.toLocaleString()}
                    </span>
                    <span className="w-10 text-right text-[9px] text-[var(--color-muted)]">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Top Tippers + Revenue Posts ──────────────────────────── */}
      <section aria-label="Top tippers and best earning posts" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top Tippers */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Top Tippers</h2>
              <span className="text-[9px] text-[var(--color-muted)]">All time</span>
            </div>
            <div className="space-y-2">
              {TOP_TIPPERS.map((tipper) => (
                <TipperRow key={tipper.address} tipper={tipper} />
              ))}
            </div>
          </div>

          {/* Revenue per post */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-fg)]">Best Earning Posts</h2>
              <span className="text-[9px] text-[var(--color-muted)]">By revenue generated</span>
            </div>
            <div className="space-y-2">
              {REVENUE_POSTS.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 transition-all hover:border-degen-500/20"
                >
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
                    <p className="truncate text-xs font-medium text-[var(--color-fg)]">
                      {post.content}
                    </p>
                    <span className="text-[9px] text-[var(--color-muted)]">
                      {post.date} · ❤️ {post.likes}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums text-degen-400">
                      ${post.earnings}
                    </div>
                    <div className="text-[9px] text-[var(--color-muted)]">earned</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Payout Management ───────────────────────────────────── */}
      <section aria-label="Payout management" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Current Balance */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Current Balance</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-glass-border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-xs font-bold text-blue-400">
                    ETH
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">
                      {withdrawEth.toFixed(4)} ETH
                    </div>
                    <div className="text-[9px] text-[var(--color-muted)]">
                      ≈ ${(withdrawEth * 3400).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-blue-500/15 px-3 py-1.5 text-[10px] font-semibold text-blue-400 hover:bg-blue-500/25 transition-colors"
                >
                  Withdraw
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-glass-border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-xs font-bold text-purple-400">
                    SOL
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">
                      {withdrawSol.toFixed(2)} SOL
                    </div>
                    <div className="text-[9px] text-[var(--color-muted)]">
                      ≈ ${(withdrawSol * 160).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-purple-500/15 px-3 py-1.5 text-[10px] font-semibold text-purple-400 hover:bg-purple-500/25 transition-colors"
                >
                  Withdraw
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-glass-border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/20 text-xs font-bold text-yellow-400">
                    $
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">$320 USDC</div>
                    <div className="text-[9px] text-[var(--color-muted)]">On Base</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-yellow-500/15 px-3 py-1.5 text-[10px] font-semibold text-yellow-400 hover:bg-yellow-500/25 transition-colors"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Withdraw + Auto-Withdraw */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Withdraw Settings</h2>
            <div className="space-y-4">
              <button
                type="button"
                className="w-full rounded-xl bg-gradient-to-r from-degen-500 to-emerald-500 py-3 text-sm font-bold text-black shadow-lg shadow-degen-500/25 transition-all hover:shadow-degen-500/40 active:scale-[0.98]"
              >
                Withdraw All ↯
              </button>

              <div className="rounded-xl border border-[var(--color-glass-border)] p-4">
                <label className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">
                      Auto-Withdraw
                    </div>
                    <div className="text-[9px] text-[var(--color-muted)]">
                      Daily sweep to wallet
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoWithdraw}
                    aria-label="Toggle auto-withdraw"
                    onClick={() => setAutoWithdraw(!autoWithdraw)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${autoWithdraw ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'}`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${autoWithdraw ? 'translate-x-5' : ''}`}
                    />
                  </button>
                </label>
                {autoWithdraw && (
                  <div className="mt-3 space-y-2">
                    <select className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-degen-500">
                      <option>To: ETH (0x1234...5678)</option>
                      <option>To: SOL (5Yw4...H3mN)</option>
                      <option>To: Base (0xabcd...ef01)</option>
                    </select>
                    <div className="flex items-center gap-2 text-[9px] text-[var(--color-muted)]">
                      <span>Min: $50</span>
                      <span>·</span>
                      <span>Gas: auto</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tax Export */}
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
            <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Tax & Export</h2>
            <div className="space-y-3">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-glass-border)] px-4 py-3 transition-colors hover:border-degen-500/20"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/15 text-sm">
                  📄
                </span>
                <div className="flex-1 text-left">
                  <div className="text-xs font-semibold text-[var(--color-fg)]">CSV Export</div>
                  <div className="text-[9px] text-[var(--color-muted)]">
                    All transactions · 30 days
                  </div>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-[var(--color-muted)]"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-glass-border)] px-4 py-3 transition-colors hover:border-degen-500/20"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/15 text-sm">
                  📊
                </span>
                <div className="flex-1 text-left">
                  <div className="text-xs font-semibold text-[var(--color-fg)]">Tax Report</div>
                  <div className="text-[9px] text-[var(--color-muted)]">Annual summary · 2025</div>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-[var(--color-muted)]"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-glass-border)] px-4 py-3 transition-colors hover:border-degen-500/20"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-sm">
                  📋
                </span>
                <div className="flex-1 text-left">
                  <div className="text-xs font-semibold text-[var(--color-fg)]">
                    Transaction Log
                  </div>
                  <div className="text-[9px] text-[var(--color-muted)]">
                    Full history · All chains
                  </div>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-[var(--color-muted)]"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
