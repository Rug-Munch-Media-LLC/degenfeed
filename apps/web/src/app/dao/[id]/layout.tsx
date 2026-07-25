'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

// ─── Nav Config ─────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const DAO_NAV: NavItem[] = [
  { href: '', icon: '📊', label: 'Overview' },
  { href: '/treasury', icon: '💰', label: 'Treasury' },
  { href: '/members', icon: '👥', label: 'Members' },
  { href: '/proposals', icon: '📋', label: 'Proposals' },
  { href: '/settings', icon: '⚙️', label: 'Settings' },
];

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export { formatTimeAgo, shortAddr };

// ─── Mock DAO Data ──────────────────────────────────────────────────────

export const MOCK_DAO = {
  id: 'mydao',
  name: 'DegenDAO',
  description:
    'A community-governed DAO funding web3 social infrastructure, cross-protocol development, and creator economy experiments.',
  avatar: '🏴',
  memberCount: 342,
  treasuryValueUsd: 1_240_000,
  activeProposals: 3,
  totalProposals: 47,
  socialLinks: {
    twitter: 'https://twitter.com/degenfeed',
    discord: 'https://discord.gg/degenfeed',
    telegram: 'https://t.me/degenfeed',
    website: 'https://degenfeed.xyz',
  },
  treasuryTokens: [
    { symbol: 'ETH', amount: 180, usdValue: 612_000, color: 'var(--color-protocol-bluesky)' },
    { symbol: 'USDC', amount: 320_000, usdValue: 320_000, color: 'var(--color-accent)' },
    {
      symbol: 'DEGEN',
      amount: 1_200_000,
      usdValue: 180_000,
      color: 'var(--color-accent-secondary)',
    },
    { symbol: 'SOL', amount: 1_200, usdValue: 128_000, color: 'var(--color-accent-tertiary)' },
  ],
  recentTransactions: [
    {
      type: 'incoming',
      label: 'Tip pool distribution',
      amount: '12.5 ETH',
      usdValue: 42500,
      timestamp: Date.now() - 3600000 * 2,
    },
    {
      type: 'outgoing',
      label: 'Grant payment to @builder',
      amount: '5000 USDC',
      usdValue: 5000,
      timestamp: Date.now() - 3600000 * 6,
    },
    {
      type: 'outgoing',
      label: 'Contributor reward',
      amount: '2.5 ETH',
      usdValue: 8500,
      timestamp: Date.now() - 86400000,
    },
    {
      type: 'incoming',
      label: 'Treasury yield',
      amount: '1.8 ETH',
      usdValue: 6120,
      timestamp: Date.now() - 86400000 * 2,
    },
  ],
};

// ─── Layout ─────────────────────────────────────────────────────────────

export default function DAOLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dao = MOCK_DAO;

  // Extract the sub-path after /dao/[id]/
  const subPath = '/' + pathname.split('/').slice(3).join('/');

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* ══ Sidebar ══ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-5">
          <Link href={`/dao/${params.id}`} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/20 text-sm font-bold text-degen-400">
              {dao.avatar}
            </span>
            <span className="text-base font-bold text-[var(--color-fg)]">{dao.name}</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* DAO Info Mini */}
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span className="flex h-2 w-2 rounded-full bg-degen-500" />
            <span>Active</span>
            <span>·</span>
            <span>{dao.memberCount} members</span>
          </div>
          <div className="text-lg font-black tabular-nums text-degen-400">
            ${(dao.treasuryValueUsd / 1000000).toFixed(2)}M
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Treasury Value</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {DAO_NAV.map((item) => {
            const navHref = item.href ? `/dao/${params.id}${item.href}` : `/dao/${params.id}`;
            const isActive = subPath === (item.href || '/');
            return (
              <Link
                key={item.href || 'overview'}
                href={navHref}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors mb-0.5 ${
                  isActive
                    ? 'bg-degen-500/15 text-degen-400'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-[var(--color-border)] p-4">
          <Link
            href="/feed"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
          >
            ← Back to Feed
          </Link>
        </div>
      </aside>

      {/* ══ Main content ══ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors"
            aria-label="Open sidebar"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-bold text-[var(--color-fg)]">{dao.name}</span>
          <div className="w-10" />
        </header>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
