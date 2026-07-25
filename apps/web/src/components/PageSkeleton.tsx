'use client';

/**
 * Shared page loading skeleton — used by route loading.tsx files
 * and as fallback for dynamic() imports.
 *
 * Variants:
 *   - `type="page"` (default): full page skeleton with header + grid
 *   - `type="card"`: single card skeleton (for dynamic() fallback)
 *   - `type="list"`: list-style skeleton
 */

export function PageSkeleton({ variant = 'page' }: { variant?: 'page' | 'card' | 'list' }) {
  if (variant === 'card') {
    return (
      <div
        className="h-48 animate-pulse rounded-xl"
        style={{ backgroundColor: 'var(--color-card)' }}
      />
    );
  }

  if (variant === 'list') {
    return (
      <div className="animate-pulse space-y-3 p-6" role="status" aria-label="Loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl"
            style={{ backgroundColor: 'var(--color-card)' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-4 p-6" role="status" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg" style={{ backgroundColor: 'var(--color-card)' }} />
      <div className="h-4 w-96 rounded" style={{ backgroundColor: 'var(--color-card)' }} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl"
            style={{ backgroundColor: 'var(--color-card)' }}
          />
        ))}
      </div>
    </div>
  );
}
