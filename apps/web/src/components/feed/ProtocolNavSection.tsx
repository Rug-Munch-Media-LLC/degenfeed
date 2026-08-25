'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  CATEGORIES,
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_PROTOCOLS,
  PROTOCOL_LIST,
  type ProtocolCategory,
} from './feed-protocols';

// ── Protocol icon/color mapping ────────────────────────────────────

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

// ── Extra quick-link protocols ─────────────────────────────────────

const EXTRA_LINKS = [
  { id: 'discord', label: 'Discord', icon: '💬', color: '#5865f2', href: '/feed/discord' },
  { id: 'telegram', label: 'Telegram', icon: '✈', color: '#26a5e4', href: '/feed/telegram' },
  { id: 'github', label: 'GitHub', icon: '◉', color: '#6e40c9', href: '/feed/github' },
  { id: 'hive', label: 'Hive', icon: '◆', color: '#e31337', href: '/feed/hive' },
];

// ── SidebarLink sub-component ──────────────────────────────────────

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
      style={isActive ? { borderLeft: `3px solid ${color}`, marginLeft: '-3px' } : undefined}
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

// ── ProtocolNavSection ─────────────────────────────────────────────

export function ProtocolNavSection() {
  const pathname = usePathname();

  // ── Protocol search/filter ──────────────────────────────────────
  const [filter, setFilter] = useState('');

  // Stats for live indicators
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

  const renderProtocolLink = (pid: string) => {
    const meta = PROTOCOL_META[pid];
    if (!meta) return null;
    const isActive =
      pathname === meta.route ||
      pathname.startsWith(`${meta.route}/`) ||
      pathname === `/${pid}` ||
      pathname.startsWith(`/${pid}/`);
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

  // Filter protocols by label or id when the user types in the search box.
  const trimmedFilter = filter.trim().toLowerCase();
  const matchesFilter = (pid: string): boolean => {
    if (!trimmedFilter) return true;
    const meta = PROTOCOL_META[pid];
    if (!meta) return false;
    return (
      meta.label.toLowerCase().includes(trimmedFilter) || pid.toLowerCase().includes(trimmedFilter)
    );
  };

  return (
    <nav className="space-y-1 p-3" aria-label="Protocol navigation">
      {/* All / unified feed link */}
      <SidebarLink
        href="/feed"
        icon="◆"
        label="All Sources"
        color="#8b5cf6"
        isActive={pathname === '/feed'}
        count={totalPosts > 0 ? totalPosts : undefined}
        showDot={totalPosts > 0}
      />

      <div className="my-2 h-px bg-[var(--color-glass-border)]" />

      {/* Quick links section */}
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

      <div className="my-2 h-px bg-[var(--color-glass-border)]" />

      {/* Protocols grouped by category */}
      <div className="px-3 py-1">
        <span
          className="text-[9px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-muted)' }}
        >
          Protocols
        </span>
      </div>

      {/* Search/filter box */}
      <div className="px-1 pb-1">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-[var(--color-muted)] opacity-60">
            ⌕
          </span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search protocols…"
            aria-label="Search protocols"
            className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] py-1.5 pl-7 pr-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] placeholder:opacity-60 focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          />
        </div>
        {trimmedFilter && (
          <button
            type="button"
            onClick={() => setFilter('')}
            className="mt-1 text-[9px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Clear search ({countProtocolMatches(CATEGORY_PROTOCOLS, matchesFilter)})
          </button>
        )}
      </div>

      {CATEGORY_DISPLAY_ORDER.map((catId) => {
        const catInfo = CATEGORIES[catId];
        const protocolIds = CATEGORY_PROTOCOLS[catId];
        if (!protocolIds || protocolIds.length === 0) return null;

        const visibleIds = protocolIds.filter(matchesFilter);
        if (visibleIds.length === 0) return null;

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
            {visibleIds.map(renderProtocolLink)}
          </div>
        );
      })}

      <div className="my-2 h-px bg-[var(--color-glass-border)]" />

      {/* Live link */}
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
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: '#ef4444' }}
        />
      </Link>
    </nav>
  );
}

/** Count protocols that match the active filter across all categories. */
function countProtocolMatches(
  categoryProtocols: Record<string, string[]>,
  matches: (pid: string) => boolean,
): number {
  const seen = new Set<string>();
  for (const ids of Object.values(categoryProtocols)) {
    for (const id of ids) {
      if (matches(id)) seen.add(id);
    }
  }
  return seen.size;
}
