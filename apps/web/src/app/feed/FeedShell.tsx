/**
 * @degenfeed/web — FeedShell layout wrapper
 *
 * Provides:
 *  - Mobile: horizontal scrollable protocol tabs with swipe gesture
 *  - Content area for feed pages
 *
 * The desktop left sidebar (global nav + protocol navigation) is rendered
 * once by the app Shell — FeedShell no longer renders its own sidebar to
 * avoid the double-menu effect on /feed/* routes.
 *
 * Wraps all /feed/* routes.
 */

'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  PROTOCOL_LIST,
  type ProtocolCategory,
  SIDEBAR_ORDER,
} from '../../components/feed/feed-protocols';
import { setLastProtocol } from '../../lib/protocolPreference';

// Bottom-sheet protocol picker — only needed when the user taps "More" on
// mobile. Lazy so the ~195-line sheet (and its imports) stays out of the
// initial /feed bundle.
const ProtocolSwitcherSheet = dynamic(
  () =>
    import('../../components/feed/ProtocolSwitcherSheet').then((m) => ({
      default: m.ProtocolSwitcherSheet,
    })),
  { ssr: false, loading: () => null },
);

// ─── Protocol icon/color mapping for tabs & indicator ─────────────────

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

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/feed/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        sources?: Record<string, SourceStat>;
      };
      if (data.sources) setSourceStats(data.sources);
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
  const [switcherOpen, setSwitcherOpen] = useState(false);

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

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-0 lg:flex-row"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
            prefetch
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
                prefetch
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
                prefetch
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
          {/* Open the full bottom-sheet protocol picker */}
          <button
            type="button"
            onClick={() => setSwitcherOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-glass-border)] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="All protocols"
            aria-haspopup="dialog"
          >
            <span aria-hidden="true">☰</span>
            <span>More</span>
          </button>
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

      {/* Mobile bottom-sheet protocol picker */}
      <ProtocolSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}
