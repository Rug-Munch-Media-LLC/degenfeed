'use client';

/**
 * KPICard — metric card with value, label, and trend indicator
 *
 * Displays a single KPI with a trend arrow (up/down/flat) and optional
 * tooltip explaining what the metric means.
 */

import type { ReactNode } from 'react';

interface KPICardProps {
  /** Metric label (e.g. "Total Earnings") */
  title: string;
  /** Formatted value (e.g. "$1,247", "847", "12.4K") */
  value: string;
  /** Change indicator — "+12%", "+34", "-5%", or null for N/A */
  change?: string | null;
  /** Optional subtext below the change */
  subtext?: string;
  /** Icon/emoji displayed on the left */
  icon?: string;
  /** Tooltip text explaining what this metric measures */
  tooltip?: string;
  /** Whether the card shows loading state */
  loading?: boolean;
  /** Optional action button */
  action?: ReactNode;
}

export function KPICard({
  title,
  value,
  change,
  subtext,
  icon,
  tooltip,
  loading = false,
  action,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-20 rounded bg-[var(--color-muted)]/20" />
          <div className="h-5 w-5 rounded bg-[var(--color-muted)]/20" />
        </div>
        <div className="h-7 w-28 rounded bg-[var(--color-muted)]/20 mb-1" />
        <div className="h-3 w-16 rounded bg-[var(--color-muted)]/20" />
      </div>
    );
  }

  // Determine trend direction
  let trendDir: 'up' | 'down' | 'flat' = 'flat';
  let trendColor = 'text-[var(--color-muted)]';
  if (change) {
    const numChange = Number.parseFloat(change.replace(/[^0-9.-]/g, ''));
    if (numChange > 0) {
      trendDir = 'up';
      trendColor = 'text-green-400';
    } else if (numChange < 0) {
      trendDir = 'down';
      trendColor = 'text-red-400';
    }
  }

  return (
    <div className="group relative rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-accent)]/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
          {icon && <span className="text-sm">{icon}</span>}
          {title}
        </span>

        {/* Tooltip trigger */}
        {tooltip && (
          <span
            className="relative flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-[var(--color-muted)]/10 text-[10px] text-[var(--color-muted)] hover:bg-[var(--color-muted)]/20 transition-colors"
            tabIndex={0}
            role="tooltip"
            aria-label={tooltip}
          >
            ?
            <span className="invisible group-hover:visible group-focus-within:visible absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-[11px] leading-relaxed text-[var(--color-muted)] shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              {tooltip}
            </span>
          </span>
        )}
      </div>

      <div className="text-2xl font-bold text-[var(--color-fg)] tracking-tight mb-1">{value}</div>

      <div className="flex items-center gap-1.5">
        {change !== null && change !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            {/* Trend arrow */}
            {trendDir === 'up' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            )}
            {trendDir === 'down' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
            {trendDir === 'flat' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
            {change}
          </span>
        )}
        {subtext && <span className="text-[10px] text-[var(--color-muted)]">{subtext}</span>}
      </div>

      {/* Optional action (e.g. "View all") */}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
