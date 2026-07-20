'use client';

import { type ReactNode, Suspense, useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorCard } from './ErrorFallback';

interface SuspenseErrorProps {
  children: ReactNode;
  /** Skeleton to show while loading */
  fallback?: ReactNode;
  /** Error message when content fails */
  errorMessage?: string;
  /** Called when user clicks retry */
  onRetry?: () => void;
  /** Unique key to force remount on change */
  key?: string;
}

/* === Feed Skeleton (matches actual feed item layout) ======== */

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-feed-item" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="skeleton-avatar skeleton-shimmer" />
          <div className="skeleton-body">
            <div className="skeleton-line skeleton-line-lg skeleton-shimmer" />
            <div className="skeleton-line skeleton-line-sm skeleton-shimmer" />
            <div className="skeleton-line skeleton-line-xl skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* === Card Skeleton ========================================== */

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--color-glass-border)] p-5"
          style={{ backgroundColor: 'var(--color-card)' }}
        >
          <div className="mb-3 h-8 w-8 rounded-lg skeleton-shimmer" />
          <div className="mb-2 h-4 w-3/4 rounded skeleton-shimmer" />
          <div className="h-3 w-full rounded skeleton-shimmer" />
          <div className="mt-1 h-3 w-2/3 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

/* === Loading Timeout ======================================== */

function LoadingTimeout({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="loading-timeout">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="ml-1 text-[var(--color-muted)]">Still loading...</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="loading-retry">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8a5 5 0 019.9-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M13 3v4H9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Retry
        </button>
      )}
    </div>
  );
}

/* === SuspenseError ========================================== */

export function SuspenseError({
  children,
  fallback,
  errorMessage,
  onRetry,
  key,
}: SuspenseErrorProps) {
  const [stalled, setStalled] = useState(false);

  // Show "Still loading..." after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setStalled(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = useCallback(() => {
    setStalled(false);
    onRetry?.();
  }, [onRetry]);

  return (
    <ErrorBoundary
      key={key}
      fallback={(error, reset) => (
        <ErrorCard
          message={errorMessage ?? error.message ?? 'Could not load content'}
          onRetry={() => {
            reset();
            handleRetry();
          }}
        />
      )}
    >
      <Suspense
        fallback={
          <div className="space-y-4">
            {fallback ?? <FeedSkeleton count={3} />}
            {stalled && <LoadingTimeout onRetry={handleRetry} />}
          </div>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
