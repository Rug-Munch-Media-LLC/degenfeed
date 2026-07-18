'use client';

import Link from 'next/link';
import { useRecentVisited } from '../hooks/useRecentVisited';

/**
 * "Recently visited" section for the sidebar.
 * Shows the last 5 pages the user visited with timestamps.
 */
export function RecentlyVisited() {
  const { recent, clearRecent } = useRecentVisited();

  if (recent.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--color-fg)]">Recently visited</h2>
        <button
          type="button"
          onClick={clearRecent}
          className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-muted)] transition-colors"
          aria-label="Clear recent pages"
        >
          Clear
        </button>
      </div>
      <ul className="space-y-1">
        {recent.slice(0, 5).map((page) => (
          <li key={`${page.href}-${page.timestamp}`}>
            <Link
              href={page.href}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:bg-white/5"
            >
              <span className="text-xs text-[var(--color-muted)]" aria-hidden="true">
                ·
              </span>
              <span className="truncate">{page.label}</span>
              <span className="ml-auto text-[10px] text-[var(--color-muted)]">
                {formatRelativeTime(page.timestamp)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
