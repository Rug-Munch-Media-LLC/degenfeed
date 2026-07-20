'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';

interface NavItem {
  href: string;
  label: string;
  icon: 'home' | 'trending' | 'discover' | 'spaces' | 'profile';
  requiresAuth?: boolean;
}

/* === SVG Icon Components ==================================== */

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
    case 'discover':
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
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 'spaces':
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
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    case 'profile':
      return active ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 12c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm0 2c-4.418 0-8 2.686-8 6v2h16v-2c0-3.314-3.582-6-8-6z" />
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
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 00-16 0" />
        </svg>
      );
  }
}

/* === Compose FAB Icon ======================================= */

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

/* === Nav config ============================================= */

const AUTH_NAV: NavItem[] = [
  { href: '/feed', label: 'Home', icon: 'home' },
  { href: '/trending', label: 'Trending', icon: 'trending' },
  { href: '/discover', label: 'Discover', icon: 'discover' },
  { href: '/spaces', label: 'Spaces', icon: 'spaces' },
  { href: '/profile', label: 'Profile', icon: 'profile', requiresAuth: true },
];

const GUEST_NAV: NavItem[] = [
  { href: '/feed', label: 'Home', icon: 'home' },
  { href: '/trending', label: 'Trending', icon: 'trending' },
  { href: '/discover', label: 'Discover', icon: 'discover' },
  { href: '/spaces', label: 'Spaces', icon: 'spaces' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
];

/* === Local storage key for first visit hint ================= */

const FIRST_VISIT_KEY = 'df_bottomnav_first_visit';

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const { ready, signedInProtocols, openCompose, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const signedIn = ready && hasSignedIn;
  const [showFabHint, setShowFabHint] = useState(false);
  const fabHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            const isHome = item.href === '/feed';
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

                <span className="leading-tight truncate max-w-[3rem] text-[9px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
