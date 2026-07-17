/**
 * @degenfeed/ui — LoadingSkeleton
 *
 * Configurable skeleton loaders for common layouts: cards, list, grid, table.
 * All skeletons include `role="status"` and `aria-label` for accessibility.
 */

import { type FC, memo, useId } from 'react';

/* ─── Shared skeleton block ─── */

/**
 * GPU-accelerated shimmer pulse block.
 * Uses a CSS animation with `will-change: background-position` so the browser
 * promotes it to a compositor layer — zero main-thread cost.
 */
function Pulse({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

/* ─── Card Skeleton ────────────────────────────────────────── */

export interface CardSkeletonProps {
  /** Number of skeleton cards to render (default: 1) */
  count?: number;
  /** Show avatar circle (default: true) */
  avatar?: boolean;
  /** Number of text lines (default: 3) */
  lines?: number;
}

export const CardSkeleton: FC<CardSkeletonProps> = memo(function CardSkeleton({
  count = 1,
  avatar = true,
  lines = 3,
}) {
  const uid = useId();
  return (
    <output className="block" role="status" aria-label="Loading content">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`${uid}-card-${i}`}
          className="border-b border-[var(--color-glass-border)] px-4 py-3"
        >
          {avatar && (
            <div className="mb-3 flex items-center gap-3">
              <Pulse className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Pulse className="h-3 w-32" />
                <Pulse className="h-2.5 w-20" />
              </div>
            </div>
          )}
          <div className={avatar ? 'space-y-2' : 'space-y-2 pt-1'}>
            {Array.from({ length: lines }).map((_, j) => (
              <Pulse
                key={`line-${j}`}
                className={`h-3 ${j === lines - 1 ? 'w-3/4' : j === 0 ? 'w-full' : 'w-11/12'}`}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-4">
            <Pulse className="h-3 w-12" />
            <Pulse className="h-3 w-12" />
            <Pulse className="h-3 w-12" />
          </div>
        </div>
      ))}
    </output>
  );
});

/* ─── List Skeleton ────────────────────────────────────────── */

export interface ListSkeletonProps {
  /** Number of skeleton rows (default: 5) */
  count?: number;
  /** Show leading icon/avatar (default: true) */
  leading?: boolean;
  /** Show trailing element (default: false) */
  trailing?: boolean;
}

export const ListSkeleton: FC<ListSkeletonProps> = memo(function ListSkeleton({
  count = 5,
  leading = true,
  trailing = false,
}) {
  const uid = useId();
  return (
    <output className="block" role="status" aria-label="Loading list">
      <div className="divide-y divide-[var(--color-glass-border)]">
        {Array.from({ length: count }).map((_, i) => (
          <div key={`${uid}-list-${i}`} className="flex items-center gap-3 px-4 py-3.5">
            {leading && <Pulse className="h-10 w-10 shrink-0 rounded-full" />}
            <div className="flex-1 space-y-2">
              <Pulse className="h-3 w-40" />
              <Pulse className="h-2.5 w-56" />
            </div>
            {trailing && <Pulse className="h-5 w-14 shrink-0 rounded-full" />}
          </div>
        ))}
      </div>
    </output>
  );
});

/* ─── Grid Skeleton ────────────────────────────────────────── */

export interface GridSkeletonProps {
  /** Number of grid items (default: 6) */
  count?: number;
  /** Grid columns class (default: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3') */
  gridClass?: string;
}

export const GridSkeleton: FC<GridSkeletonProps> = memo(function GridSkeleton({
  count = 6,
  gridClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
}) {
  const uid = useId();
  return (
    <output className="block" role="status" aria-label="Loading grid">
      <div className={`grid gap-3 ${gridClass}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={`${uid}-grid-${i}`}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <div className="flex items-start gap-3">
              <Pulse className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Pulse className="h-4 w-3/4" />
                <Pulse className="h-3 w-1/2" />
                <div className="flex gap-2 pt-1">
                  <Pulse className="h-5 w-14 rounded-full" />
                  <Pulse className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </output>
  );
});

/* ─── Table Skeleton ───────────────────────────────────────── */

export interface TableSkeletonProps {
  /** Number of rows (default: 5) */
  rows?: number;
  /** Number of columns (default: 4) */
  cols?: number;
}

export const TableSkeleton: FC<TableSkeletonProps> = memo(function TableSkeleton({
  rows = 5,
  cols = 4,
}) {
  const uid = useId();
  return (
    <output className="block" role="status" aria-label="Loading table">
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {Array.from({ length: cols }).map((_, j) => (
                <th key={`${uid}-th-${j}`} className="px-4 py-3">
                  <Pulse className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={`${uid}-tr-${i}`} className="border-b border-[var(--color-border)]">
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={`${uid}-td-${i}-${j}`} className="px-4 py-3">
                    <Pulse className={`h-3 ${j === 0 ? 'w-32' : 'w-20'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </output>
  );
});

/* ─── Feed Skeleton (alias, backward-compat) ──────────────── */

export interface FeedSkeletonProps {
  count?: number;
}

export const FeedSkeleton: FC<FeedSkeletonProps> = memo(function FeedSkeleton({ count = 5 }) {
  return <CardSkeleton count={count} avatar lines={3} />;
});

/* ─── Spinner ──────────────────────────────────────────────── */

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const Spinner: FC<SpinnerProps> = memo(function Spinner({
  size = 'md',
  label = 'Loading',
}) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <div
      className="flex items-center justify-center"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <svg
        className={`animate-spin text-degen-500 ${sizeMap[size]}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
});
