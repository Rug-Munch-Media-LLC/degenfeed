'use client';

/**
 * @degenfeed/ui — OfflineState
 *
 * Full-page offline indicator with retry button.
 * Uses `role="status"` for accessibility.
 */

import { type FC, memo, useCallback, useState } from 'react';

export interface OfflineStateProps {
  /** Custom message (default: "You're offline") */
  message?: string;
  /** Custom description */
  description?: string;
  /** Called when the user clicks retry (default: checks navigator.onLine and reloads) */
  onRetry?: () => void;
}

export const OfflineState: FC<OfflineStateProps> = memo(function OfflineState({
  message = "You're offline",
  description = 'Check your connection and try again.',
  onRetry,
}: OfflineStateProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
      return;
    }
    setRetrying(true);
    // Default behavior: check connectivity and reload
    if (navigator.onLine) {
      window.location.reload();
    } else {
      // Wait for connection and retry
      const handler = () => {
        window.removeEventListener('online', handler);
        window.location.reload();
      };
      window.addEventListener('online', handler);
      // Fallback timeout
      setTimeout(() => {
        window.removeEventListener('online', handler);
        setRetrying(false);
      }, 15000);
    }
  }, [onRetry]);

  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-20"
      role="status"
      aria-label="Offline"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-yellow-400"
          aria-hidden="true"
        >
          <path d="M1 1l22 22" />
          <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
          <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0122.56 9" />
          <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
          <path d="M8.53 16.11a6 6 0 016.95 0" />
          <path d="M12 20h.01" />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">{message}</h3>
      <p className="mb-6 max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="btn-primary text-sm disabled:opacity-50"
      >
        {retrying ? 'Reconnecting…' : 'Try again'}
      </button>
    </div>
  );
});

/* ─── Offline Banner (compact, inline) ─────────────────────── */

export interface OfflineBannerProps {
  onRetry?: () => void;
}

export const OfflineBanner: FC<OfflineBannerProps> = memo(function OfflineBanner({
  onRetry,
}: OfflineBannerProps) {
  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    } else if (navigator.onLine) {
      window.location.reload();
    }
  }, [onRetry]);

  return (
    <div
      className="flex items-center justify-between gap-2 border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-2"
      role="status"
      aria-label="Offline"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-yellow-400" aria-hidden="true" />
        <span className="text-xs font-medium text-yellow-400">
          You're offline — some features may be unavailable
        </span>
      </div>
      <button
        type="button"
        onClick={handleRetry}
        className="text-xs text-yellow-400 underline hover:text-yellow-300 underline-offset-2"
      >
        Retry
      </button>
    </div>
  );
});
