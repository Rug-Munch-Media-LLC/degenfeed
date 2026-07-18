'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { PROTOCOL_ID_REGISTRY } from '@degenfeed/utils';
import type { ProtocolId } from '@degenfeed/utils';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';
import { useNotifications } from '../hooks/useNotifications';
import { WalletSwitcher } from './WalletSwitcher';
import { useCrossProtocolIdentity, getLinkedProtocols } from '../hooks/useCrossProtocolIdentity';

/* ─── Nav items ────────────────────────────────────────────── */

interface SidebarItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Only shown when signed in */
  requiresAuth?: boolean;
}

function HomeIcon({ active }: { active: boolean }) {
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.49a1 1 0 01.386-.79l8-6.222a1 1 0 011.228 0l8 6.222a1 1 0 01.386.79V20z" />
    </svg>
  );
}

function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function NotifIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.996 2c-4.062 0-7 2.692-7 6v3.089c0 1.036-.633 1.965-1.516 2.355C2.685 13.997 2 14.996 2 16.05v.698c0 .832.538 1.252 1.184 1.252h17.632c.646 0 1.184-.42 1.184-1.252v-.699c0-1.052-.685-2.052-1.48-2.506-.883-.39-1.516-1.319-1.516-2.355V8c0-3.308-2.938-6-7.004-6z" />
      <path d="M15 19a3 3 0 11-6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ) : (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function MsgIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function DigestIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6z" />
    </svg>
  );
}

function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function CommunitiesIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function _ProfileIcon({ active }: { active: boolean }) {
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 00-16 0" />
    </svg>
  );
}

function TrendingIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function ComposeIcon() {
  return (
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
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

const NAV_ITEMS: SidebarItem[] = [
  { href: '/feed', label: 'Home', icon: null },
  { href: '/explore', label: 'Explore', icon: null },
  { href: '/notifications', label: 'Notifications', icon: null, requiresAuth: true },
  { href: '/messages', label: 'Messages', icon: null, requiresAuth: true },
  { href: '/digest', label: 'Digest', icon: null },
  { href: '/bookmarks', label: 'Bookmarks', icon: null, requiresAuth: true },
  { href: '/c', label: 'Communities', icon: null },
  { href: '/trending', label: 'Trending', icon: null },
];

const MORE_ITEMS = [
  { href: '/shorts', label: 'Shorts' },
  { href: '/feeds', label: 'Feeds' },
  { href: '/spaces', label: 'Spaces' },
  { href: '/news', label: 'News' },
  { href: '/discover', label: 'Discover' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/deploy', label: 'Launch' },
  { href: '/premium', label: 'Premium' },
  { href: '/creator', label: 'Creator Studio' },
  { href: '/docs', label: 'Docs' },
  { href: '/faq', label: 'FAQ' },
  { href: '/status', label: 'Status' },
  { href: '/settings', label: 'Settings' },
];

function iconFor(href: string, active: boolean): React.ReactNode {
  switch (href) {
    case '/feed':
      return <HomeIcon active={active} />;
    case '/explore':
      return <ExploreIcon active={active} />;
    case '/notifications':
      return <NotifIcon active={active} />;
    case '/messages':
      return <MsgIcon active={active} />;
    case '/digest':
      return <DigestIcon active={active} />;
    case '/bookmarks':
      return <BookmarkIcon active={active} />;
    case '/c':
      return <CommunitiesIcon active={active} />;
    case '/trending':
      return <TrendingIcon active={active} />;
    default:
      return <MoreIcon />;
  }
}

/* ─── User card dropdown ───────────────────────────────────── */

function WalletUserCard({
  walletAddress,
  onSignOut,
}: {
  walletAddress: string;
  onSignOut: () => void;
}) {
  const { walletAddresses, walletCount, walletMeta, switchWallet, addWallet } = useAuth();
  const { identity } = useCrossProtocolIdentity(walletAddress, true);
  const linkedProtocols = identity ? getLinkedProtocols(identity) : [];

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeMeta = walletMeta[walletAddress];
  const chain = activeMeta?.chain ?? 'ethereum';
  const isEth = chain === 'ethereum';

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleSwitch = useCallback(
    (idx: number) => {
      switchWallet(idx);
      setDropdownOpen(false);
    },
    [switchWallet],
  );

  const handleAdd = useCallback(() => {
    addWallet();
    setDropdownOpen(false);
  }, [addWallet]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        className="sidebar-user-card w-full text-left"
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-sm font-mono font-bold text-degen-400">
          {walletAddress.slice(2, 4).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 hidden lg:block">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-fg)' }}>
              {activeMeta?.walletName ?? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                isEth
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-purple-500/15 text-purple-400'
              }`}
            >
              {isEth ? 'ETH' : 'SOL'}
            </span>
          </div>
          <div className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
            {walletCount > 1
              ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)} + ${walletCount - 1} more`
              : `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`}
          </div>
        </div>
        <span className="hidden lg:inline text-[var(--color-muted)]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </span>
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2 shadow-2xl backdrop-blur-xl"
          role="menu"
        >
          {/* Active wallet detail */}
          <div className="border-b border-[var(--color-glass-border)] px-3 pb-2 mb-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  isEth
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-purple-500/15 text-purple-400'
                }`}
              >
                {isEth ? 'ETH' : 'SOL'}
              </span>
              <code className="text-xs font-mono text-gray-400">
                {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
              </code>
              <span className="ml-auto text-[10px] font-medium text-degen-400">Active</span>
            </div>
            {linkedProtocols.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {linkedProtocols.map((lp) => {
                  const meta = PROTOCOL_ID_REGISTRY[lp.protocol as ProtocolId];
                  if (!meta) return null;
                  return (
                    <span
                      key={lp.protocol}
                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                      style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
                    >
                      {meta.icon} {meta.displayName}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Wallet list */}
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {walletAddresses.map((addr, idx) => {
              const m = walletMeta[addr];
              const isActive = addr === walletAddress;
              return (
                <button
                  key={addr}
                  type="button"
                  onClick={() => handleSwitch(idx)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                    isActive
                      ? 'bg-degen-500/10'
                      : 'hover:bg-white/[0.04]'
                  }`}
                  role="menuitem"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-degen-500/20 text-degen-400' : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    {addr.slice(2, 4).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs font-mono truncate text-gray-400">
                        {addr.slice(0, 6)}…{addr.slice(-4)}
                      </code>
                      {isActive && (
                        <span className="shrink-0 text-[9px] font-bold text-degen-400">· Active</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-1 py-0.5 text-[8px] font-semibold uppercase ${
                      m?.chain === 'solana'
                        ? 'bg-purple-500/15 text-purple-400'
                        : 'bg-blue-500/15 text-blue-400'
                    }`}
                  >
                    {m?.chain === 'solana' ? 'SOL' : 'ETH'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-1 border-t border-[var(--color-glass-border)] pt-1 space-y-0.5">
            <button
              type="button"
              onClick={handleAdd}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-degen-400 transition-colors hover:bg-degen-500/10"
              role="menuitem"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-xs">Add wallet</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
              role="menuitem"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="text-xs">Disconnect all</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Component ────────────────────────────────────────────── */

export const LeftSidebar = memo(function LeftSidebar({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const { ready, signedInProtocols, openSignIn, openCompose, walletAddress, signOut } = useAuth();
  const { showToast } = useToast();
  const [moreOpen, setMoreOpen] = useState(false);
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const { unreadCount } = useNotifications(hasSignedIn);

  const isActive = (href: string) => {
    if (href === '/feed') return pathname === '/feed' || pathname === '/home/all';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleClick = () => {
    onNavClick?.();
    setMoreOpen(false);
  };

  return (
    <aside
      className="left-sidebar flex h-full flex-col overflow-y-auto scrollbar-none"
      aria-label="Primary navigation"
    >
      {/* Logo */}
      <div className="px-3 py-2">
        <Link
          href="/feed"
          onClick={handleClick}
          className="flex items-center gap-3 rounded-full px-3 py-3 transition-colors hover:bg-[var(--color-overlay)]"
          aria-label="DegenFeed Home"
        >
          <Image
            src="/icon.svg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg logo-glow"
          />
          <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
            DegenFeed
          </span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-1" aria-label="Sidebar">
        {NAV_ITEMS.map((item) => {
          if (item.requiresAuth && !hasSignedIn) return null;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              className={`sidebar-nav-item ${active ? 'sidebar-nav-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="sidebar-nav-icon">{iconFor(item.href, active)}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.label === 'Notifications' && unreadCount > 0 && (
                <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-degen-500 px-1.5 text-[11px] font-bold text-black">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* More (expandable) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`sidebar-nav-item w-full ${moreOpen ? 'sidebar-nav-active' : ''}`}
            aria-expanded={moreOpen}
          >
            <span className="sidebar-nav-icon">
              <MoreIcon />
            </span>
            <span className="sidebar-nav-label">More</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className={`ml-auto transition-transform ${moreOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {moreOpen && (
            <div className="ml-3 mb-1 space-y-0.5 border-l border-[var(--color-glass-border)] pl-2">
              {MORE_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleClick}
                    className={`sidebar-nav-item sidebar-nav-item-sm ${active ? 'sidebar-nav-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="sidebar-nav-icon sidebar-nav-icon-sm">
                      {iconFor(item.href, active)}
                    </span>
                    <span className="sidebar-nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Compose button */}
      <div className="px-3 py-3">
        {ready && hasSignedIn ? (
          <button
            type="button"
            onClick={() => {
              handleClick();
              openCompose();
            }}
            className="sidebar-compose-btn"
          >
            <span className="hidden lg:inline">Post</span>
            <span className="lg:hidden">
              <ComposeIcon />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              handleClick();
              showToast('info', 'Sign in to post');
              openSignIn();
            }}
            className="sidebar-compose-btn sidebar-signin-btn"
          >
            <span className="hidden lg:inline">Sign In</span>
            <span className="lg:hidden">
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
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </span>
          </button>
        )}
      </div>

      {/* Profile / Wallet at bottom */}
      <div className="border-t border-[var(--color-glass-border)] px-2 py-2">
        {!ready ? (
          <div className="skeleton h-12 w-full rounded-full" />
        ) : hasSignedIn && walletAddress ? (
          <WalletUserCard walletAddress={walletAddress} onSignOut={signOut} />
        ) : (
          <button
            type="button"
            onClick={() => {
              handleClick();
              openSignIn();
            }}
            className="sidebar-user-card w-full text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/10 text-sm font-bold text-degen-400">
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
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 hidden lg:block">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                Sign In
              </div>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Connect wallet
              </div>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
});
