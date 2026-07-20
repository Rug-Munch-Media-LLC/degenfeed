'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from './AuthProvider';

interface NavItem {
  href: string;
  label: string;
  icon: 'home' | 'search' | 'trending' | 'notifs' | 'messages';
  requiresAuth?: boolean;
}

/* ─── SVG Icon Components ──────────────────────────────────── */

function NavIcon({ type, active }: { type: NavItem['icon']; active: boolean }) {
  const sw = active ? 2.5 : 1.5;
  switch (type) {
    case 'home':
      return active ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.49a1 1 0 01.386-.79l8-6.222a1 1 0 011.228 0l8 6.222a1 1 0 01.386.79V20z" />
        </svg>
      ) : (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.49a1 1 0 01.386-.79l8-6.222a1 1 0 011.228 0l8 6.222a1 1 0 01.386.79V20z" />
        </svg>
      );
    case 'search':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'trending':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case 'notifs':
      return active ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11.996 2c-4.062 0-7 2.692-7 6v3.089c0 1.036-.633 1.965-1.516 2.355C2.685 13.997 2 14.996 2 16.05v.698c0 .832.538 1.252 1.184 1.252h17.632c.646 0 1.184-.42 1.184-1.252v-.699c0-1.052-.685-2.052-1.48-2.506-.883-.39-1.516-1.319-1.516-2.355V8c0-3.308-2.938-6-7.004-6z" />
          <path
            d="M15 19a3 3 0 11-6 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      );
    case 'messages':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
  }
}

/* ─── Compose FAB Icon ─────────────────────────────────────── */

function ComposeFABIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/* ─── Nav config ───────────────────────────────────────────── */

const AUTH_NAV: NavItem[] = [
  { href: '/home/all', label: 'Feed', icon: 'home' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/live-shorts', label: 'Live', icon: 'trending' },
  { href: '/live', label: 'Streams', icon: 'trending' },
  { href: '/trending', label: 'Trending', icon: 'trending' },
  { href: '/notifications', label: 'Notifs', icon: 'notifs', requiresAuth: true },
  { href: '/messages', label: 'Messages', icon: 'messages', requiresAuth: true },
];

const GUEST_NAV: NavItem[] = [
  { href: '/home/all', label: 'Feed', icon: 'home' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/live-shorts', label: 'Live', icon: 'trending' },
  { href: '/live', label: 'Streams', icon: 'trending' },
  { href: '/trending', label: 'Trending', icon: 'trending' },
  { href: '/notifications', label: 'Notifs', icon: 'notifs' },
];

/* ─── Local storage key for first visit hint ───────────────── */

const FIRST_VISIT_KEY = 'df_bottomnav_first_visit';

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const { ready, signedInProtocols, openCompose, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const signedIn = ready && hasSignedIn;
  const { unreadCount: notifCount } = useNotifications(hasSignedIn);
  const [dmCount, setDmCount] = useState(0);
  const [showFabHint, setShowFabHint] = useState(false);
  const dmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fabHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll DM unread count
  useEffect(() => {
    if (!hasSignedIn) return;
    const pollDm = async () => {
      try {
        const res = await fetch('/api/messages/conversations', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { conversations?: Array<{ unreadCount?: number }> };
        const total = (data.conversations ?? []).reduce((s, c) => s + (c.unreadCount ?? 0), 0);
        setDmCount(total);
      } catch {
        /* ignore */
      }
    };
    pollDm();
    dmIntervalRef.current = setInterval(pollDm, 60000);
    return () => {
      if (dmIntervalRef.current) clearInterval(dmIntervalRef.current);
    };
  }, [hasSignedIn]);

  // Show pulsing hint on first visit (dismisses after 5s or on interaction)
  useEffect(() => {
    try {
      const seen = localStorage.getItem(FIRST_VISIT_KEY);
      if (!seen && signedIn) {
        setShowFabHint(true);
        fabHintTimerRef.current = setTimeout(() => {
          setShowFabHint(false);
          localStorage.setItem(FIRST_VISIT_KEY, 'true');
        }, 5000);
      }
    } catch {
      /* localStorage unavailable */
    }
    return () => {
      if (fabHintTimerRef.current) clearTimeout(fabHintTimerRef.current);
    };
  }, [signedIn]);

  const dismissFabHint = () => {
    setShowFabHint(false);
    try {
      localStorage.setItem(FIRST_VISIT_KEY, 'true');
    } catch {}
    if (fabHintTimerRef.current) clearTimeout(fabHintTimerRef.current);
  };

  const handleCompose = () => {
    dismissFabHint();
    if (signedIn) {
      openCompose();
    } else {
      openSignIn();
    }
  };

  const items = signedIn ? AUTH_NAV : GUEST_NAV;

  return (
    <>
      {/* Post FAB — floating above bottom nav */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 pointer-events-none lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* FAB */}
        <div className="relative mx-auto max-w-lg px-4">
          <button
            type="button"
            onClick={handleCompose}
            className={`pointer-events-auto absolute bottom-20 right-4 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-degen-500 text-black shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] active:scale-95 ${
              showFabHint ? 'animate-compose-pulse' : ''
            }`}
            aria-label={signedIn ? 'Create new post' : 'Sign in to post'}
            title={signedIn ? 'New post' : 'Sign in'}
          >
            <ComposeFABIcon />
          </button>
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav
        aria-label="Mobile"
        className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="flex items-center justify-around px-2">
          {items.map((item) => {
            const isHome = item.href === '/home/all';
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              (isHome && (pathname === '/feed' || pathname === '/home' || pathname === '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors h-full flex-1 max-w-[80px] focus-visible:outline-2 focus-visible:outline-degen-500 focus-visible:outline-offset-[-2px] ${
                  active
                    ? 'text-degen-400'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
                aria-current={active ? 'page' : undefined}
                title={item.requiresAuth && !signedIn ? 'Sign in to access' : item.label}
              >
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    active ? 'bg-degen-500/15 shadow-[0_0_12px_rgba(0,255,65,0.1)]' : ''
                  }`}
                >
                  {!signedIn && item.requiresAuth ? (
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
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  ) : (
                    <NavIcon type={item.icon} active={active} />
                  )}
                </span>
                {signedIn && dmCount > 0 && item.href === '/messages' && (
                  <span
                    role="status"
                    className="absolute -top-0.5 right-1/2 translate-x-[14px] bg-degen-500 text-black text-[10px] font-bold rounded-full min-w-[1rem] h-4 flex items-center justify-center px-[3px] leading-none shadow-sm"
                    aria-label={`${dmCount} unread messages`}
                  >
                    {dmCount > 9 ? '9+' : dmCount}
                  </span>
                )}
                {signedIn && notifCount > 0 && item.href === '/notifications' && (
                  <span
                    role="status"
                    className="absolute -top-0.5 right-1/2 translate-x-[14px] bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[1rem] h-4 flex items-center justify-center px-[3px] leading-none shadow-sm"
                    aria-label={`${notifCount} unread notifications`}
                  >
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
                <span className="leading-tight truncate max-w-[3rem] text-[9px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
