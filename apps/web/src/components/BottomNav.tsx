'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  priority: boolean;
}

const PRIORITY = new Set([
  '/home/all', '/search', '/shorts', '/trending',
  '/feed', '/notifications', '/messages',
]);

const NAV: NavItem[] = [
  { href: '/home/all', label: 'Feed', icon: '🏠', priority: true },
  { href: '/shorts', label: 'Shorts', icon: '📱', priority: true },
  { href: '/feeds', label: 'Feeds', icon: '📋', priority: false },
  { href: '/digest', label: 'Digest', icon: '📋', priority: false },
  { href: '/search', label: 'Search', icon: '🔍', priority: true },
  { href: '/leaderboard', label: 'Leaderboard', icon: '🏆', priority: false },
  { href: '/c', label: 'Communities', icon: '🌐', priority: false },
  { href: '/spaces', label: 'Spaces', icon: '🔊', priority: false },
  { href: '/trending', label: 'Trending', icon: '🔥', priority: true },
  { href: '/news', label: 'News', icon: '📰', priority: true },
  { href: '/messages', label: 'Messages', icon: '💬', priority: true },
  { href: '/notifications', label: 'Notifications', icon: '🔔', priority: true },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const [notifCount, setNotifCount] = useState(0);
  const [dmCount, setDmCount] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { notifications?: Array<{ read: boolean }> };
        const unread = (data.notifications ?? []).filter((n) => !n.read).length;
        setNotifCount(unread);
      } catch {}
    };
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
    poll();
    pollDm();
    interval = setInterval(() => {
      poll();
      pollDm();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav
      aria-label="Mobile"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-card)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="grid grid-cols-11">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/home/all' && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.priority}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${active ? 'text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`relative flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-degen-500/15' : ''}`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                {dmCount > 0 && item.href === '/messages' && (
                  <span className="absolute -top-1 -right-1 bg-degen-500 text-[var(--color-fg)] text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {dmCount > 9 ? '9+' : dmCount}
                  </span>
                )}
                {notifCount > 0 && item.href === '/notifications' && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-[var(--color-fg)] text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
