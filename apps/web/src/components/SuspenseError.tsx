'use client';

import { Suspense, type ReactNode } from 'react';
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

/**
 * Combines Suspense + ErrorBoundary wrapper.
 * Shows skeleton while loading, error card on failure, retry button.
 * Wraps any child content.
 */
export function SuspenseError({
  children,
  fallback,
  errorMessage,
  onRetry,
  key,
}: SuspenseErrorProps) {
  return (
    <ErrorBoundary
      key={key}
      fallback={(error, reset) => (
        <ErrorCard
          message={errorMessage ?? error.message ?? 'Could not load content'}
          onRetry={() => {
            reset();
            onRetry?.();
          }}
        />
      )}
    >
      <Suspense
        fallback={
          fallback ?? (
            <div className="space-y-4 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl bg-[var(--color-card)]"
                />
              ))}
            </div>
          )
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
