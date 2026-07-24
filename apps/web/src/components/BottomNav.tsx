'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '../hooks/useNotifications';
import { useProtocolConnections } from '../hooks/useProtocolConnections';
import { useAuth } from './AuthProvider';

interface NavItem {
  href: string;
  label: string;
  icon: 'feed' | 'search' | 'compose' | 'notifications' | 'profile';
  requiresAuth?: boolean;
}

/* === SVG Icon Components ==================================== */

function NavIcon({ type, active }: { type: NavItem['icon']; active: boolean }) {
  const sw = active ? 2.5 : 1.5;
  switch (type) {
    case 'feed':
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

/* === Nav config ============================================= */

const NAV_ITEMS: NavItem[] = [
  { href: '/feed', label: 'Feed', icon: 'feed' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/compose', label: 'Post', icon: 'compose', requiresAuth: true },
  { href: '/notifications', label: 'Alerts', icon: 'notifications' },
  { href: '/profile', label: 'Profile', icon: 'profile', requiresAuth: true },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const { ready, signedInProtocols, openCompose, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const signedIn = ready && hasSignedIn;
  const { unreadCount } = useNotifications(signedIn);

  // Hide bottom nav on landing page
  if (pathname === '/') return null;

  const handleCompose = () => {
    if (signedIn) {
      openCompose();
    } else {
      openSignIn();
    }
  };

  return (
    <nav
      aria-label="Mobile"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ backgroundColor: 'var(--color-glass-bg)' }}
    >
      <div className="flex items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isFeed = item.href === '/feed';
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (isFeed && (pathname === '/feed' || pathname === '/home' || pathname === '/home/all'));

          // Compose is a special action button
          if (item.href === '/compose') {
            return (
              <button
                key={item.href}
                type="button"
                onClick={handleCompose}
                className="relative flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors h-full flex-1 max-w-[80px] focus-visible:outline-2 focus-visible:outline-degen-500 focus-visible:outline-offset-[-2px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                aria-label={signedIn ? 'Create new post' : 'Sign in to post'}
              >
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-degen-500 text-black shadow-lg transition-all hover:scale-105 active:scale-95">
                  <NavIcon type="compose" active={false} />
                </span>
                <span className="leading-tight truncate max-w-[3rem] text-[9px]">Post</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={!signedIn && item.requiresAuth ? '/feed' : item.href}
              prefetch
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors h-full flex-1 max-w-[80px] focus-visible:outline-2 focus-visible:outline-degen-500 focus-visible:outline-offset-[-2px] ${
                active ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
              aria-current={active ? 'page' : undefined}
              title={item.requiresAuth && !signedIn ? 'Sign in to access' : item.label}
            >
              <span
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                  active ? 'bg-degen-500/15 shadow-[0_0_12px_rgba(0,255,65,0.1)]' : ''
                }`}
                style={{ minHeight: '44px', minWidth: '44px' }}
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

                {/* Unread badge on notifications */}
                {item.href === '/notifications' && unreadCount > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-degen-500 px-1 text-[8px] font-bold text-black"
                    style={{ lineHeight: 1 }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="leading-tight truncate max-w-[3rem] text-[9px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
