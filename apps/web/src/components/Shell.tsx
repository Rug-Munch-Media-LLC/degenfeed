'use client';

import { RealtimeStatusDot } from '@degenfeed/realtime';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useFeedLayout } from '../hooks/useFeedLayout';
import { OnboardingProvider } from '../hooks/useOnboarding';
import { AddToHomeScreenToast } from './AddToHomeScreenToast';
import { OfflineBanner } from './OfflineBanner';
import { useAuth } from './AuthProvider';
import { BottomNav } from './BottomNav';
import { FeedLayoutSwitcher } from './FeedLayoutSwitcher';
import { StreakFlame } from './StreakFlame';
import { DailyChallenges } from './DailyChallenges';
import { ActivityTicker } from './ActivityTicker';
import { InstallPrompt } from './InstallPrompt';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { OnboardingModal } from './OnboardingModal';
import { WelcomeBackModal } from './WelcomeBackModal';
import { ScrollToTop } from '@degenfeed/ui';
import { SearchOverlay } from './SearchOverlay';
import { ScreenReaderAnnouncerProvider } from './ScreenReaderAnnouncer';
import { SkipLinks } from './SkipLinks';
import { useToast } from './Toast';

// ─── Protocol nav items ──────────────────────────────────────────────────

const PROTOCOL_NAV = [
  { href: '/farcaster', label: 'Farcaster', color: '#8a63d2', icon: '◈' },
  { href: '/lens', label: 'Lens', color: '#abfe2c', icon: '◎' },
  { href: '/bluesky', label: 'Bluesky', color: '#1185fe', icon: '☁' },
  { href: '/nostr', label: 'Nostr', color: '#8e30eb', icon: '☰' },
  { href: '/mastodon', label: 'Mastodon', color: '#6364ff', icon: 'M' },
];

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';

interface NavItem {
  href: string;
  label: string;
}

const NAV: NavItem[] = [
  { href: '/feed', label: 'Feed' },
  { href: '/shorts', label: '\u{1F4F1} Shorts' },
  { href: '/feeds', label: '\u{1F4CB} Feeds' },
  { href: '/digest', label: '\u{1F4CB} Digest' },
  { href: '/trending', label: 'Trending' },
  { href: '/leaderboard', label: '\u{1F3C6} Leaderboard' },
  { href: '/spaces', label: 'Spaces' },
  { href: '/c', label: 'Communities' },
  { href: '/news', label: 'News' },
  { href: '/messages', label: '\u{1F4AC} Messages' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/discover', label: 'Discover' },
  { href: '/deploy', label: 'Launch' },
  { href: '/docs', label: 'Docs' },
  { href: '/premium', label: 'Premium' },
  { href: '/creator', label: 'Creator Studio' },
  { href: '/profile', label: 'Profile' },
];

/**
 * Small status indicator dot in the Shell header.
 *
 * Polls /api/health/protocols every 60s and shows:
 *   🟢 All protocols up
 *   🟡 Some degraded
 *   🔴 One or more down
 *
 * Clicking navigates to /status.
 */
function StatusHealthDot() {
  const [dot, setDot] = useState<'🟢' | '🟡' | '🔴'>('🟢');
  const [title, setTitle] = useState('All protocols operational');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/health/protocols', {
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        summary: { up: number; degraded: number; down: number; total: number };
      };
      const { up, degraded, down, total } = data.summary;
      if (down > 0) {
        setDot('🔴');
        setTitle(`${down} protocol${down === 1 ? '' : 's'} down · ${up}/${total} operational`);
      } else if (degraded > 0) {
        setDot('🟡');
        setTitle(
          `${degraded} protocol${degraded === 1 ? '' : 's'} degraded · ${up}/${total} operational`,
        );
      } else {
        setDot('🟢');
        setTitle(`All ${total} protocols operational`);
      }
    } catch {
      // Worker may be cold-starting — keep last known state.
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  return (
    <Link
      href="/status"
      prefetch={false}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
      title={title}
      aria-label={`Protocol health: ${title}`}
    >
      <span className="text-[10px]" aria-hidden="true">
        {dot}
      </span>
      <span className="hidden sm:inline">Status</span>
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/" className="shell-logo flex items-center gap-2 group" prefetch={true}>
      <Image
        src="/icon.svg"
        alt="DegenFeed"
        width={32}
        height={32}
        className="h-8 w-8 rounded-lg logo-glow transition-shadow group-hover:shadow-[0_0_20px_rgba(34,197,94,0.6)]"
      />
      <span
        className="shell-logo-text text-lg font-bold"
        style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}
      >
        DegenFeed
      </span>
    </Link>
  );
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Priority prefetch for above-the-fold routes
  const priorityRoutes = new Set([
    '/feed', '/discover', '/trending', '/shorts',
    '/notifications', '/messages', '/search', '/home',
  ]);
  const shouldPrefetch = priorityRoutes.has(item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      prefetch={shouldPrefetch}
      className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-all ${
        active
          ? 'text-[var(--color-fg)]'
          : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
      }`}
    >
      {item.label}
      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
      )}
    </Link>
  );
}

const PROTOCOL_PATHS = new Set(PROTOCOL_NAV.map((p) => p.href));

function ProtocolSubNav() {
  const pathname = usePathname();
  // Only show on desktop
  const isProtocolPage = PROTOCOL_PATHS.has(pathname);

  return (
    <div
      className="border-b transition-all"
      style={{
        borderColor: 'var(--color-glass-border)',
        backgroundColor: isProtocolPage ? 'var(--color-glass-bg)' : 'transparent',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-none">
        <span className="mr-1 shrink-0 text-[11px] font-medium uppercase tracking-wider text-gray-500">
          Networks
        </span>
        {PROTOCOL_NAV.map((p) => {
          const active = pathname === p.href;
          return (
            <Link
              key={p.href}
              href={p.href}
              prefetch={true}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'text-[var(--color-fg)] shadow-sm'
                  : 'text-gray-500 hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
              }`}
              style={
                active
                  ? {
                      backgroundColor: `${p.color}22`,
                      color: p.color,
                      boxShadow: `0 0 12px ${p.color}22`,
                    }
                  : undefined
              }
              aria-current={active ? 'page' : undefined}
            >
              <span aria-hidden="true" className="text-xs">
                {p.icon}
              </span>
              <span>{p.label}</span>
            </Link>
          );
        })}
        <span className="ml-auto hidden shrink-0 text-[10px] text-gray-600 sm:inline">
          Protocol-dedicated feeds
        </span>
      </div>
    </div>
  );
}

export const Shell = memo(function Shell({ children }: { children: React.ReactNode }) {
  const { ready, signedInProtocols, openSignIn, openCompose } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const { layout, setLayout, cycleLayout, isCompact, isMediaGrid, isReader, layoutLabel } =
    useFeedLayout();
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Listen for custom df-toast events (e.g., from PostCard share)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        kind?: 'info' | 'success' | 'error' | 'warning';
        message: string;
        duration?: number;
      };
      if (detail?.message) {
        showToast(detail.kind || 'success', detail.message, detail.duration);
      }
    };
    window.addEventListener('df-toast', handler);
    return () => window.removeEventListener('df-toast', handler);
  }, [showToast]);

  useEffect(() => {
    const stored = localStorage.getItem('df_theme');
    const resolved = stored === 'light' ? 'light' : 'dark';
    setTheme(resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    // Sync cookie so subsequent SSR renders match
    document.cookie = `df_theme=${resolved}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  }, []);

  // Global keyboard shortcuts handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+D: Toggle dark mode
      // Ctrl+Shift+L: Cycle through feed layouts
      if (e.key === 'L' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        cycleLayout();
        return;
      }
      if (e.key === 'D' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        setTheme((prev) => {
          const newTheme = prev === 'dark' ? 'light' : 'dark';
          document.documentElement.classList.toggle('dark', newTheme === 'dark');
          localStorage.setItem('df_theme', newTheme);
          document.cookie = `df_theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax; Secure`;
          return newTheme;
        });
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if user is typing in an input
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close help dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    if (helpOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [helpOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}
    >
      <div className="aurora-bg" />
      <div className="noise-overlay" />

      <SkipLinks />

      <header className="shell-header fixed top-0 left-0 right-0 z-50 border-b glass">
        <div className="shell-header-inner mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary" id="main-nav">
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          <div className="hidden items-center gap-1 md:flex">
            <StatusHealthDot />
            <RealtimeStatusDot />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Search"
              id="search-input"
            >
              ⌕
            </button>
            {/* Help dropdown */}
            <div ref={helpRef} className="relative">
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                className="rounded-lg px-2.5 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                aria-label="Help"
                title="Help & documentation"
                aria-expanded={helpOpen}
              >
                Help
              </button>
              {helpOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2 shadow-xl animate-slide-up z-50">
                  <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Resources
                  </div>
                  <Link
                    href="/faq"
                    onClick={() => setHelpOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                  >
                    <span className="w-4 text-center text-[11px]">?</span>
                    FAQ
                  </Link>
                  <Link
                    href="/docs/user-guide"
                    onClick={() => setHelpOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                  >
                    <span className="w-4 text-center text-[11px]">📖</span>
                    User Guide
                  </Link>
                  <Link
                    href="/docs/comparison"
                    onClick={() => setHelpOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                  >
                    <span className="w-4 text-center text-[11px]">⚖</span>
                    Platform Comparison
                  </Link>
                  <Link
                    href="/docs/troubleshooting"
                    onClick={() => setHelpOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                  >
                    <span className="w-4 text-center text-[11px]">🔧</span>
                    Troubleshooting
                  </Link>
                  <Link
                    href="/status"
                    onClick={() => setHelpOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                  >
                    <span className="w-4 text-center text-[11px]">◆</span>
                    System Status
                  </Link>
                  <div className="my-1 border-t border-[var(--color-glass-border)]" />
                  <button
                    type="button"
                    onClick={() => {
                      setHelpOpen(false);
                      setShowShortcuts(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
                  >
                    <span className="w-4 text-center font-bold text-[11px]">⌘</span>
                    Keyboard Shortcuts
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setTheme((t) => {
                  const next = t === 'dark' ? 'light' : 'dark';
                  document.documentElement.classList.toggle('dark', next === 'dark');
                  localStorage.setItem('df_theme', next);
                  document.cookie = `df_theme=${next}; path=/; max-age=31536000; SameSite=Lax; Secure`;
                  return next;
                })
              }
              className="rounded-lg px-2 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☾' : '☀'}
            </button>
            <FeedLayoutSwitcher current={layout} onChange={setLayout} />
            <StreakFlame />
            {!ready ? (
              <div className="skeleton h-9 w-24" />
            ) : hasSignedIn ? (
              <button type="button" onClick={openCompose} className="btn-primary">
                Compose
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/api/auth/gotosocial/register"
                  prefetch={false}
                  className="rounded-lg border border-degen-500/30 bg-degen-500/10 px-3 py-1.5 text-xs font-semibold text-degen-400 transition-all hover:bg-degen-500/20 hover:shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                >
                  Get @degenfeed.xyz
                </Link>
                <button type="button" onClick={openSignIn} className="btn-primary text-sm">
                  Connect Wallet
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {mobileOpen ? (
                <path
                  d="M15 5L5 15M5 5l10 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  <path d="M3 6h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path
                    d="M3 10h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M3 14h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div
            className="border-t"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-glass-bg)' }}
          >
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile primary">
              {NAV.map((item) => (
                <NavLink key={item.href} item={item} onClick={closeMobile} />
              ))}
              <StatusHealthDot />
            </nav>
            <div className="border-t p-4" style={{ borderColor: 'var(--color-border)' }}>
              {!ready ? (
                <div className="skeleton h-10 w-full" />
              ) : hasSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    openCompose();
                  }}
                  className="btn-primary w-full"
                >
                  Compose
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    openSignIn();
                  }}
                  className="btn-primary w-full"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        )}
        {/* Protocol sub-nav = hidden on mobile, visible in header */}
        <div
          className="hidden border-t md:block"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          <ProtocolSubNav />
        </div>
      </header>

      {/* Offline banner — shows when navigator.onLine is false */}
      <OfflineBanner />

      <main
        id="main"
        className="main-content relative z-10 flex-1 pt-16 md:pt-[108px] pb-20 lg:pb-0 animate-page-enter"
      >
        {/* Protocol sub-nav — visible on mobile only (desktop shows it in header) */}
        <div className="md:hidden">
          <ProtocolSubNav />
        </div>
        <OnboardingProvider>
          <ScreenReaderAnnouncerProvider>
            <div className="mx-auto flex max-w-7xl gap-6 px-4">
              <div className="min-w-0 flex-1">
                {children}
              </div>
              <aside className="hidden xl:block w-72 shrink-0 space-y-4 pt-2">
                <DailyChallenges />
                <ActivityTicker />
              </aside>
            </div>
            <OnboardingModal />
            <WelcomeBackModal />
          </ScreenReaderAnnouncerProvider>
        </OnboardingProvider>
      </main>

      <BottomNav />

      <footer
        className="shell-footer relative z-10 hidden border-t py-8 lg:block"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-glass-bg)' }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-degen-500">◆</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              DegenFeed
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--color-muted)' }}>
            <Link href="/feed" prefetch={true} className="transition-colors hover:text-[var(--color-fg)]">
              Feed
            </Link>
            <Link href="/shorts" prefetch={true} className="transition-colors hover:text-[var(--color-fg)]">
              Shorts
            </Link>
            <Link href="/c" prefetch={false} className="transition-colors hover:text-[var(--color-fg)]">
              Communities
            </Link>
            <Link href="/messages" prefetch={true} className="transition-colors hover:text-[var(--color-fg)]">
              Messages
            </Link>
            <Link href="/news" prefetch={true} className="transition-colors hover:text-[var(--color-fg)]">
              News
            </Link>
            <Link href="/docs" prefetch={false} className="transition-colors hover:text-[var(--color-fg)]">
              Docs
            </Link>
            <Link href="/developers" prefetch={false} className="transition-colors hover:text-[var(--color-fg)]">
              Developers
            </Link>
            <Link href="/premium" prefetch={false} className="transition-colors hover:text-[var(--color-fg)]">
              Premium
            </Link>
            <Link href="/creator" prefetch={false} className="transition-colors hover:text-[var(--color-fg)]">
              Creator Studio
            </Link>
            <Link href="/profile" prefetch={false} className="transition-colors hover:text-[var(--color-fg)]">
              Profile
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-muted)' }}>
            <Link href="/privacy" prefetch={false} className="transition-colors hover:text-[var(--color-fg)]">
              Privacy
            </Link>
            <Link href="/terms" prefetch={false} className="transition-colors hover:text-[var(--color-fg)]">
              Terms
            </Link>
            <Link
              href="/status"
              prefetch={false}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--color-fg)]"
              title="Protocol health"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-degen-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
              <span>Status</span>
            </Link>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            v{APP_VERSION} — © {new Date().getFullYear()} DegenFeed — a Rug Munch Media LLC product.
            No account required. Open source on{' '}
            <a
              href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-all hover:brightness-150"
              style={{ color: 'var(--color-muted)' }}
            >
              Forgejo
            </a>
            ,{' '}
            <a
              href="https://gitlab.com/cryptorugmuncher/degenfeed-web"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-all hover:brightness-150"
              style={{ color: 'var(--color-muted)' }}
            >
              GitLab
            </a>
            , and{' '}
            <a
              href="https://codeberg.org/cryptorugmunch/degenfeed-web"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-all hover:brightness-150"
              style={{ color: 'var(--color-muted)' }}
            >
              Codeberg
            </a>
            .
          </p>
        </div>
      </footer>

      <ScrollToTop />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcuts open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <InstallPrompt />
      <AddToHomeScreenToast />
    </div>
  );
});
