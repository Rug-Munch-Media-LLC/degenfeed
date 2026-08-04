'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from './AuthProvider';
import { CreateBottomSheet } from './create/CreateBottomSheet';

interface NavItem {
  href: string;
  label: string;
  icon: 'home' | 'search' | 'compose' | 'notifications' | 'profile';
  requiresAuth?: boolean;
}

/* === SVG Icon Components ==================================== */

function NavIcon({ type, active }: { type: NavItem['icon']; active: boolean }) {
  const sw = active ? 2.5 : 1.5;
  switch (type) {
    case 'home':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {active ? (
            <path d="M21 20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.49a1 1 0 01.386-.79l8-6.222a1 1 0 011.228 0l8 6.222a1 1 0 01.386.79V20z" />
          ) : (
            <>
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </>
          )}
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
    case 'compose':
      return (
        <svg
          width="24"
          height="24"
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
    case 'notifications':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          {active && <path d="M13.73 21a2 2 0 01-3.46 0" />}
        </svg>
      );
    case 'profile':
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {active ? (
            <path d="M12 12c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm0 2c-4.418 0-8 2.686-8 6v2h16v-2c0-3.314-3.582-6-8-6z" />
          ) : (
            <>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </>
          )}
        </svg>
      );
  }
}

/* === Nav config ============================================= */

const NAV_ITEMS: NavItem[] = [
  { href: '/feed', label: 'Home', icon: 'home' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/compose', label: 'Post', icon: 'compose', requiresAuth: true },
  { href: '/notifications', label: 'Alerts', icon: 'notifications' },
  { href: '/profile', label: 'Profile', icon: 'profile', requiresAuth: true },
];

function isActiveMatch(pathname: string, item: NavItem): boolean {
  if (item.href === '/feed') {
    return (
      pathname === '/feed' ||
      pathname === '/' ||
      pathname === '/home' ||
      pathname === '/home/all' ||
      pathname.startsWith('/feed/')
    );
  }
  if (item.href === '/search') {
    return pathname === '/search';
  }
  if (item.href === '/notifications') {
    return pathname === '/notifications' || pathname.startsWith('/notifications/');
  }
  if (item.href === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/');
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * BottomNav — Fixed bottom navigation bar for mobile.
 *
 * Features:
 * - 5 tabs: Home, Search, Compose (+), Notifications (badge), Profile
 * - Active indicator with accent color and glow
 * - Unread notification badge from useNotifications hook
 * - Smooth slide-up entrance animation
 * - Safe area insets for notched phones
 * - All touch targets ≥ 44px
 * - Blur backdrop
 * - Keyboard accessible
 */
export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const signedIn = ready && hasSignedIn;
  const { unreadCount } = useNotifications(signedIn);
  const [mounted, setMounted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const prevActiveRef = useRef<string>('/feed');

  // Mount animation: slide in from bottom after route mount
  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleCompose = useCallback(() => {
    if (signedIn) {
      // The center "+" opens the unified Create sheet (TikTok-style).
      setCreateOpen(true);
    } else {
      openSignIn();
    }
  }, [signedIn, openSignIn]);

  // Hide bottom nav on landing page
  if (pathname === '/') return null;

  return (
    <nav
      aria-label="Mobile navigation"
      className={`
        fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav,45)]
        border-t backdrop-blur-2xl
        transition-transform duration-300 ease-out
        lg:hidden
        ${mounted ? 'translate-y-0' : 'translate-y-full'}
      `}
      style={{
        borderColor: 'var(--color-glass-border)',
        backgroundColor: 'var(--color-glass-bg)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitBackdropFilter: 'blur(24px)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {NAV_ITEMS.map((item) => {
          const active = isActiveMatch(pathname, item);
          // Track for transition animations
          if (active) prevActiveRef.current = item.href;

          // Compose is a special action button
          if (item.href === '/compose') {
            return (
              <button
                key={item.href}
                type="button"
                onClick={handleCompose}
                className="relative flex flex-1 max-w-[72px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors duration-150 text-[var(--color-muted)] hover:text-[var(--color-fg)] active:scale-95"
                style={{ minHeight: '44px', minWidth: '44px' }}
                aria-label={signedIn ? 'Create new post' : 'Sign in to post'}
              >
                <span
                  className="relative flex items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow-lg shadow-[var(--color-accent-glow-strong)] transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  <NavIcon type="compose" active={false} />
                </span>
                <span className="leading-tight truncate max-w-[3rem] text-[9px]">Post</span>
              </button>
            );
          }

          const needsAuth = item.requiresAuth && !signedIn;
          const href = needsAuth ? '#' : item.href;
          const label = needsAuth ? 'Sign in to access' : item.label;

          return (
            <Link
              key={item.href}
              href={href}
              prefetch
              onClick={(e) => {
                if (needsAuth) {
                  e.preventDefault();
                  openSignIn();
                }
              }}
              className={`
                relative flex flex-1 max-w-[72px] flex-col items-center justify-center gap-0.5 px-1 py-1.5
                text-[10px] font-medium transition-all duration-150
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]
                active:scale-95
                ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}
              `}
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-current={active ? 'page' : undefined}
              title={label}
              aria-label={label}
            >
              <span
                className={`
                  relative flex h-10 w-10 items-center justify-center rounded-xl
                  transition-all duration-200
                  ${active ? 'bg-[var(--color-accent-soft)] shadow-[0_0_12px_var(--color-accent-glow)]' : ''}
                `}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                {needsAuth ? (
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
                {/* Unread badge for notifications */}
                {item.href === '/notifications' && unreadCount > 0 && (
                  <span
                    role="status"
                    className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-degen-500 px-1 text-[9px] font-bold leading-tight text-black"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="leading-tight truncate max-w-[3rem] text-[9px]">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Unified Create sheet (TikTok-style "+") */}
      <CreateBottomSheet isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </nav>
  );
}
