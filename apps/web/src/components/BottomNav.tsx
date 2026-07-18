'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from './AuthProvider';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  priority: boolean;
  requiresAuth?: boolean;
}

const _PRIORITY = new Set([
  '/home/all',
  '/search',
  '/shorts',
  '/trending',
  '/feed',
  '/notifications',
  '/messages',
]);

/**
 * Simple feather-style SVG icons for bottom nav.
 * Using inline SVGs avoids emoji rendering inconsistencies across platforms.
 */
const ICONS: Record<string, string> = {
  '🏠': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  '📱': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  '📋': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  '🔍': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  '🏆': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5 4 6 3 7 2v4"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C19 4 18 3 17 2v4"/><path d="M6 9v4a6 6 0 0 0 12 0V9"/><path d="M8 22h8"/><path d="M12 16v6"/></svg>',
  '🌐': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  '🔊': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  '🔥': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  '📰': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
  '💬': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  '🔔': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  '🔒': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
};

// Twitter-style bottom nav: max 5 items, Home + Search + Compose/SignIn + Notifications + Messages
const AUTH_NAV: NavItem[] = [
  { href: '/home/all', label: 'Feed', icon: '🏠', priority: true },
  { href: '/search', label: 'Search', icon: '🔍', priority: true },
  { href: '/trending', label: 'Trending', icon: '🔥', priority: true },
  { href: '/notifications', label: 'Notifs', icon: '🔔', priority: true, requiresAuth: true },
  { href: '/messages', label: 'Messages', icon: '💬', priority: true, requiresAuth: true },
];

const GUEST_NAV: NavItem[] = [
  { href: '/home/all', label: 'Feed', icon: '🏠', priority: true },
  { href: '/search', label: 'Search', icon: '🔍', priority: true },
  { href: '/trending', label: 'Trending', icon: '🔥', priority: true },
  { href: '/notifications', label: 'Notifs', icon: '🔔', priority: true },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const { unreadCount: notifCount } = useNotifications(hasSignedIn);
  const [dmCount, setDmCount] = useState(0);
  const dmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll DM unread count separately (no useDmCount hook exists yet)
  useEffect(() => {
    if (!hasSignedIn) return;
    const pollDm = async () => {
      try {
        const res = await fetch('/api/messages/conversations', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          conversations?: Array<{ unreadCount?: number }>;
        };
        const total = (data.conversations ?? []).reduce((s, c) => s + (c.unreadCount ?? 0), 0);
        setDmCount(total);
      } catch {}
    };
    pollDm();
    dmIntervalRef.current = setInterval(pollDm, 60000);
    return () => {
      if (dmIntervalRef.current) clearInterval(dmIntervalRef.current);
    };
  }, [hasSignedIn]);

  // Determine signed-in state
  const signedIn = ready && hasSignedIn;

  return (
    <nav
      aria-label="Mobile"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-glass-bg)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="flex items-center justify-around px-2">
        {(signedIn ? AUTH_NAV : GUEST_NAV).map((item) => {
          const isHome = item.href === '/home/all';
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (isHome && (pathname === '/feed' || pathname === '/home' || pathname === '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.priority}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors h-full flex-1 max-w-[80px] focus-visible:outline-2 focus-visible:outline-degen-500 focus-visible:outline-offset-[-2px] ${active ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
              aria-current={active ? 'page' : undefined}
              title={item.requiresAuth && !signedIn ? 'Sign in to access' : item.label}
            >
              <span
                className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  active ? 'bg-degen-500/15 shadow-[0_0_12px_rgba(0,255,65,0.1)]' : ''
                }`}
                dangerouslySetInnerHTML={{
                  __html:
                    !signedIn && item.requiresAuth
                      ? (ICONS['🔒'] ?? item.icon)
                      : (ICONS[item.icon] ?? item.icon),
                }}
              />
              {signedIn && dmCount > 0 && item.href === '/messages' && (
                <span
                  className="absolute top-0 right-1/2 translate-x-[14px] bg-degen-500 text-black text-[10px] font-bold rounded-full min-w-[1rem] h-4 flex items-center justify-center px-[3px] leading-none shadow-sm"
                  aria-label={`${dmCount} unread messages`}
                >
                  {dmCount > 9 ? '9+' : dmCount}
                </span>
              )}
              {signedIn && notifCount > 0 && item.href === '/notifications' && (
                <span
                  className="absolute top-0 right-1/2 translate-x-[14px] bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[1rem] h-4 flex items-center justify-center px-[3px] leading-none shadow-sm"
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
  );
}
