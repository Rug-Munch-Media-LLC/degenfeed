'use client';

import type { ProtocolId } from '@degenfeed/utils';
import { PROTOCOL_ID_REGISTRY } from '@degenfeed/utils';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { getLinkedProtocols, useCrossProtocolIdentity } from '../hooks/useCrossProtocolIdentity';
import { useNotifications } from '../hooks/useNotifications';
import { useLiveStreams } from '../components/streams/useLiveStreams';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';

/* === SVG Icon Components ==================================== */

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

function SpacesIcon({ active }: { active: boolean }) {
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
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function VideosIcon({ active }: { active: boolean }) {
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
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
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

function ProfileIcon({ active }: { active: boolean }) {
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

function LiveShortsIcon({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex">
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
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <polygon points="10 9 16 12 10 15 10 9" fill={active ? 'currentColor' : 'none'} />
      </svg>
      {active && (
        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      )}
    </span>
  );
}

function LiveIcon({ active, hasLive }: { active: boolean; hasLive: boolean }) {
  return (
    <span className="relative inline-flex">
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
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      {hasLive && (
        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      )}
    </span>
  );
}

function DiscoverIcon({ active }: { active: boolean }) {
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
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function VideoIcon({ active }: { active: boolean }) {
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polygon points="10 8 16 12 10 16 10 8" fill={active ? 'currentColor' : 'none'} />
    </svg>
  );
}

function VisualIcon({ active }: { active: boolean }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function LaunchIcon({ active }: { active: boolean }) {
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
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.33-1.17 4-1 4-1" />
      <path d="M12 15v5s3.03-.55 4-2c1.17-1.33 1-4 1-4" />
    </svg>
  );
}

function FeddyIcon({ active }: { active: boolean }) {
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
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ArticlesIcon({ active }: { active: boolean }) {
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
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function SettingsIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
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

/* === Nav items ============================================== */

interface SidebarItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  requiresAuth?: boolean;
}

const PRIMARY_NAV: SidebarItem[] = [
  { href: '/feed', label: 'Home / Feed', icon: null },
  { href: '/trending', label: 'Trending', icon: null },
  { href: '/discover', label: 'Discover', icon: null },
  { href: '/spaces', label: 'Spaces', icon: null },
  { href: '/live', label: 'Live', icon: null },
  { href: '/video', label: 'Video', icon: null },
  { href: '/shorts', label: 'Shorts', icon: null },
  { href: '/visual', label: 'Visual', icon: null },
  { href: '/launch', label: 'Launch', icon: null },
  { href: '/feddy', label: 'Feddy', icon: null },
  { href: '/articles', label: 'Articles', icon: null },
  { href: '/messages', label: 'Messages', icon: null, requiresAuth: true },
  { href: '/notifications', label: 'Notifications', icon: null, requiresAuth: true },
  { href: '/profile', label: 'Profile', icon: null, requiresAuth: true },
  { href: '/settings', label: 'Settings', icon: null },
];

const MORE_SUB_ITEMS = [
  { href: '/profile/bookmarks', label: 'Bookmarks' },
  { href: '/c', label: 'Communities' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/digest', label: 'Digest' },
  { href: '/premium', label: 'Premium' },
  { href: '/newsletter', label: 'Newsletter' },
];

function iconFor(href: string, active: boolean, hasLive?: boolean): React.ReactNode {
  switch (href) {
    case '/feed':
      return <HomeIcon active={active} />;
    case '/trending':
      return <TrendingIcon active={active} />;
    case '/discover':
      return <DiscoverIcon active={active} />;
    case '/spaces':
      return <SpacesIcon active={active} />;
    case '/live':
      return <LiveIcon active={active} hasLive={hasLive ?? false} />;
    case '/video':
      return <VideoIcon active={active} />;
    case '/live-shorts':
      return <LiveShortsIcon active={active} />;
    case '/shorts':
      return <VideosIcon active={active} />;
    case '/visual':
      return <VisualIcon active={active} />;
    case '/launch':
      return <LaunchIcon active={active} />;
    case '/feddy':
      return <FeddyIcon active={active} />;
    case '/articles':
      return <ArticlesIcon active={active} />;
    case '/messages':
      return <MsgIcon active={active} />;
    case '/notifications':
      return <NotifIcon active={active} />;
    case '/profile':
      return <ProfileIcon active={active} />;
    case '/settings':
      return <SettingsIcon />;
    default:
      return <MoreIcon />;
  }
}

/* === User card dropdown ===================================== */

function WalletUserCard({
  walletAddress,
  onSignOut,
  collapsed,
}: {
  walletAddress: string;
  onSignOut: () => void;
  collapsed: boolean;
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
        aria-label="Open wallet menu"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-sm font-mono font-bold text-degen-400">
          {walletAddress.slice(2, 4).toUpperCase()}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--color-fg)' }}
                >
                  {activeMeta?.walletName ??
                    `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    isEth ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
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
            <span className="text-[var(--color-muted)]">
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
          </>
        )}
      </button>

      {dropdownOpen && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 mb-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2 shadow-2xl backdrop-blur-xl ${
            collapsed ? 'left-0 bottom-full' : 'bottom-full left-0 w-72'
          }`}
          role="menu"
        >
          <div className="border-b border-[var(--color-glass-border)] px-3 pb-2 mb-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  isEth ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
                }`}
              >
                {isEth ? 'ETH' : 'SOL'}
              </span>
              <code className="text-xs font-mono text-[var(--color-muted)]">
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
                    isActive ? 'bg-degen-500/10' : 'hover:bg-[var(--color-overlay)]'
                  }`}
                  role="menuitem"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-degen-500/20 text-degen-400'
                        : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                    }`}
                  >
                    {addr.slice(2, 4).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs font-mono truncate text-[var(--color-muted)]">
                        {addr.slice(0, 6)}…{addr.slice(-4)}
                      </code>
                      {isActive && (
                        <span className="shrink-0 text-[9px] font-bold text-degen-400">
                          · Active
                        </span>
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
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

/* === Collapse toggle button ================================= */

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-center w-full px-3 py-2 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
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
        className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
      {!collapsed && <span className="ml-3 text-xs font-medium">Collapse</span>}
    </button>
  );
}

/* === Main Component ========================================= */

export const LeftSidebar = memo(function LeftSidebar({
  onNavClick,
  collapsed = false,
  onCollapseToggle,
}: {
  onNavClick?: () => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
}) {
  const pathname = usePathname();
  const { ready, signedInProtocols, openSignIn, openCompose, walletAddress, signOut } = useAuth();
  const { showToast } = useToast();
  const [moreOpen, setMoreOpen] = useState(false);
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const { unreadCount } = useNotifications(hasSignedIn);

  // Live streams — check if any are active for the pulsing dot
  const { total: liveTotal } = useLiveStreams();
  const hasLiveStreams = liveTotal > 0;

  const isActive = (href: string) => {
    if (href === '/feed')
      return (
        pathname === '/feed' || pathname === '/home/all' || pathname === '/home' || pathname === '/'
      );
    if (href === '/c') return pathname === '/c' || pathname.startsWith('/c/');
    if (href === '/profile') return pathname === '/profile' || pathname.startsWith('/profile/');
    if (href === '/settings') return pathname === '/settings' || pathname.startsWith('/settings/');
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
      <div className={`${collapsed ? 'px-2 py-2' : 'px-3 py-2'}`}>
        <Link
          href="/feed"
          onClick={handleClick}
          className={`flex items-center rounded-full transition-colors hover:bg-[var(--color-overlay)] ${
            collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-3'
          }`}
          aria-label="DegenFeed Home"
        >
          <Image
            src="/icon.svg"
            alt=""
            width={collapsed ? 28 : 32}
            height={collapsed ? 28 : 32}
            className={`rounded-lg logo-glow ${collapsed ? 'h-7 w-7' : 'h-8 w-8'}`}
          />
          {!collapsed && (
            <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-fg)' }}>
              DegenFeed
            </span>
          )}
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-1" aria-label="Sidebar">
        {PRIMARY_NAV.map((item) => {
          if (item.requiresAuth && !hasSignedIn) return null;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              className={`sidebar-nav-item ${active ? 'sidebar-nav-active' : ''} ${
                collapsed ? 'justify-center px-0' : ''
              }`}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-nav-icon">{iconFor(item.href, active, hasLiveStreams)}</span>
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
              {!collapsed && item.label === 'Live' && hasLiveStreams && (
                <span
                  role="status"
                  className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[9px] font-bold text-white"
                  aria-label="Live streams active"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                </span>
              )}
              {!collapsed && item.label === 'Notifications' && unreadCount > 0 && (
                <span
                  role="status"
                  className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-degen-500 px-1.5 text-[11px] font-bold text-black"
                  aria-label={`${unreadCount} unread notifications`}
                >
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
            className={`sidebar-nav-item w-full ${moreOpen ? 'sidebar-nav-active' : ''} ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            aria-expanded={moreOpen}
            aria-label={collapsed ? 'More options' : 'Toggle more menu'}
            title={collapsed ? 'More options' : undefined}
          >
            <span className="sidebar-nav-icon">
              <MoreIcon />
            </span>
            {!collapsed && (
              <>
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
              </>
            )}
          </button>
          {!collapsed && moreOpen && (
            <div className="ml-3 mb-1 space-y-0.5 border-l border-[var(--color-glass-border)] pl-2">
              {MORE_SUB_ITEMS.map((item) => {
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
      <div className={`${collapsed ? 'px-2 py-2' : 'px-3 py-3'}`}>
        {ready && hasSignedIn ? (
          <button
            type="button"
            onClick={() => {
              handleClick();
              openCompose();
            }}
            className={`sidebar-compose-btn ${collapsed ? '!px-0 !py-3' : ''}`}
            aria-label="Create new post"
            title={collapsed ? 'Create post' : undefined}
          >
            {collapsed ? <ComposeIcon /> : 'Post'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              handleClick();
              showToast('info', 'Sign in to post');
              openSignIn();
            }}
            className={`sidebar-compose-btn sidebar-signin-btn ${collapsed ? '!px-0 !py-3' : ''}`}
            aria-label="Sign in to DegenFeed"
            title={collapsed ? 'Sign in' : undefined}
          >
            {collapsed ? (
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
            ) : (
              'Sign In'
            )}
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      {onCollapseToggle && (
        <div className="border-t border-[var(--color-glass-border)] pt-1">
          <CollapseToggle collapsed={collapsed} onToggle={onCollapseToggle} />
        </div>
      )}

      {/* Profile / Wallet at bottom */}
      <div
        className={`border-t border-[var(--color-glass-border)] ${collapsed ? 'px-1 py-2' : 'px-2 py-2'}`}
      >
        {!ready ? (
          <div
            className={`skeleton rounded-full ${collapsed ? 'h-10 w-10 mx-auto' : 'h-12 w-full'}`}
          />
        ) : hasSignedIn && walletAddress ? (
          <WalletUserCard walletAddress={walletAddress} onSignOut={signOut} collapsed={collapsed} />
        ) : (
          <button
            type="button"
            onClick={() => {
              handleClick();
              openSignIn();
            }}
            className={`sidebar-user-card w-full text-left ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Sign in' : undefined}
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
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
                  Sign In
                </div>
                <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Connect wallet
                </div>
              </div>
            )}
          </button>
        )}
      </div>
    </aside>
  );
});
