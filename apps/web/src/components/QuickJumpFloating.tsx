'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface JumpItem {
  href: string;
  label: string;
  icon: string;
}

const QUICK_LINKS: JumpItem[] = [
  { href: '/feed', label: 'Feed', icon: '📰' },
  { href: '/shorts', label: 'Shorts', icon: '📱' },
  { href: '/trending', label: 'Trending', icon: '🔥' },
  { href: '/discover', label: 'Discover', icon: '🔍' },
  { href: '/messages', label: 'Messages', icon: '💬' },
  { href: '/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/search', label: 'Search', icon: '⌕' },
  { href: '/digest', label: 'Digest', icon: '📋' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { href: '/c', label: 'Communities', icon: '👥' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

/**
 * Floating quick-jump button that appears after scrolling down.
 * Tap to open a compact nav menu from anywhere on the page.
 * Shows on mobile/tablet only.
 */
export function QuickJumpFloating() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // Show after scrolling 300px
  useEffect(() => {
    const handler = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (!visible && !open) return null;

  return (
    <div ref={menuRef} className="fixed bottom-20 right-4 z-50 lg:hidden">
      {/* Menu */}
      {open && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-px">
            {QUICK_LINKS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 text-center text-[10px] font-medium transition-colors hover:bg-[var(--color-overlay)] ${
                    active ? 'text-degen-400 bg-degen-500/5' : 'text-[var(--color-muted)]'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={toggle}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-degen-500 text-black shadow-lg shadow-degen-500/30 transition-transform hover:scale-110 active:scale-95"
        aria-label={open ? 'Close quick jump' : 'Open quick jump'}
        aria-expanded={open}
      >
        <span className={`text-xl transition-transform ${open ? 'rotate-45' : ''}`}>
          {open ? '+' : '◆'}
        </span>
      </button>
    </div>
  );
}
