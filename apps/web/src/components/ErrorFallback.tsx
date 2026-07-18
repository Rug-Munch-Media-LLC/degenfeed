'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Page-specific title */
  title?: string;
  /** Page-specific message */
  message?: string;
  /** Icon emoji */
  icon?: string;
}

/**
 * Reusable error fallback for per-page error.tsx files.
 * Provides a consistent error UI with "Try again" and "Go Home" buttons.
 */
export function ErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  icon = '⚠',
}: ErrorFallbackProps) {
  useEffect(() => {
    console.error(`[DegenFeed error] ${title}`, error);
  }, [error, title]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="card border-red-900/30 bg-red-950/20 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-2xl text-red-400">
          {icon}
        </div>
        <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">{title}</h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary text-sm">
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Data-specific error card for inline use (not as a page boundary).
 */
export function ErrorCard({
  message = 'Could not load data',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <div className="mb-3 text-2xl text-red-400" aria-hidden="true">
        ⚠
      </div>
      <p className="mb-1 text-sm font-medium text-[var(--color-fg)]">{message}</p>
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        This content is temporarily unavailable.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
        >
          Retry
        </button>
      )}
    </div>
  );
}
