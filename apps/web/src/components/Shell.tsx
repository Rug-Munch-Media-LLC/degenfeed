'use client';

import { ScrollToTop } from '@degenfeed/ui';
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
import { OnboardingModal } from './OnboardingModal';
import { QuickJumpFloating } from './QuickJumpFloating';
import { RightSidebar } from './RightSidebar';
import { ScreenReaderAnnouncerProvider } from './ScreenReaderAnnouncer';
import { SearchOverlay } from './SearchOverlay';
import { SkipLinks } from './SkipLinks';
import { useToast } from './Toast';
import { WelcomeBackModal } from './WelcomeBackModal';

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

/* ─── Mobile top bar ───────────────────────────────────────── */

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
    // Check static overrides
    if (TITLE_OVERRIDES[pathname]) return TITLE_OVERRIDES[pathname];

    // Handle parameterized routes
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

    // Fallback: derive from last path segment
    const segment = pathname.split('/').filter(Boolean).pop() ?? 'DegenFeed';
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, [pathname]);
}

function MobileTopBar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const pathname = usePathname();
  const pageTitle = usePageTitle();
  const router = useRouter();

  // Show back button when not on top-level pages
  const showBack = !['/', '/feed', '/home/all', '/home', '/search'].includes(pathname) && !pathname.startsWith('/feed/');

  return (
    <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-4 py-2 lg:hidden" style={{ zIndex: 'var(--z-sticky, 10)' }}>
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
      <Link href="/feed" className="flex items-center gap-2 shrink-0" aria-label="DegenFeed Home">
        <Image src="/icon.svg" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
      </Link>
    </div>
  );
}

/* ─── Mobile slide-out drawer ──────────────────────────────── */

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef(0);

  // LeftSidebar handles auth internally

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Swipe right on the drawer to close
  const handleDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0]?.clientX ?? 0;
  }, []);

  const handleDrawerTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const dx = endX - swipeStartX.current;
      // Swiped right 60px+ to close
      if (dx > 60) {
        onClose();
      }
    },
    [onClose],
  );

  // Swipe right on backdrop to close
  const handleBackdropTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const startX = swipeStartX.current;
      const dx = endX - startX;
      if (dx > 60) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 lg:hidden animate-backdrop-in"
        onClick={onClose}
        onTouchStart={handleDrawerTouchStart}
        onTouchEnd={handleBackdropTouchEnd}
        aria-hidden="true"
        style={{ zIndex: 'var(--z-drawer-backdrop, 50)' }}
      />
      {/* Drawer */}
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

  // ── Swipe from left edge to open drawer on mobile ──
  // Only activates on top-level pages (feed/home) to avoid conflicting
  // with the back-navigation edge swipe on sub-pages.
  useEffect(() => {
    if (mobileDrawerOpen) return;
    // Only on top-level pages where back navigation isn't needed
    const isTopLevel = pathname === '/feed' || pathname === '/home/all' || pathname === '/home' || pathname === '/search' || pathname === '/';
    if (!isTopLevel) return;

    const handler = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0;
      edgeSwipeStartX.current = x <= 35 ? x : 0;
    };
    const endHandler = (e: TouchEvent) => {
      if (edgeSwipeStartX.current === 0) return;
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const dx = endX - edgeSwipeStartX.current;
      if (dx > 60) {
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
           DESKTOP: Three-column layout (skip sidebars on landing page)
      ══════════════════════════════════════════════════════════ */}
      <div className="mx-auto flex w-full max-w-[1280px] flex-1">
        {/* ── Left Sidebar (desktop, hide on landing page) ── */}
        {pathname !== '/' && (
          <div className="hidden lg:block sticky top-0 h-screen w-[275px] shrink-0 border-r border-[var(--color-glass-border)]">
            <LeftSidebar />
          </div>
        )}

        {/* ── Center: Main content ── */}
        <main
          id="main"
          aria-label="Main content"
          tabIndex={-1}
          className={`relative z-10 min-h-screen flex-1 animate-page-enter pb-16 lg:pb-0 ${pathname === '/' ? 'w-full max-w-none' : 'w-full min-w-0 border-r border-[var(--color-glass-border)]'}`}
        >
          {/* Page announcements for screen readers */}
          <div aria-live="polite" aria-atomic="true" className="sr-only" role="status" />
          {/* Mobile top bar */}
          <MobileTopBar onMenuToggle={() => setMobileDrawerOpen(true)} />

          {/* Mobile slide-out drawer */}
          <MobileDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} onSwipeRight={() => setMobileDrawerOpen(false)} />

          {/* Content */}
          <OnboardingProvider>
            <ScreenReaderAnnouncerProvider>
              {children}
              <OnboardingModal />
              <WelcomeBackModal />
            </ScreenReaderAnnouncerProvider>
          </OnboardingProvider>
        </main>

        {/* ── Right Sidebar (desktop, hide on landing page, feed, and protocol pages) ── */}
        {pathname !== '/' &&
          !pathname.startsWith('/feed') &&
          !['/farcaster', '/lens', '/bluesky', '/nostr', '/mastodon'].some(
            (p) => pathname === p || pathname.startsWith(`${p}/`),
          ) && (
            <div className="hidden xl:block w-[350px] shrink-0 overflow-y-auto px-6 py-4">
              <div className="sticky top-0 space-y-4">
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
