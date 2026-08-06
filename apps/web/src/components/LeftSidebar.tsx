'use client';

import { useChatUnread } from '@degenfeed/degenchat';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useProtocolConnections } from '../hooks/useProtocolConnections';
import { useAuth } from './AuthProvider';
import { DegenChatLogo } from './DegenChatBrand';
import { useToast } from './Toast';
import { UnifiedComposerButton } from './UnifiedComposerButton';

/* === SVG Icon Components ==================================== */

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {active ? (
        <path d="M21 20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.49a1 1 0 01.386-.79l8-6.222a1 1 0 011.228 0l8 6.222a1 1 0 01.386.79V20z" />
      ) : (
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      )}
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
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {active ? (
        <path d="M11.996 2c-4.062 0-7 2.692-7 6v3.089c0 1.036-.633 1.965-1.516 2.355C2.685 13.997 2 14.996 2 16.05v.698c0 .832.538 1.252 1.184 1.252h17.632c.646 0 1.184-.42 1.184-1.252v-.699c0-1.052-.685-2.052-1.48-2.506-.883-.39-1.516-1.319-1.516-2.355V8c0-3.308-2.938-6-7.004-6z" />
      ) : (
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      )}
      <path
        d="M15 19a3 3 0 11-6 0"
        stroke={active ? 'currentColor' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* === Nav model =============================================== */

type SectionId =
  | 'social'
  | 'video'
  | 'audio'
  | 'newsletters'
  | 'discussion'
  | 'markets'
  | 'governance'
  | 'reading'
  | 'chat'
  | 'tools';

const SECTION_IDS: SectionId[] = [
  'social',
  'video',
  'audio',
  'newsletters',
  'discussion',
  'markets',
  'governance',
  'reading',
  'chat',
  'tools',
];

const SECTION_META: Record<SectionId, { label: string; icon: string }> = {
  social: { label: 'Social', icon: '💬' },
  video: { label: 'Video', icon: '🎬' },
  audio: { label: 'Audio', icon: '🎵' },
  newsletters: { label: 'Newsletters', icon: '📬' },
  discussion: { label: 'Discussion', icon: '👥' },
  markets: { label: 'Markets', icon: '📊' },
  governance: { label: 'Governance', icon: '🗳️' },
  reading: { label: 'Reading', icon: '📚' },
  chat: { label: 'Chat', icon: '💬' },
  tools: { label: 'Tools', icon: '🛠️' },
};

/**
 * Curated protocol IDs per sidebar section — the canonical sidebar menu.
 * Every protocol here resolves to a real /feed/{id} page with content.
 */
const SECTION_PROTOCOLS: Record<SectionId, string[]> = {
  social: ['mastodon', 'bluesky', 'nostr', 'farcaster', 'lens', 'threads', 'minds', 'gab'],
  video: ['youtube', 'peertube', 'vimeo', 'loops', 'owncast', 'twitch', 'kick'],
  audio: ['soundcloud', 'audius', 'castopod'],
  newsletters: ['substack', 'medium', 'mirror', 'paragraph', 'writefreely', 'wordpress'],
  discussion: ['lemmy', 'reddit', 'lobsters', 'discourse'],
  markets: ['polymarket', 'opensea'],
  governance: ['snapshot', 'tally'],
  reading: ['bookwyrm'],
  chat: [],
  tools: [],
};

interface FeatureLink {
  id: string;
  label: string;
  href: string;
  icon: string;
  color: string;
  /** Renders a pulsing red dot (used for Live). */
  live?: boolean;
}

const SECTION_FEATURES: Record<SectionId, FeatureLink[]> = {
  social: [
    { id: 'spaces', label: 'Spaces', href: '/spaces', icon: '🎙️', color: '#22d3ee' },
    { id: 'communities', label: 'Communities', href: '/c', icon: '👥', color: '#a78bfa' },
  ],
  video: [
    { id: 'create', label: 'Create', href: '/create', icon: '➕', color: '#22c55e' },
    { id: 'videos', label: 'Videos', href: '/videos', icon: '🎬', color: '#a855f7' },
    { id: 'shorts', label: 'Shorts', href: '/shorts', icon: '⚡', color: '#facc15' },
    { id: 'live', label: 'Live', href: '/live', icon: '🔴', color: '#ef4444', live: true },
  ],
  audio: [{ id: 'podcasts', label: 'Podcasts', href: '/podcasts', icon: '🎙️', color: '#7c3aed' }],
  newsletters: [
    { id: 'newsletter', label: 'Newsletters', href: '/newsletter', icon: '📬', color: '#e63946' },
  ],
  discussion: [],
  markets: [],
  governance: [],
  reading: [],
  chat: [
    { id: 'messages', label: 'Messages', href: '/messages', icon: '💬', color: '#3b82f6' },
    { id: 'groups', label: 'Groups', href: '/messages/groups', icon: '👥', color: '#a78bfa' },
    { id: 'voice', label: 'Voice', href: '/messages/voice', icon: '🎤', color: '#22c55e' },
    { id: 'video-chat', label: 'Video', href: '/messages/video', icon: '📹', color: '#ec4899' },
  ],
  tools: [
    { id: 'news', label: 'News', href: '/news', icon: '📰', color: '#f97316' },
    { id: 'articles', label: 'Articles', href: '/articles', icon: '📄', color: '#22c55e' },
    { id: 'digest', label: 'Digest', href: '/digest', icon: '📥', color: '#f43f5e' },
    { id: 'trending', label: 'Trending', href: '/trending', icon: '📈', color: '#f97316' },
    { id: 'discover', label: 'Discover', href: '/discover', icon: '🧭', color: '#06b6d4' },
    { id: 'creator', label: 'Creator Studio', href: '/creator', icon: '✏️', color: '#a78bfa' },
    { id: 'dao', label: 'DAO', href: '/dao/create', icon: '🏛️', color: '#6366f1' },
    { id: 'creator-coins', label: 'Creator Coins', href: '/coins', icon: '🪙', color: '#f59e0b' },
    { id: 'leaderboard', label: 'Leaderboard', href: '/leaderboard', icon: '🏆', color: '#eab308' },
    { id: 'feeds', label: 'Feeds', href: '/feeds', icon: '📚', color: '#8b5cf6' },
    { id: 'pricing', label: 'Pricing', href: '/pricing', icon: '💎', color: '#22c55e' },
    { id: 'premium', label: 'Premium', href: '/premium', icon: '👑', color: '#fbbf24' },
    { id: 'status', label: 'Status', href: '/status', icon: '💚', color: '#10b981' },
    { id: 'settings', label: 'Settings', href: '/settings', icon: '⚙️', color: '#94a3b8' },
    { id: 'docs', label: 'Docs', href: '/docs', icon: '📖', color: '#64748b' },
    {
      id: 'protocol-guide',
      label: 'Protocol Guide',
      href: '/protocols',
      icon: '🗺️',
      color: '#8e30eb',
    },
    { id: 'about', label: 'About', href: '/about', icon: 'ℹ️', color: '#64748b' },
  ],
};

const SECTION_STORAGE_KEY = 'df_sidebar_sections';

/**
 * Protocol rows that duplicate a section feature link (e.g. the "Live" hub
 * vs the /feed/live protocol feed, or the "Newsletters" hub vs the
 * /feed/newsletter aggregator). The feature link covers the concept in the
 * sidebar; the underlying feed stays reachable via FeedShell and the quick
 * switcher, so we don't render the row twice.
 */
const FEATURE_DUPLICATE_PROTOCOL_IDS = new Set(['live', 'newsletter', 'podcast', 'rss']);

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
  const { ready, signedInProtocols, openSignIn, walletAddress, primaryIdentity } = useAuth();
  const { showToast } = useToast();
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);
  const { unreadCount } = useNotifications(hasSignedIn);
  const { total: chatUnread } = useChatUnread({ enabled: hasSignedIn });
  const { connections, healthyCount, loaded } = useProtocolConnections();

  /* ── Section collapse state (persisted) ──────────────────── */

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(collapsedSections));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [collapsedSections]);

  const isSectionCollapsed = (sid: SectionId) => collapsedSections[sid] === true;

  const toggleSection = (sid: SectionId) => {
    setCollapsedSections((prev) => ({ ...prev, [sid]: !prev[sid] }));
  };

  /* ── Protocol → section mapping ───────────────────────────── */

  const sectionProtocolIds = useMemo(() => {
    const map: Record<SectionId, string[]> = {
      social: [],
      video: [],
      audio: [],
      newsletters: [],
      discussion: [],
      markets: [],
      governance: [],
      reading: [],
      chat: [],
      tools: [],
    };
    for (const sid of SECTION_IDS) {
      map[sid] = [...(SECTION_PROTOCOLS[sid] ?? [])];
    }
    return map;
  }, []);

  const sectionHealthyCounts = useMemo(() => {
    const counts: Record<SectionId, number> = {
      social: 0,
      video: 0,
      audio: 0,
      newsletters: 0,
      discussion: 0,
      markets: 0,
      governance: 0,
      reading: 0,
      chat: 0,
      tools: 0,
    };
    for (const sid of SECTION_IDS) {
      counts[sid] = sectionProtocolIds[sid].filter(
        (id) => connections[id]?.status === 'healthy',
      ).length;
    }
    return counts;
  }, [sectionProtocolIds, connections]);

  /* ── Active-state helpers ─────────────────────────────────── */

  const isFeatureActive = (href: string) => {
    switch (href) {
      case '/feed':
        return (
          pathname === '/feed' ||
          pathname === '/home' ||
          pathname === '/home/all' ||
          pathname === '/'
        );
      case '/search':
        return pathname === '/search';
      case '/notifications':
        return pathname === '/notifications' || pathname.startsWith('/notifications/');
      case '/settings':
        return pathname === '/settings' || pathname.startsWith('/settings/');
      case '/status':
        return pathname === '/status';
      case '/pricing':
        return pathname === '/pricing';
      case '/news':
        return pathname === '/news' || pathname.startsWith('/news/');
      case '/c':
        return pathname === '/c' || pathname.startsWith('/c/');
      case '/dao/create':
        return pathname === '/dao' || pathname.startsWith('/dao/');
      default:
        return pathname === href || pathname.startsWith(`${href}/`);
    }
  };

  const isProtocolActive = (pid: string, route: string) => {
    return (
      pathname === route ||
      pathname.startsWith(`${route}/`) ||
      pathname === `/${pid}` ||
      pathname.startsWith(`/${pid}/`)
    );
  };

  const handleClick = () => {
    onNavClick?.();
  };

  /* ── Renders ──────────────────────────────────────────────── */

  const renderFeatureLink = (f: FeatureLink) => {
    const active = isFeatureActive(f.href);
    const showUnread = f.id === 'notifications' && unreadCount > 0;
    const isMessages = f.id === 'messages';
    const showChatUnread = isMessages && chatUnread > 0;
    return (
      <Link
        key={f.id}
        href={f.href}
        onClick={handleClick}
        className={`sidebar-nav-item ${active ? 'sidebar-nav-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span
          className="sidebar-nav-icon flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold"
          style={
            isMessages
              ? { backgroundColor: 'transparent' }
              : {
                  backgroundColor: active ? `${f.color}1a` : 'transparent',
                  color: active ? f.color : 'var(--color-muted)',
                }
          }
        >
          {isMessages ? <DegenChatLogo size={18} /> : f.icon}
        </span>
        <span className="sidebar-nav-label">{f.label}</span>
        {f.live && (
          <span
            role="img"
            aria-label="Live"
            title="Live"
            className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500"
          />
        )}
        {showChatUnread && (
          <span
            role="status"
            className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-degen-500 px-1.5 text-[11px] font-bold text-black"
            aria-label={`${chatUnread} unread chat messages`}
          >
            {chatUnread > 99 ? '99+' : chatUnread}
          </span>
        )}
        {showUnread && (
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
  };

  const renderProtocolRow = (pid: string) => {
    const conn = connections[pid];
    if (!conn) return null;
    const active = isProtocolActive(pid, conn.route);
    const healthy = conn.status === 'healthy';
    const down = conn.status === 'down';
    const unhealthy = conn.status === 'unhealthy';
    const dotClass = healthy
      ? 'bg-degen-500'
      : down
        ? 'bg-red-500'
        : unhealthy
          ? 'bg-yellow-500'
          : 'bg-[var(--color-muted)]';
    const dotLabel = healthy
      ? 'Healthy'
      : down
        ? 'Down'
        : unhealthy
          ? 'Low volume'
          : 'Not reported by bridge';
    return (
      <Link
        key={pid}
        href={conn.route}
        onClick={handleClick}
        className={`sidebar-nav-item ${active ? 'sidebar-nav-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span
          className="sidebar-nav-icon flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold"
          style={{
            backgroundColor: healthy ? `${conn.color}1a` : 'transparent',
            color: healthy ? conn.color : 'var(--color-muted)',
          }}
        >
          {conn.icon}
        </span>
        <span className="sidebar-nav-label">{conn.name}</span>
        <span
          role="img"
          className={`ml-auto h-2 w-2 shrink-0 rounded-full ${dotClass}`}
          aria-label={dotLabel}
          title={dotLabel}
        />
      </Link>
    );
  };

  const renderSection = (sid: SectionId) => {
    const meta = SECTION_META[sid];
    const isCollapsed = isSectionCollapsed(sid);
    const healthyCount = sectionHealthyCounts[sid];
    return (
      <div key={sid} className="mb-0.5">
        <button
          type="button"
          onClick={() => toggleSection(sid)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-[var(--color-overlay)]"
          style={{ color: 'var(--color-muted)' }}
          aria-expanded={!isCollapsed}
          aria-controls={`sidebar-section-${sid}`}
        >
          <span className="text-xs" aria-hidden="true">
            {meta.icon}
          </span>
          <span className="flex-1 text-left">{meta.label}</span>
          {healthyCount > 0 && (
            <span className="rounded-full bg-degen-500/15 px-1.5 text-[9px] font-bold text-degen-400">
              {healthyCount}
            </span>
          )}
          <ChevronIcon collapsed={isCollapsed} />
        </button>
        {!isCollapsed && (
          <div id={`sidebar-section-${sid}`} className="space-y-0.5 px-1">
            {SECTION_FEATURES[sid].map(renderFeatureLink)}
            {sectionProtocolIds[sid]
              .filter((id) => !FEATURE_DUPLICATE_PROTOCOL_IDS.has(id))
              .map(renderProtocolRow)}
          </div>
        )}
      </div>
    );
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
          className={`flex items-center rounded-full transition-colors hover:bg-[var(--color-overlay)] ${collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-3'}`}
          aria-label="DegenFeed Home"
        >
          <Image
            src="/degenfeedlogo.png"
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
        {collapsed ? (
          /* ── Mini-mode: the most important 5-6 icons ── */
          <>
            {/* Home */}
            <Link
              href="/feed"
              onClick={handleClick}
              className={`sidebar-nav-item justify-center px-0 ${isFeatureActive('/feed') ? 'sidebar-nav-active' : ''}`}
              aria-current={isFeatureActive('/feed') ? 'page' : undefined}
              title="Home"
            >
              <span className="sidebar-nav-icon">
                <HomeIcon active={isFeatureActive('/feed')} />
              </span>
            </Link>

            {/* Search (quick switcher) */}
            <button
              type="button"
              onClick={() => {
                handleClick();
                onQuickSwitcherOpen?.();
              }}
              className="sidebar-nav-item w-full justify-center px-0"
              title="Search"
            >
              <span className="sidebar-nav-icon">
                <SearchIcon />
              </span>
            </button>

            {/* Protocols */}
            <button
              type="button"
              onClick={() => {
                handleClick();
                onProtocolConnectOpen?.();
              }}
              className="sidebar-nav-item w-full justify-center px-0"
              title="Protocols"
            >
              <span className="sidebar-nav-icon">
                <ProtocolsIcon active={false} />
              </span>
            </button>

            {/* Notifications */}
            <Link
              href="/notifications"
              onClick={handleClick}
              className={`sidebar-nav-item relative justify-center px-0 ${isFeatureActive('/notifications') ? 'sidebar-nav-active' : ''}`}
              aria-current={isFeatureActive('/notifications') ? 'page' : undefined}
              title="Notifications"
            >
              <span className="sidebar-nav-icon">
                <NotifIcon active={isFeatureActive('/notifications')} />
              </span>
              {unreadCount > 0 && (
                <span
                  role="status"
                  className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-degen-500 px-1 text-[9px] font-bold text-black"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Messages — DegenChat */}
            <Link
              href="/messages"
              onClick={handleClick}
              className={`sidebar-nav-item relative justify-center px-0 ${isFeatureActive('/messages') ? 'sidebar-nav-active' : ''}`}
              aria-current={isFeatureActive('/messages') ? 'page' : undefined}
              title="Messages"
            >
              <span className="sidebar-nav-icon">
                <DegenChatLogo size={20} />
              </span>
              {chatUnread > 0 && (
                <span
                  role="status"
                  className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-degen-500 px-1 text-[9px] font-bold text-black"
                  aria-label={`${chatUnread} unread chat messages`}
                >
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              )}
            </Link>

            {/* Settings */}
            <Link
              href="/settings"
              onClick={handleClick}
              className={`sidebar-nav-item justify-center px-0 ${isFeatureActive('/settings') ? 'sidebar-nav-active' : ''}`}
              aria-current={isFeatureActive('/settings') ? 'page' : undefined}
              title="Settings"
            >
              <span className="sidebar-nav-icon">
                <SettingsIcon />
              </span>
            </Link>
          </>
        ) : (
          /* ── Full mode: primary + collapsible sections ── */
          <>
            {/* Home */}
            <Link
              href="/feed"
              onClick={handleClick}
              className={`sidebar-nav-item ${isFeatureActive('/feed') ? 'sidebar-nav-active' : ''}`}
              aria-current={isFeatureActive('/feed') ? 'page' : undefined}
            >
              <span className="sidebar-nav-icon">
                <HomeIcon active={isFeatureActive('/feed')} />
              </span>
              <span className="sidebar-nav-label">Home</span>
            </Link>

            {/* Protocols — opens connect flow */}
            <button
              type="button"
              onClick={() => {
                handleClick();
                onProtocolConnectOpen?.();
              }}
              className="sidebar-nav-item w-full"
            >
              <span className="sidebar-nav-icon">
                <ProtocolsIcon active={false} />
              </span>
              <span className="sidebar-nav-label">Protocols</span>
              <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-degen-500/15 px-1.5 text-[9px] font-bold text-degen-400">
                {loaded ? healthyCount : '—'}
              </span>
            </button>

            {/* Search (quick switcher) */}
            <button
              type="button"
              onClick={() => {
                handleClick();
                onQuickSwitcherOpen?.();
              }}
              className="sidebar-nav-item w-full"
            >
              <span className="sidebar-nav-icon">
                <SearchIcon />
              </span>
              <span className="sidebar-nav-label">Search</span>
              <kbd
                className="ml-auto rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none"
                style={{ color: 'var(--color-muted)' }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Divider */}
            <div className="my-2 border-t border-[var(--color-glass-border)]" />

            {/* Collapsible sections */}
            {SECTION_IDS.map(renderSection)}
          </>
        )}
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

      {/* Profile / Wallet at bottom — Sign In transforms into the user avatar */}
      <div
        className={`border-t border-[var(--color-glass-border)] ${collapsed ? 'px-1 py-2' : 'px-2 py-2'}`}
      >
        {!ready ? (
          <div
            className={`skeleton rounded-full ${collapsed ? 'h-10 w-10 mx-auto' : 'h-12 w-full'}`}
          />
        ) : hasSignedIn ? (
          <Link
            href="/profile"
            onClick={handleClick}
            className={`flex w-full items-center gap-2 rounded-full p-2 transition-colors hover:bg-[var(--color-overlay)] ${collapsed ? 'justify-center' : ''}`}
            aria-label={
              primaryIdentity?.displayName ? `Profile: ${primaryIdentity.displayName}` : 'Profile'
            }
            title={collapsed ? (primaryIdentity?.displayName ?? 'Profile') : undefined}
          >
            {primaryIdentity?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryIdentity.avatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-sm font-mono font-bold text-degen-400">
                {primaryIdentity?.displayName
                  ? primaryIdentity.displayName.slice(0, 2).toUpperCase()
                  : walletAddress
                    ? walletAddress.slice(2, 4).toUpperCase()
                    : 'DF'}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-sm font-semibold"
                  style={{ color: 'var(--color-fg)' }}
                >
                  {primaryIdentity?.displayName ??
                    primaryIdentity?.handle ??
                    (walletAddress
                      ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
                      : 'Signed in')}
                </div>
                <div className="truncate text-xs" style={{ color: 'var(--color-muted)' }}>
                  {healthyCount} protocol{healthyCount !== 1 ? 's' : ''} healthy
                </div>
              </div>
            )}
          </Link>
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
