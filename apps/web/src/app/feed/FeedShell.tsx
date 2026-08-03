/**
 * @degenfeed/web — FeedShell layout wrapper
 *
 * Provides:
 *  - Desktop: left sidebar with protocol list grouped by category + live indicators
 *  - Mobile: horizontal scrollable protocol tabs with swipe gesture
 *  - Content area for feed pages
 *
 * Wraps all /feed/* routes.
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  CATEGORIES,
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_PROTOCOLS,
  PROTOCOL_LIST,
  type ProtocolCategory,
  SIDEBAR_ORDER,
} from '../../components/feed/feed-protocols';

// ─── Protocol icon/color mapping for sidebar ─────────────────────────

const PROTOCOL_META: Record<
  string,
  { label: string; color: string; icon: string; route: string; category: ProtocolCategory }
> = {};
for (const p of PROTOCOL_LIST) {
  PROTOCOL_META[p.id] = {
    label: p.label,
    color: p.color,
    icon: p.icon,
    route: p.route,
    category: p.category,
  };
}

// ─── Extra quick-link protocols (non-feeds, linked externally) ────────

const EXTRA_LINKS = [
  { id: 'discord', label: 'Discord', icon: '💬', color: '#5865f2', href: '/feed/discord' },
  { id: 'telegram', label: 'Telegram', icon: '✈', color: '#26a5e4', href: '/feed/telegram' },
  { id: 'youtube', label: 'YouTube', icon: '▶', color: '#ff0000', href: '/feed/youtube' },
  { id: 'github', label: 'GitHub', icon: '◉', color: '#6e40c9', href: '/feed/github' },
  { id: 'hive', label: 'Hive', icon: '◆', color: '#e31337', href: '/feed/hive' },
];

interface FeedShellProps {
  children: ReactNode;
}

function SidebarLink({
  href,
  icon,
  label,
  color,
  isActive,
  count,
  showDot,
}: {
  href: string;
  icon: string;
  label: string;
  color: string;
  isActive: boolean;
  count?: number;
  showDot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-[var(--color-overlay)] text-[var(--color-fg)]'
          : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
      }`}
      style={
        isActive
          ? {
              borderLeft: `3px solid ${color}`,
              marginLeft: '-3px',
            }
          : undefined
      }
    >
      <span className="flex h-5 w-5 items-center justify-center text-xs" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] tabular-nums text-[var(--color-muted)] opacity-60">
          {count}
        </span>
      )}
      {showDot && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      )}
    </Link>
  );
}

export function FeedShell({ children }: FeedShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine the active protocol from the current path
  const activeProtocol = SIDEBAR_ORDER.find(
    (pid) => pathname === PROTOCOL_META[pid]?.route || pathname === `/feed/${pid}`,
  );
  const activeConfig = activeProtocol ? PROTOCOL_META[activeProtocol] : null;

  // ── Feed stats for live indicators ──
  interface SourceStat {
    count: number;
    label: string;
  }
  const [sourceStats, setSourceStats] = useState<Record<string, SourceStat> | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/feed/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        totalPosts?: number;
        sources?: Record<string, SourceStat>;
      };
      if (data.sources) setSourceStats(data.sources);
      if (typeof data.totalPosts === 'number') setTotalPosts(data.totalPosts);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // ── Mobile swipe state ──
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState(0);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0]?.clientX ?? 0);
    setTouchDelta(0);
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping) return;
      const currentX = e.touches[0]?.clientX ?? 0;
      setTouchDelta(currentX - touchStart);
    },
    [isSwiping, touchStart],
  );

  const handleTouchEnd = useCallback(() => {
    setIsSwiping(false);
    if (Math.abs(touchDelta) < 60) return;

    // Find current index
    const currentIdx = SIDEBAR_ORDER.indexOf(activeProtocol as (typeof SIDEBAR_ORDER)[number]);
    if (currentIdx === -1) return;

    if (touchDelta < 0 && currentIdx < SIDEBAR_ORDER.length - 1) {
      // Swipe left → next protocol
      const nextId: string | undefined = SIDEBAR_ORDER[currentIdx + 1];
      if (!nextId) return;
      const nextRoute = PROTOCOL_META[nextId]?.route;
      if (nextRoute) router.push(nextRoute);
    } else if (touchDelta > 0 && currentIdx > 0) {
      // Swipe right → previous protocol
      const prevId: string | undefined = SIDEBAR_ORDER[currentIdx - 1];
      if (!prevId) return;
      const prevRoute = PROTOCOL_META[prevId]?.route;
      if (prevRoute) router.push(prevRoute);
    }
    setTouchDelta(0);
  }, [touchDelta, activeProtocol, router.push]);

  // ── Route transition state ──
  const [transitioning, setTransitioning] = useState(false);
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      setTransitioning(false);
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  // ── Scroll active tab into view ──
  useEffect(() => {
    if (!tabsContainerRef.current) return;
    const activeEl = tabsContainerRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  // ── Helper: render a protocol link ──
  const renderProtocolLink = (pid: string) => {
    const meta = PROTOCOL_META[pid];
    if (!meta) return null;
    const isActive = pathname === meta.route;
    const stat = sourceStats?.[pid];
    return (
      <SidebarLink
        key={pid}
        href={meta.route}
        icon={meta.icon}
        label={meta.label}
        color={meta.color}
        isActive={isActive}
        count={stat?.count}
        showDot={stat && stat.count > 0}
      />
    );
  };

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-0 lg:flex-row"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden w-56 shrink-0 border-r lg:block"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <nav className="sticky top-16 space-y-1 p-3" aria-label="Protocol navigation">
          {/* All / unified feed link */}
          <SidebarLink
            href="/feed"
            icon="◆"
            label="All Sources"
            color="#00ff41"
            isActive={pathname === '/feed'}
            count={totalPosts > 0 ? totalPosts : undefined}
            showDot={totalPosts > 0}
          />

          <div className="h-px bg-[var(--color-glass-border)] my-2" />

          {/* ── Quick links (Messaging, Dev) ── */}
          <div className="px-3 py-1">
            <span
              className="text-[9px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-muted)' }}
            >
              Quick Links
            </span>
          </div>

          {EXTRA_LINKS.map((p) => {
            const isActive = pathname === p.href;
            return (
              <SidebarLink
                key={p.id}
                href={p.href}
                icon={p.icon}
                label={p.label}
                color={p.color}
                isActive={isActive}
              />
            );
          })}

          <div className="h-px bg-[var(--color-glass-border)] my-2" />

          {/* ── Protocols grouped by category ── */}
          <div className="px-3 py-1">
            <span
              className="text-[9px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-muted)' }}
            >
              Protocols
            </span>
          </div>

          {CATEGORY_DISPLAY_ORDER.map((catId) => {
            const catInfo = CATEGORIES[catId];
            const protocolIds = CATEGORY_PROTOCOLS[catId];
            if (!protocolIds || protocolIds.length === 0) return null;

            return (
              <div key={catId} className="mb-1">
                <div className="px-3 py-0.5">
                  <span
                    className="text-[8px] font-semibold uppercase tracking-widest opacity-50"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    {catInfo.icon} {catInfo.label}
                  </span>
                </div>
                {protocolIds.map(renderProtocolLink)}
              </div>
            );
          })}

          <div className="h-px bg-[var(--color-glass-border)] my-2" />

          {/* ── Live link ── */}
          <Link
            href="/feed/live"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === '/feed/live'
                ? 'bg-[var(--color-overlay)] text-[var(--color-fg)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
            }`}
            style={
              pathname === '/feed/live'
                ? { borderLeft: '3px solid #ef4444', marginLeft: '-3px' }
                : undefined
            }
          >
            <span className="flex h-6 w-6 items-center justify-center text-sm" aria-hidden="true">
              ●
            </span>
            <span className="flex-1 truncate">Live</span>
            <span
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
              style={{ backgroundColor: '#ef4444' }}
            />
          </Link>
        </nav>
      </aside>

      {/* ── Content area ── */}
      <main className="min-w-0 flex-1">
        {/* ── Mobile protocol tabs ── */}
        <div
          ref={tabsContainerRef}
          className="hide-scrollbar flex gap-1 overflow-x-auto border-b px-2 py-2 lg:hidden"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          <Link
            href="/feed"
            data-active={pathname === '/feed' ? 'true' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              pathname === '/feed'
                ? 'bg-degen-500/15 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] bg-[var(--color-overlay)]'
            }`}
          >
            ◆ All
          </Link>
          {SIDEBAR_ORDER.map((pid) => {
            const meta = PROTOCOL_META[pid];
            if (!meta) return null;
            const isActive = pathname === meta.route;
            return (
              <Link
                key={pid}
                href={meta.route}
                data-active={isActive ? 'true' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-[var(--color-fg)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] bg-[var(--color-overlay)]'
                }`}
                style={
                  isActive ? { backgroundColor: `${meta.color}18`, color: meta.color } : undefined
                }
              >
                <span aria-hidden="true">{meta.icon}</span>
                <span>{meta.label}</span>
              </Link>
            );
          })}
          {EXTRA_LINKS.map((p) => {
            const isActive = pathname === p.href;
            return (
              <Link
                key={p.id}
                href={p.href}
                data-active={isActive ? 'true' : undefined}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: isActive ? `${p.color}18` : 'var(--color-overlay)',
                  color: isActive ? p.color : 'var(--color-muted)',
                }}
              >
                <span aria-hidden="true">{p.icon}</span>
                <span>{p.label}</span>
              </Link>
            );
          })}
        </div>

        {/* ── Protocol indicator (mobile) ── */}
        {activeConfig && (
          <div
            className="flex items-center gap-2 px-4 py-2 lg:hidden"
            style={{ color: activeConfig.color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: activeConfig.color }}
            />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {activeConfig.label}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">— swipe between protocols</span>
          </div>
        )}

        {/* ── Child content with smooth route transitions ── */}
        <div
          className={`px-4 py-4 sm:px-6 transition-opacity duration-200 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
        >
          {children}
        </div>
      </main>

      {/* ── Right gutter ── */}
      <aside
        className="hidden w-56 shrink-0 border-l xl:block"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <div className="sticky top-16 space-y-4 p-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Protocol Mix
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              DegenFeed aggregates posts from {PROTOCOL_LIST.length} protocols into one unified
              timeline. Select a protocol above to view its feed.
            </p>
          </div>

          {/* Connected protocols indicator */}
          {sourceStats && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                Active Sources
              </p>
              <div className="mt-2 space-y-1.5">
                {Object.entries(sourceStats)
                  .filter(([, s]) => s.count > 0)
                  .slice(0, 8)
                  .map(([proto, stat]) => {
                    const meta = PROTOCOL_META[proto];
                    return (
                      <div key={proto} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: meta?.color ?? '#666' }}
                        />
                        <span className="flex-1 truncate text-[var(--color-muted)]">
                          {stat.label}
                        </span>
                        <span className="tabular-nums text-[var(--color-muted)] opacity-60">
                          {stat.count}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
