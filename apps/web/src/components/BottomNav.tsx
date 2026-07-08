'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="text-lg leading-none">{children}</span>;
}

const NAV: NavItem[] = [
  { href: '/home', label: 'Feed', icon: <Icon>⌂</Icon> },
  { href: '/feed', label: 'Feed', icon: <Icon>✦</Icon> },
  { href: '/news', label: 'News', icon: <Icon>◉</Icon> },
  { href: '/newsletter', label: 'Daily', icon: <Icon>✉</Icon> },
  { href: '/discover', label: 'Discover', icon: <Icon>◉</Icon> },
  { href: '/profile', label: 'Profile', icon: <Icon>◍</Icon> },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-gray-950/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="grid grid-cols-6">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                active ? 'text-degen-400' : 'text-gray-500 hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full ${
                  active ? 'bg-degen-500/15' : ''
                }`}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
