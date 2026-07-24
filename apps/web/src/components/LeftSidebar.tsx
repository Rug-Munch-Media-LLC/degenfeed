'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useProtocolConnections } from '../hooks/useProtocolConnections';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';
import { UnifiedComposerButton } from './UnifiedComposerButton';

/* === SVG Icon Components ==================================== */

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.49a1 1 0 01.386-.79l8-6.222a1 1 0 011.228 0l8 6.222a1 1 0 01.386.79V20z" />
    </svg>
  ) : (
    <svg
      width="22"
      height="22"
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

function _FeedIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z" />
    </svg>
  );
}

function ProtocolsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function NotifIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.996 2c-4.062 0-7 2.692-7 6v3.089c0 1.036-.633 1.965-1.516 2.355C2.685 13.997 2 14.996 2 16.05v.698c0 .832.538 1.252 1.184 1.252h17.632c.646 0 1.184-.42 1.184-1.252v-.699c0-1.052-.685-2.052-1.48-2.506-.883-.39-1.516-1.319-1.516-2.355V8c0-3.308-2.938-6-7.004-6z" />
      <path d="M15 19a3 3 0 11-6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ) : (
    <svg
      width="22"
      height="22"
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

function SettingsIcon() {
  return (
    <svg
      width="22"
      height="22"
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

/* === Nav items ============================================== */

interface SidebarItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  requiresAuth?: boolean;
}

/* === Main Component ========================================= */

export const LeftSidebar = memo(function LeftSidebar({
  onNavClick,
  onQuickSwitcherOpen,
  onProtocolConnectOpen,
  collapsed = false,
  onCollapseToggle,
}: {
  onNavClick?: () => void;
  onQuickSwitcherOpen?: () => void;
  onProtocolConnectOpen?: () => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
}) {
  const pathname = usePathname();
  const { ready, signedInProtocols, openSignIn, walletAddress } = useAuth();
  const { showToast } = useToast();
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const { unreadCount } = useNotifications(hasSignedIn);
  const { connections, connectedCount } = useProtocolConnections();

  const isActive = (href: string) => {
    if (href === '/feed')
      return (
        pathname === '/feed' || pathname === '/home/all' || pathname === '/home' || pathname === '/'
      );
    if (href === '/notifications')
      return pathname === '/notifications' || pathname.startsWith('/notifications/');
    if (href === '/settings') return pathname === '/settings' || pathname.startsWith('/settings/');
    if (href === '/search') return pathname === '/search';
    if (href === '/status') return pathname === '/status';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isProtocolPage = (pid: string) => {
    return pathname === `/${pid}` || pathname.startsWith(`/${pid}/`);
  };

  const handleClick = () => {
    onNavClick?.();
  };

  // Protocols sidebar items
  const protocolIds = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit', 'rss'];

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
          className={`flex items-center rounded-full transition-colors hover:bg-[var(--color-overlay)] ${collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-3'}`}
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

      {/* Primary navigation */}
      <nav className="flex-1 space-y-0.5 px-1" aria-label="Sidebar">
        {/* Home / Feed */}
        <Link
          href="/feed"
          onClick={handleClick}
          className={`sidebar-nav-item ${isActive('/feed') ? 'sidebar-nav-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          aria-current={isActive('/feed') ? 'page' : undefined}
          title={collapsed ? 'Home' : undefined}
        >
          <span className="sidebar-nav-icon">
            <HomeIcon active={isActive('/feed')} />
          </span>
          {!collapsed && <span className="sidebar-nav-label">Home</span>}
        </Link>

        {/* Protocols — opens connect flow */}
        <button
          type="button"
          onClick={() => {
            handleClick();
            onProtocolConnectOpen?.();
          }}
          className={`sidebar-nav-item w-full ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? 'Protocols' : undefined}
        >
          <span className="sidebar-nav-icon">
            <ProtocolsIcon active={false} />
          </span>
          {!collapsed && (
            <>
              <span className="sidebar-nav-label">Protocols</span>
              <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-degen-500/15 px-1.5 text-[9px] font-bold text-degen-400">
                {connectedCount}
              </span>
            </>
          )}
        </button>

        {/* Search */}
        <button
          type="button"
          onClick={() => {
            handleClick();
            onQuickSwitcherOpen?.();
          }}
          className={`sidebar-nav-item w-full ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? 'Search' : undefined}
        >
          <span className="sidebar-nav-icon">
            <SearchIcon />
          </span>
          {!collapsed && (
            <>
              <span className="sidebar-nav-label">Search</span>
              <kbd
                className="ml-auto rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none"
                style={{ color: 'var(--color-muted)' }}
              >
                ⌘K
              </kbd>
            </>
          )}
        </button>

        {/* Live */}
        <Link
          href="/live"
          onClick={handleClick}
          className={`sidebar-nav-item ${isActive('/live') ? 'sidebar-nav-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          aria-current={isActive('/live') ? 'page' : undefined}
          title={collapsed ? 'Live' : undefined}
        >
          <span className="sidebar-nav-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive('/live') ? 2.5 : 1.5}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </span>
          {!collapsed && (
            <>
              <span className="sidebar-nav-label">Live</span>
              <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500/15 px-1.5 text-[9px] font-bold text-red-400">
                12
              </span>
            </>
          )}
        </Link>

        {/* Creator Studio */}
        <Link
          href="/creator"
          onClick={handleClick}
          className={`sidebar-nav-item ${isActive('/creator') ? 'sidebar-nav-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          aria-current={isActive('/creator') ? 'page' : undefined}
          title={collapsed ? 'Creator' : undefined}
        >
          <span className="sidebar-nav-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive('/creator') ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </span>
          {!collapsed && <span className="sidebar-nav-label">Creator Studio</span>}
        </Link>

        {/* Pricing */}
        <Link
          href="/pricing"
          onClick={handleClick}
          className={`sidebar-nav-item ${isActive('/pricing') ? 'sidebar-nav-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          aria-current={isActive('/pricing') ? 'page' : undefined}
          title={collapsed ? 'Pricing' : undefined}
        >
          <span className="sidebar-nav-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive('/pricing') ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M9 9.5c-.87-.5-2-.5-2.5-.5s-1.5.5-1.5 1.5.67 1.5 1.5 2 3.5.5 4.5 1 1 1.5 1 2.5-1.5 2-3 2-2.5-.5-3-1" />
            </svg>
          </span>
          {!collapsed && <span className="sidebar-nav-label">Pricing</span>}
        </Link>

        {/* Notifications */}
        <Link
          href="/notifications"
          onClick={handleClick}
          className={`sidebar-nav-item ${isActive('/notifications') ? 'sidebar-nav-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          aria-current={isActive('/notifications') ? 'page' : undefined}
          title={collapsed ? 'Notifications' : undefined}
        >
          <span className="sidebar-nav-icon">
            <NotifIcon active={isActive('/notifications')} />
          </span>
          {!collapsed && <span className="sidebar-nav-label">Notifications</span>}
          {!collapsed && unreadCount > 0 && (
            <span
              role="status"
              className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-degen-500 px-1.5 text-[11px] font-bold text-black"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          onClick={handleClick}
          className={`sidebar-nav-item ${isActive('/settings') ? 'sidebar-nav-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          aria-current={isActive('/settings') ? 'page' : undefined}
          title={collapsed ? 'Settings' : undefined}
        >
          <span className="sidebar-nav-icon">
            <SettingsIcon />
          </span>
          {!collapsed && <span className="sidebar-nav-label">Settings</span>}
        </Link>

        {/* Status / Health */}
        <Link
          href="/status"
          onClick={handleClick}
          className={`sidebar-nav-item ${isActive('/status') ? 'sidebar-nav-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          aria-current={isActive('/status') ? 'page' : undefined}
          title={collapsed ? 'Status' : undefined}
        >
          <span className="sidebar-nav-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive('/status') ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20V10" />
              <path d="M18 20V4" />
              <path d="M6 20v-4" />
            </svg>
          </span>
          {!collapsed && <span className="sidebar-nav-label">Status</span>}
        </Link>

        {/* Divider */}
        {!collapsed && <div className="my-2 border-t border-[var(--color-glass-border)]" />}

        {/* Protocol sections */}
        {!collapsed && (
          <div className="px-3 py-1">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-muted)' }}
            >
              Your Networks
            </span>
          </div>
        )}

        {protocolIds.map((pid) => {
          const conn = connections[pid];
          if (!conn) return null;
          const color = conn.color;
          const active = isProtocolPage(pid);
          return (
            <Link
              key={pid}
              href={`/${pid}`}
              onClick={handleClick}
              className={`sidebar-nav-item ${active ? 'sidebar-nav-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? conn.name : undefined}
            >
              <span
                className="sidebar-nav-icon flex items-center justify-center rounded-lg text-sm font-bold"
                style={{
                  backgroundColor: conn.connected ? `${color}1a` : 'transparent',
                  color: conn.connected ? color : 'var(--color-muted)',
                }}
              >
                {conn.icon}
              </span>
              {!collapsed && (
                <>
                  <span className="sidebar-nav-label">{conn.name}</span>
                  <span
                    className={`ml-auto flex h-2 w-2 rounded-full ${conn.connected ? 'bg-degen-500' : 'bg-[var(--color-muted)]'}`}
                    aria-label={conn.connected ? 'Connected' : 'Not connected'}
                  />
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* UnifiedComposerButton — one "Create Post" button that works everywhere */}
      <div className={`${collapsed ? 'px-2 py-2' : 'px-3 py-3'}`}>
        {ready && hasSignedIn ? (
          <UnifiedComposerButton variant={collapsed ? 'compact' : 'default'} />
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
          <button
            type="button"
            onClick={onCollapseToggle}
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
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-sm font-mono font-bold text-degen-400">
              {walletAddress.slice(2, 4).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--color-fg)' }}
                >
                  {walletAddress.slice(0, 6)}&hellip;{walletAddress.slice(-4)}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                  {connectedCount} protocol{connectedCount !== 1 ? 's' : ''} connected
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              handleClick();
              openSignIn();
            }}
            className={`flex w-full items-center gap-2 rounded-full p-2 transition-colors hover:bg-[var(--color-overlay)] ${collapsed ? 'justify-center' : ''}`}
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
              <div className="min-w-0 flex-1">
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
