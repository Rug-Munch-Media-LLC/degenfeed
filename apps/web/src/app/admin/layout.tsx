'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

// ─── Nav config ─────────────────────────────────────────────────────────

interface NavSection {
  label: string;
  items: { href: string; icon: string; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', icon: '📊', label: 'Dashboard' }],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/content', icon: '📝', label: 'Content Feed' },
      { href: '/admin/moderation', icon: '🛡️', label: 'Moderation' },
      { href: '/admin/sources', icon: '📡', label: 'Source Discovery' },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin/users', icon: '👥', label: 'Users' },
      { href: '/admin/platforms', icon: '🔌', label: 'Platforms' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/admin/hosts', icon: '🖥️', label: 'Hosts' },
      { href: '/admin/system', icon: '⚙️', label: 'System' },
    ],
  },
];

const ADMIN_WALLETS_RAW = process.env.NEXT_PUBLIC_ADMIN_WALLETS || '';
const ADMIN_WALLETS = new Set(
  ADMIN_WALLETS_RAW.split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean),
);

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Layout ─────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { walletAddress } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = walletAddress && ADMIN_WALLETS.has(walletAddress.toLowerCase());

  // ── Auth gate ──

  if (!walletAddress || !isAdmin) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-6 text-6xl">🔒</div>
          <h1 className="mb-4 text-3xl font-bold text-[var(--color-fg)]">Admin Access Required</h1>
          <p className="mb-2 text-[var(--color-muted)]">
            You need an admin wallet to access this area.
          </p>
          {walletAddress && (
            <p className="mb-6 text-sm text-[var(--color-muted)]">
              Connected: <code className="text-degen-400">{shortAddr(walletAddress)}</code>
              {' — '}not in admin list.
            </p>
          )}
          {!walletAddress && (
            <p className="mb-6 text-sm text-[var(--color-muted)]">
              Please connect your wallet first.
            </p>
          )}
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 rounded-xl bg-degen-500/20 px-6 py-3 text-sm font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
          >
            ← Back to Feed
          </Link>
        </div>
      </div>
    );
  }

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

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-5">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/20 text-sm font-bold text-degen-400">
              DF
            </span>
            <span className="text-base font-bold text-[var(--color-fg)]">Admin</span>
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                {section.label}
              </p>
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
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
            </div>
          ))}
        </nav>

        {/* Sidebar footer — wallet info + logout */}
        <div className="border-t border-[var(--color-border)] p-4">
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-[var(--color-muted)] px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-degen-500" />
            <span className="truncate font-mono text-xs text-[var(--color-muted)]">
              {shortAddr(walletAddress)}
            </span>
          </div>
          <Link
            href="/feed"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
          >
            ← Back to App
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
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
              <title>Menu</title>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-bold text-[var(--color-fg)]">Admin</span>
          <div className="w-10" />
        </header>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
