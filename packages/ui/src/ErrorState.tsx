/**
 * @degenfeed/ui — ErrorState
 *
 * Accessible error state with icon, message, retry button, and optional details.
 * Uses `role="alert"` and `aria-live="assertive"` for screen readers.
 */

import { type FC, memo, type ReactNode } from 'react';

export interface ErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Optional detailed error info (shown in smaller text) */
  details?: string;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Custom retry label (default: "Try again") */
  retryLabel?: string;
  /** Optional custom action element (replaces retry button if provided) */
  action?: ReactNode;
  /** Compact variant for inline use (less padding) */
  compact?: boolean;
  /** Optional icon override */
  icon?: string;
}

export const ErrorState: FC<ErrorStateProps> = memo(function ErrorState({
  message,
  details,
  onRetry,
  retryLabel = 'Try again',
  action,
  compact = false,
  icon,
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'px-4 py-6' : 'px-4 py-12'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
        {icon ? (
          <span className="text-2xl" aria-hidden="true">
            {icon}
          </span>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-red-400"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <p className="mb-1 text-sm font-medium text-red-300">
        {message || 'Something went wrong'}
      </p>
      {details && (
        <p className="mb-5 max-w-md text-xs text-[var(--color-muted)]">{details}</p>
      )}
      {action
        ? action
        : onRetry && (
            <button type="button" onClick={onRetry} className="btn-primary text-sm">
              {retryLabel}
            </button>
          )}
    </div>
  );
});

/* ─── Inline Error Banner ──────────────────────────────────── */

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorBanner: FC<ErrorBannerProps> = memo(function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: ErrorBannerProps) {
  return (
    <div
      className="mx-4 mb-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-red-400"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <p className="text-xs text-red-400 truncate">{message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs text-red-400 underline hover:text-red-300 underline-offset-2"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
