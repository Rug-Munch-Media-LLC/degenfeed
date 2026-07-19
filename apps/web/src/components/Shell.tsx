'use client';

import { ScrollToTop } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFeedLayout } from '../hooks/useFeedLayout';
import { OnboardingProvider } from '../hooks/useOnboarding';
import { useRecentVisited } from '../hooks/useRecentVisited';
import { AddToHomeScreenToast } from './AddToHomeScreenToast';
import { BottomNav } from './BottomNav';
import { InstallPrompt } from './InstallPrompt';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { LeftSidebar } from './LeftSidebar';
import { OfflineBanner } from './OfflineBanner';
import { QuickJumpFloating } from './QuickJumpFloating';
import { RightSidebar } from './RightSidebar';
import { ScreenReaderAnnouncerProvider } from './ScreenReaderAnnouncer';
import { SearchOverlay } from './SearchOverlay';
import { SkipLinks } from './SkipLinks';
import { useToast } from './Toast';

const OnboardingModal = dynamic(
  () => import('./OnboardingModal').then((m) => ({ default: m.OnboardingModal })),
  { ssr: false, loading: () => null },
);

const WelcomeBackModal = dynamic(
  () => import('./WelcomeBackModal').then((m) => ({ default: m.WelcomeBackModal })),
  { ssr: false, loading: () => null },
);

const _APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';

/* ─── Logo ─────────────────────────────────────────────────── */

function _Logo() {
  return (
    <Link href="/feed" className="flex items-center gap-2 group" aria-label="DegenFeed Home">
      <Image
        src="/icon.svg"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 rounded-lg logo-glow transition-shadow group-hover:shadow-[0_0_20px_rgba(34,197,94,0.6)]"
      />
      <span
        className="text-lg font-bold tracking-tight hidden sm:inline"
        style={{ color: 'var(--color-fg)' }}
      >
        DegenFeed
      </span>
    </Link>
  );
}

/* ─── Page title ───────────────────────────────────────────── */

const TITLE_OVERRIDES: Record<string, string> = {
  '/feed': 'Home',
  '/home/all': 'Home',
  '/home': 'Home',
  '/search': 'Search',
  '/notifications': 'Notifications',
  '/messages': 'Messages',
  '/trending': 'Trending',
  '/shorts': 'Shorts',
  '/news': 'News',
  '/discover': 'Discover',
  '/spaces': 'Spaces',
  '/leaderboard': 'Leaderboard',
  '/settings': 'Settings',
  '/premium': 'Premium',
  '/digest': 'Digest',
  '/bookmarks': 'Bookmarks',
  '/c': 'Communities',
  '/creator': 'Creator Studio',
  '/docs': 'Docs',
  '/faq': 'FAQ',
  '/status': 'Status',
  '/deploy': 'Launch',
  '/about': 'About',
};

function usePageTitle() {
  const pathname = usePathname();
  return useMemo(() => {
    if (TITLE_OVERRIDES[pathname]) return TITLE_OVERRIDES[pathname];
    if (pathname.startsWith('/post/')) return 'Post';
    if (pathname.startsWith('/profile/')) return 'Profile';
    if (pathname.startsWith('/token/')) return 'Token';
    if (pathname.startsWith('/topic/')) return 'Topic';
    if (pathname.startsWith('/c/')) return 'Community';
    if (pathname.startsWith('/digest/')) return 'Digest';
    if (pathname.startsWith('/feed/')) return 'Feed';
    if (pathname.startsWith('/feeds/')) return 'Feed';
    if (pathname.startsWith('/news/')) return 'News';
    if (pathname.startsWith('/settings/')) return 'Settings';
    const segment = pathname.split('/').filter(Boolean).pop() ?? 'DegenFeed';
    return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }, [pathname]);
}

/* ─── Desktop Header (scroll-aware) ───────────────────────── */

function DesktopHeader({
  onSearchOpen,
  className,
}: {
  onSearchOpen: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mx-auto flex max-w-[1260px] items-center justify-between px-4 h-14">
        {/* Left: Logo */}
        <Link href="/feed" className="flex items-center gap-2 shrink-0" aria-label="DegenFeed Home">
          <Image
            src="/icon.svg"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-lg logo-glow"
          />
          <span
            className="text-base font-bold tracking-tight hidden sm:inline"
            style={{ color: 'var(--color-fg)' }}
          >
            DegenFeed
          </span>
        </Link>

        {/* Center: Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <button
            type="button"
            onClick={onSearchOpen}
            className="flex w-full items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-[var(--color-fg)]"
            aria-label="Open search"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="flex-1 text-left">Search DegenFeed</span>
            <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none text-[var(--color-muted)]">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle placeholder */}
          <Link
            href="/notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Notifications"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </Link>
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Mobile top bar ───────────────────────────────────────── */

function MobileTopBar({
  onMenuToggle,
  onSearchOpen,
}: {
  onMenuToggle: () => void;
  onSearchOpen: () => void;
}) {
  const pathname = usePathname();
  const pageTitle = usePageTitle();
  const router = useRouter();

  const showBack =
    !['/', '/feed', '/home/all', '/home', '/search'].includes(pathname) &&
    !pathname.startsWith('/feed/');

  return (
    <div
      className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-4 py-2 lg:hidden"
      style={{ zIndex: 'var(--z-sticky, 10)' }}
    >
      <div className="flex items-center gap-1">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Go back"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onMenuToggle}
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Open navigation menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        )}
        <span className="text-base font-bold ml-1" style={{ color: 'var(--color-fg)' }}>
          {pageTitle}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSearchOpen}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          aria-label="Search"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <Link href="/feed" className="flex items-center shrink-0" aria-label="DegenFeed Home">
          <Image src="/icon.svg" alt="" width={26} height={26} className="h-6 w-6 rounded-lg" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Mobile slide-out drawer ──────────────────────────────── */

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef(0);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0]?.clientX ?? 0;
  }, []);

  const handleDrawerTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const dx = endX - swipeStartX.current;
      if (dx > 60) onClose();
    },
    [onClose],
  );

  const handleBackdropTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const startX = swipeStartX.current;
      if (endX - startX > 60) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 lg:hidden animate-backdrop-in"
        onClick={onClose}
        onTouchStart={handleDrawerTouchStart}
        onTouchEnd={handleBackdropTouchEnd}
        aria-hidden="true"
        style={{ zIndex: 'var(--z-drawer-backdrop, 50)' }}
      />
      <div
        ref={drawerRef}
        className="fixed inset-y-0 left-0 w-[280px] max-w-[80vw] border-r border-[var(--color-glass-border)] bg-[var(--color-bg)] shadow-2xl lg:hidden animate-slide-in-left"
        onTouchStart={handleDrawerTouchStart}
        onTouchEnd={handleDrawerTouchEnd}
        style={{ zIndex: 'var(--z-drawer, 60)' }}
      >
        <LeftSidebar onNavClick={onClose} />
      </div>
    </>
  );
}

/* ─── Shell main component ─────────────────────────────────── */

export const Shell = memo(function Shell({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [, setTheme] = useState<'dark' | 'light'>('dark');
  const { cycleLayout } = useFeedLayout();
  const { trackVisit } = useRecentVisited();
  const edgeSwipeStartX = useRef(0);

  // ── Sidebar collapse state ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Scroll-aware header visibility ──
  const [showDesktopHeader, setShowDesktopHeader] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 50) {
        setShowDesktopHeader(true);
      } else if (currentY < lastScrollY.current) {
        // Scrolling up
        setShowDesktopHeader(true);
      } else {
        // Scrolling down
        setShowDesktopHeader(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Swipe from left edge to open drawer on mobile ──
  useEffect(() => {
    if (mobileDrawerOpen) return;
    const isTopLevel =
      pathname === '/feed' ||
      pathname === '/home/all' ||
      pathname === '/home' ||
      pathname === '/search' ||
      pathname === '/';
    if (!isTopLevel) return;

    const handler = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0;
      edgeSwipeStartX.current = x <= 35 ? x : 0;
    };
    const endHandler = (e: TouchEvent) => {
      if (edgeSwipeStartX.current === 0) return;
      const endX = e.changedTouches[0]?.clientX ?? 0;
      if (endX - edgeSwipeStartX.current > 60) {
        setMobileDrawerOpen(true);
      }
      edgeSwipeStartX.current = 0;
    };
    window.addEventListener('touchstart', handler, { passive: true });
    window.addEventListener('touchend', endHandler, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('touchend', endHandler);
    };
  }, [mobileDrawerOpen, pathname]);

  // Pages that manage their own internal 3-column layout
  const isSelfLayoutPage =
    pathname.startsWith('/feed') ||
    pathname.startsWith('/feeds/') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/spaces') ||
    pathname.startsWith('/c/') ||
    pathname.startsWith('/post/') ||
    pathname.startsWith('/home/') ||
    pathname.startsWith('/activity/') ||
    pathname.startsWith('/token/') ||
    pathname.startsWith('/topics/') ||
    pathname.startsWith('/digest/');

  // ── Protocol transition flash ──
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    const PROTOCOL_ROUTES = ['/farcaster', '/lens', '/bluesky', '/nostr', '/mastodon'];
    const wasProtocol = PROTOCOL_ROUTES.find((r) => prev === r || prev.startsWith(`${r}/`));
    const nowProtocol = PROTOCOL_ROUTES.find((r) => pathname === r || pathname.startsWith(`${r}/`));
    if (wasProtocol && nowProtocol && wasProtocol !== nowProtocol) {
      const color =
        getComputedStyle(document.documentElement).getPropertyValue('--protocol-accent').trim() ||
        '#00ff41';
      const overlay = document.createElement('div');
      overlay.className = 'protocol-transition-overlay';
      overlay.style.backgroundColor = color;
      overlay.style.opacity = '0.25';
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 700);
    }
  }, [pathname]);

  // Track visited pages
  useEffect(() => {
    if (!pathname || pathname === '/') return;
    const label = pathname
      .split('/')
      .filter(Boolean)
      .map((s) => decodeURIComponent(s).replace(/[-_]/g, ' '))
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' > ');
    trackVisit(pathname, label || 'Home');
  }, [pathname, trackVisit]);

  // Listen for custom df-toast events
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

  // Theme initialization
  useEffect(() => {
    const stored = localStorage.getItem('df_theme');
    const resolved = stored === 'light' ? 'light' : 'dark';
    setTheme(resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    // biome-ignore lint/suspicious/noDocumentCookie: intentional theme persistence via cookie for SSR parity
    document.cookie = `df_theme=${resolved}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'L' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        cycleLayout();
        return;
      }
      if (e.key === 'D' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        setTheme((prev) => {
          const next = prev === 'dark' ? 'light' : 'dark';
          document.documentElement.classList.toggle('dark', next === 'dark');
          localStorage.setItem('df_theme', next);
          // biome-ignore lint/suspicious/noDocumentCookie: intentional theme persistence via cookie for SSR parity
          document.cookie = `df_theme=${next}; path=/; max-age=31536000; SameSite=Lax; Secure`;
          return next;
        });
        return;
      }
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable
        )
          return;
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === 'Escape') setShowShortcuts(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleLayout]);

  // Left sidebar width: 275px expanded, 72px collapsed
  const sidebarWidth = sidebarCollapsed ? 'w-[72px]' : 'w-[275px]';

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}
    >
      <div className="aurora-bg" />
      <div className="noise-overlay" />

      <SkipLinks />

      {/* Offline banner */}
      <OfflineBanner />

      {/* ══════════════════════════════════════════════════════════
           DESKTOP: Scroll-aware header
      ══════════════════════════════════════════════════════════ */}
      <div
        className={`hidden lg:block fixed top-0 inset-x-0 z-30 border-b border-[var(--color-glass-border)] backdrop-blur-xl transition-transform duration-300 ${
          showDesktopHeader ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{
          backgroundColor: 'var(--color-glass-bg)',
        }}
      >
        <DesktopHeader onSearchOpen={() => setSearchOpen(true)} />
      </div>

      {/* ══════════════════════════════════════════════════════════
           DESKTOP: Three-column layout
      ══════════════════════════════════════════════════════════ */}
      <div className="mx-auto flex w-full max-w-[1260px] flex-1 pt-0 lg:pt-14">
        {/* ── Left Sidebar (desktop, hide on landing page) ── */}
        {pathname !== '/' && (
          <div
            className={`hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto border-r border-[var(--color-glass-border)] transition-[width] duration-200 ease-in-out ${sidebarWidth}`}
          >
            <LeftSidebar
              collapsed={sidebarCollapsed}
              onCollapseToggle={() => setSidebarCollapsed((v) => !v)}
            />
          </div>
        )}

        {/* ── Center: Main content ── */}
        <main
          id="main"
          aria-label="Main content"
          tabIndex={-1}
          className={`
            relative z-10 min-h-screen animate-page-enter
            ${pathname !== '/' && !isSelfLayoutPage ? 'pb-16 lg:pb-0' : ''}
            w-full min-w-0 border-r border-[var(--color-glass-border)]
            ${
              pathname === '/'
                ? 'max-w-none border-r-0'
                : isSelfLayoutPage
                  ? 'flex-1'
                  : 'max-w-[600px] flex-1'
            }
          `}
        >
          <div aria-live="polite" aria-atomic="true" className="sr-only" role="status" />
          <MobileTopBar
            onMenuToggle={() => setMobileDrawerOpen(true)}
            onSearchOpen={() => setSearchOpen(true)}
          />
          <MobileDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} />

          <OnboardingProvider>
            <ScreenReaderAnnouncerProvider>
              {children}
              <OnboardingModal />
              <WelcomeBackModal />
            </ScreenReaderAnnouncerProvider>
          </OnboardingProvider>
        </main>

        {/* ── Right Sidebar (desktop) ── */}
        {pathname !== '/' &&
          !isSelfLayoutPage &&
          !['/farcaster', '/lens', '/bluesky', '/nostr', '/mastodon'].some(
            (p) => pathname === p || pathname.startsWith(`${p}/`),
          ) && (
            <div className="hidden xl:block w-[350px] shrink-0 overflow-y-auto px-6 py-4">
              <div className="sticky top-20 space-y-4">
                <RightSidebar />
              </div>
            </div>
          )}
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* ── Floating overlays ── */}
      <QuickJumpFloating />
      <ScrollToTop />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcuts open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <InstallPrompt />
      <AddToHomeScreenToast />
    </div>
  );
});
