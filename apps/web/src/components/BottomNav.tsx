'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { href: '/home/all', label: 'Feed', icon: '✦' },
  { href: '/news', label: 'News', icon: '◉' },
  { href: '/videos', label: 'Videos', icon: '▶' },
  { href: '/discover', label: 'Explore', icon: '⊕' },
  { href: '/profile/bookmarks', label: 'Saved', icon: '★' },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const [notifCount, setNotifCount] = useState(0);

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
    poll();
    interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-gray-950/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="grid grid-cols-5">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/home/all' && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${active ? 'text-degen-400' : 'text-gray-500 hover:text-white'}`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-degen-500/15' : ''}`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                {item.href === '/home/all' && notifCount > 0 && (
                  <span
                    className="absolute ml-5 mt-[-14px] flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
                    aria-label={`${notifCount} unread notifications`}
                  >
                    {notifCount > 99 ? '99+' : notifCount}
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
