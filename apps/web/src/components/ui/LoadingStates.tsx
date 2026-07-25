'use client';

/* ─── Internal shimmer line ──────────────────────────────── */

function ShimmerLine({ width = '100%', height = '0.75rem' }: { width?: string; height?: string }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius: '0.375rem' }}
      aria-hidden="true"
    />
  );
}

/* ─── SkeletonText — configurable lines ─────────────────── */

interface SkeletonTextProps {
  lines?: number;
  widths?: string[];
  className?: string;
}

export function SkeletonText({ lines = 3, widths, className = '' }: SkeletonTextProps) {
  const effectiveWidths = widths ?? ['100%', '85%', '60%'];
  return (
    <div className={`space-y-2 ${className}`} role="presentation" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerLine key={i} width={effectiveWidths[i % effectiveWidths.length]} />
      ))}
    </div>
  );
}

/* ─── CardSkeleton — single card ────────────────────────── */

interface CardSkeletonProps {
  className?: string;
}

export function CardSkeleton({ className = '' }: CardSkeletonProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 ${className}`}
      role="status"
      aria-label="Loading card"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="skeleton-shimmer h-10 w-10 rounded-full" aria-hidden="true" />
        <div className="flex-1 space-y-2">
          <ShimmerLine width="40%" />
          <ShimmerLine width="25%" height="0.625rem" />
        </div>
      </div>
      <div className="space-y-2">
        <ShimmerLine />
        <ShimmerLine width="80%" />
        <ShimmerLine width="55%" />
      </div>
      <div className="mt-3 flex gap-4">
        <ShimmerLine width="3rem" height="0.625rem" />
        <ShimmerLine width="3rem" height="0.625rem" />
        <ShimmerLine width="3rem" height="0.625rem" />
      </div>
    </div>
  );
}

/* ─── FeedSkeleton — row of post skeletons ───────────────── */

interface FeedSkeletonProps {
  count?: number;
  className?: string;
}

export function FeedSkeleton({ count = 5, className = '' }: FeedSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading feed">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          style={
            {
              '--stagger-i': i,
              animationDelay: `${i * 60}ms`,
            } as React.CSSProperties
          }
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="skeleton-shimmer h-10 w-10 rounded-full shrink-0" aria-hidden="true" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <ShimmerLine width="30%" />
                <ShimmerLine width="15%" height="0.5rem" />
              </div>
              <ShimmerLine width="20%" height="0.625rem" />
            </div>
          </div>
          <div className="space-y-1.5 mb-3">
            <ShimmerLine />
            <ShimmerLine width="92%" />
            {i % 2 === 0 && (
              <div className="skeleton-shimmer mt-2 h-32 w-full rounded-lg" aria-hidden="true" />
            )}
          </div>
          <div className="flex items-center gap-6 pt-1">
            <ShimmerLine width="2.5rem" height="0.625rem" />
            <ShimmerLine width="2.5rem" height="0.625rem" />
            <ShimmerLine width="2.5rem" height="0.625rem" />
            <ShimmerLine width="2.5rem" height="0.625rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── GridSkeleton — grid of card skeletons ──────────────── */

interface GridSkeletonProps {
  count?: number;
  cols?: number;
  className?: string;
}

export function GridSkeleton({ count = 6, cols = 3, className = '' }: GridSkeletonProps) {
  return (
    <div
      className={`grid gap-4 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role="status"
      aria-label="Loading grid"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
        >
          <div className="skeleton-shimmer mb-3 h-32 w-full rounded-lg" aria-hidden="true" />
          <ShimmerLine width="70%" />
          <div className="mt-2">
            <ShimmerLine width="100%" />
            <ShimmerLine width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── PageSpinner — full page centered spinner ───────────── */

interface PageSpinnerProps {
  text?: string;
  subtext?: string;
  className?: string;
}

export function PageSpinner({ text, subtext, className = '' }: PageSpinnerProps) {
  return (
    <div
      className={`flex min-h-[60vh] flex-col items-center justify-center ${className}`}
      role="status"
      aria-label={text ?? 'Loading page'}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: 'var(--color-accent)',
            borderRightColor: 'var(--color-accent)',
          }}
        />
        <div
          className="absolute h-6 w-6 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderBottomColor: 'var(--color-accent-secondary)',
            borderLeftColor: 'var(--color-accent-secondary)',
            animationDuration: '0.8s',
            animationDirection: 'reverse',
          }}
        />
      </div>
      {text && (
        <p className="mt-4 text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
          {text}
        </p>
      )}
      {subtext && (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          {subtext}
        </p>
      )}
      <span className="sr-only">Loading{text ? `: ${text}` : ''}</span>
    </div>
  );
}

/* ─── InlineSpinner — small inline spinner ───────────────── */

interface InlineSpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function InlineSpinner({
  size = 18,
  className = '',
  label = 'Loading',
}: InlineSpinnerProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-label={label}
    >
      <span
        className="animate-spin rounded-full border-2 border-transparent"
        style={{
          width: size,
          height: size,
          borderTopColor: 'var(--color-accent)',
          borderRightColor: 'var(--color-accent)',
        }}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* ─── Default export ─────────────────────────────────────── */

const LoadingStates = {
  FeedSkeleton,
  CardSkeleton,
  GridSkeleton,
  PageSpinner,
  InlineSpinner,
  SkeletonText,
};

export default LoadingStates;
