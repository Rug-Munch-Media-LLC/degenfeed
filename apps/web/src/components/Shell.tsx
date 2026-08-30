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
import { applyThemeClass } from '../lib/theme';
import { AddToHomeScreenToast } from './AddToHomeScreenToast';
import { BottomNav } from './BottomNav';
import { ProtocolNavSection } from './feed/ProtocolNavSection';
import { InstallPrompt } from './InstallPrompt';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { LeftSidebar } from './LeftSidebar';
import { OfflineBanner } from './OfflineBanner';
import { ProtocolConnectFlow } from './ProtocolConnectFlow';
import { ProtocolHealthBanner } from './ProtocolHealthBanner';
import { ProtocolQuickSwitcher } from './ProtocolQuickSwitcher';
import { QuickJumpFloating } from './QuickJumpFloating';
import { RightSidebar } from './RightSidebar';
import { ScreenReaderAnnouncerProvider } from './ScreenReaderAnnouncer';
import { SkipLinks } from './SkipLinks';
import { SearchOverlay } from './search/SearchOverlay';
import { useToast } from './Toast';

const OnboardingModal = dynamic(
  () => import('./OnboardingModal').then((m) => ({ default: m.OnboardingModal })),
  { ssr: false, loading: () => null },
);

const WelcomeBackModal = dynamic(
  () => import('./WelcomeBackModal').then((m) => ({ default: m.WelcomeBackModal })),
  { ssr: false, loading: () => null },
);

/* === Page title ============================================= */

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

/* === Mobile top bar ========================================= */

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
      className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-2 sm:px-4 py-2 lg:hidden"
      style={{ zIndex: 10 }}
    >
      <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-1 flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] shrink-0"
            style={{ minHeight: '44px', minWidth: '44px' }}
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
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] shrink-0"
            style={{ minHeight: '44px', minWidth: '44px' }}
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
        <span
          className="text-base font-bold ml-1 truncate max-w-[160px] sm:max-w-[240px]"
          style={{ color: 'var(--color-fg)' }}
        >
          {pageTitle}
        </span>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <button
          type="button"
          onClick={onSearchOpen}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="Search"
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <Link
          href="/feed"
          className="flex items-center shrink-0 ml-0.5"
          aria-label="Crypto Rug Muncher Home"
        >
          <Image
            src="/avatar.jpg"
            alt="Crypto Rug Muncher"
            width={75}
            height={75}
            className="h-7 w-auto rounded-full"
          />
        </Link>
      </div>
    </div>
  );
}

/* === Mobile drawer ========================================== */

function MobileDrawer({
  open,
  onClose,
  onQuickSwitcherOpen,
  onProtocolConnectOpen,
}: {
  open: boolean;
  onClose: () => void;
  onQuickSwitcherOpen?: () => void;
  onProtocolConnectOpen?: () => void;
}) {
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

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 lg:hidden animate-backdrop-in"
        onClick={onClose}
        onTouchStart={handleDrawerTouchStart}
        onTouchEnd={handleDrawerTouchEnd}
        aria-hidden="true"
        style={{ zIndex: 50 }}
      />
      <div
        ref={drawerRef}
        className="fixed inset-y-0 left-0 w-[280px] max-w-[80vw] border-r border-[var(--color-glass-border)] bg-[var(--color-bg)] shadow-2xl lg:hidden animate-slide-in-left"
        onTouchStart={handleDrawerTouchStart}
        onTouchEnd={handleDrawerTouchEnd}
        style={{ zIndex: 60 }}
      >
        <LeftSidebar
          onNavClick={onClose}
          onQuickSwitcherOpen={onQuickSwitcherOpen}
          onProtocolConnectOpen={onProtocolConnectOpen}
        />
      </div>
    </>
  );
}

/* === Shell main ============================================= */

export const Shell = memo(function Shell({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [protocolConnectOpen, setProtocolConnectOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [, setTheme] = useState<'dark' | 'light'>('dark');
  const { cycleLayout } = useFeedLayout();
  const { trackVisit } = useRecentVisited();
  const edgeSwipeStartX = useRef(0);

  // Sidebar collapse state — persist preference
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('df_sidebar_collapsed') === 'true';
    }
    return false;
  });

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('df_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Swipe from left edge to open drawer on mobile
  useEffect(() => {
    if (mobileDrawerOpen) return;
    const isTopLevel = ['/feed', '/home/all', '/home', '/search', '/'].includes(pathname);
    if (!isTopLevel) return;

    const handler = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0;
      edgeSwipeStartX.current = x <= 35 ? x : 0;
    };
    const endHandler = (e: TouchEvent) => {
      if (edgeSwipeStartX.current === 0) return;
      const endX = e.changedTouches[0]?.clientX ?? 0;
      if (endX - edgeSwipeStartX.current > 60) setMobileDrawerOpen(true);
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

  // Protocol transition flash
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    const PROTOCOL_ROUTES = ['/farcaster', '/lens', '/bluesky', '/nostr', '/mastodon'];
    const wasProtocol = PROTOCOL_ROUTES.find((r) => prev === r || prev.startsWith(`${r}/`));
    const nowProtocol = PROTOCOL_ROUTES.find((r) => pathname === r || pathname.startsWith(`${r}/`));
    if (wasProtocol && nowProtocol && wasProtocol !== nowProtocol) {
      const color =
        getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() ||
        '#8b5cf6';
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

  // Toast listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        kind?: 'info' | 'success' | 'error' | 'warning';
        message: string;
        duration?: number;
      };
      if (detail?.message) showToast(detail.kind || 'success', detail.message, detail.duration);
    };
    window.addEventListener('df-toast', handler);
    return () => window.removeEventListener('df-toast', handler);
  }, [showToast]);

  // Theme initialization
  useEffect(() => {
    const stored = localStorage.getItem('df_theme');
    const resolved = stored === 'light' ? 'light' : 'dark';
    setTheme(resolved);
    applyThemeClass(resolved);
    document.cookie = `df_theme=${resolved}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  }, []);

  // Global keyboard shortcuts — ⌘K opens quick switcher
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
          applyThemeClass(next);
          localStorage.setItem('df_theme', next);
          document.cookie = `df_theme=${next}; path=/; max-age=31536000; SameSite=Lax; Secure`;
          return next;
        });
        return;
      }
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
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

  const sidebarWidth = sidebarCollapsed ? 'w-[72px]' : 'w-[240px] xl:w-[275px]';

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}
    >
      <div className="aurora-bg" />
      <div className="noise-overlay" />

      <SkipLinks />
      <OfflineBanner />

      {/* Three-column layout — single left sidebar (no top navbar) */}
      <div className="container-safe flex flex-1 pt-0">
        {/* Left Sidebar (desktop + tablet collapsed) */}
        {pathname !== '/' && (
          <>
            {/* Tablet: always collapsed icon sidebar */}
            <div className="hidden md:block lg:hidden sticky top-0 h-[100dvh] w-[72px] shrink-0 overflow-y-auto scrollbar-none border-r border-[var(--color-glass-border)]">
              <LeftSidebar
                collapsed={true}
                onQuickSwitcherOpen={() => setQuickSwitcherOpen(true)}
                onProtocolConnectOpen={() => setProtocolConnectOpen(true)}
              />
            </div>
            {/* Desktop: configurable sidebar */}
            <div
              className={`hidden lg:block sticky top-0 h-[100dvh] shrink-0 overflow-y-auto scrollbar-none border-r border-[var(--color-glass-border)] transition-[width] duration-200 ease-in-out ${sidebarWidth}`}
            >
              <LeftSidebar
                collapsed={sidebarCollapsed}
                onCollapseToggle={() => setSidebarCollapsed((v) => !v)}
                onQuickSwitcherOpen={() => setQuickSwitcherOpen(true)}
                onProtocolConnectOpen={() => setProtocolConnectOpen(true)}
              />
              {/* ── Global protocol navigation (single left sidebar: shown on every route) ── */}
              {!sidebarCollapsed && pathname !== '/' && (
                <>
                  <div className="mx-3 h-px bg-[var(--color-glass-border)]" />
                  <ProtocolNavSection />
                </>
              )}
            </div>
          </>
        )}

        {/* Center: Main content */}
        <main
          id="main"
          aria-label="Main content"
          tabIndex={-1}
          className={`
            relative z-10 min-h-screen min-h-[100dvh] animate-page-enter
            ${pathname !== '/' && !isSelfLayoutPage ? 'pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] lg:pb-0' : ''}
            w-full min-w-0 border-r border-[var(--color-glass-border)]
            ${pathname === '/' ? 'max-w-none border-r-0' : isSelfLayoutPage ? 'flex-1' : 'max-w-[600px] flex-1'}
          `}
        >
          <div aria-live="polite" aria-atomic="true" className="sr-only" role="status" />
          <MobileTopBar
            onMenuToggle={() => setMobileDrawerOpen(true)}
            onSearchOpen={() => setSearchOpen(true)}
          />
          <MobileDrawer
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            onQuickSwitcherOpen={() => {
              setMobileDrawerOpen(false);
              setQuickSwitcherOpen(true);
            }}
            onProtocolConnectOpen={() => {
              setMobileDrawerOpen(false);
              setProtocolConnectOpen(true);
            }}
          />

          <ProtocolHealthBanner />
          <OnboardingProvider>
            <ScreenReaderAnnouncerProvider>
              {children}
              <OnboardingModal />
              <WelcomeBackModal />
            </ScreenReaderAnnouncerProvider>
          </OnboardingProvider>
        </main>

        {/* Right Sidebar (desktop) */}
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

      {/* Floating overlays */}
      <QuickJumpFloating />
      <ScrollToTop />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ProtocolQuickSwitcher open={quickSwitcherOpen} onClose={() => setQuickSwitcherOpen(false)} />
      <ProtocolConnectFlow
        open={protocolConnectOpen}
        protocolId={null}
        onClose={() => setProtocolConnectOpen(false)}
      />
      <KeyboardShortcuts open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <InstallPrompt />
      <AddToHomeScreenToast />
    </div>
  );
});
