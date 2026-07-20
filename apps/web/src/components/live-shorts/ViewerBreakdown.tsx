'use client';

/**
 * ViewerBreakdown — Per-platform viewer counts with color-coded bars.
 *
 * Shows a compact horizontal bar chart of viewers grouped by protocol.
 * Each bar is proportional to the total and labeled with platform + count.
 */

import type { PlatformViewerCount } from './useLiveShorts';

interface ViewerBreakdownProps {
  counts: PlatformViewerCount[];
  total?: number;
  compact?: boolean;
}

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ViewerBreakdown({ counts, total, compact = false }: ViewerBreakdownProps) {
  if (counts.length === 0) return null;

  const maxCount = Math.max(...counts.map((c) => c.count), 1);
  const effectiveTotal = total ?? counts.reduce((s, c) => s + c.count, 0);

  if (compact) {
    return (
      <div className="flex items-center gap-1" role="list" aria-label="Viewers by platform">
        {counts.slice(0, 4).map((platform) => (
          <span
            key={platform.platform}
            className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[9px] font-medium"
            style={{ backgroundColor: `${platform.color}18`, color: platform.color }}
            title={`${platform.label}: ${formatViewers(platform.count)}`}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: platform.color }}
              aria-hidden="true"
            />
            {formatViewers(platform.count)}
          </span>
        ))}
        {counts.length > 4 && (
          <span className="text-[9px] text-[var(--color-muted)]">+{counts.length - 4}</span>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-1.5" aria-label="Viewer breakdown by platform">
      {counts.map((platform) => {
        const percentage = maxCount > 0 ? (platform.count / maxCount) * 100 : 0;
        return (
          <li key={platform.platform} className="flex items-center gap-2">
            <span className="w-20 truncate text-[10px] font-medium text-[var(--color-muted)]">
              {platform.label}
            </span>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-overlay)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%`, backgroundColor: platform.color }}
                  role="progressbar"
                  aria-valuenow={platform.count}
                  aria-valuemin={0}
                  aria-valuemax={effectiveTotal}
                  aria-label={`${platform.label}: ${formatViewers(platform.count)} viewers`}
                />
              </div>
            </div>
            <span className="w-14 text-right text-[10px] font-semibold tabular-nums text-[var(--color-fg)]">
              {formatViewers(platform.count)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
