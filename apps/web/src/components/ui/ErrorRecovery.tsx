'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

// === Types =================================================================

export type ErrorCategory = 'network' | 'wallet' | 'contract' | 'stream' | 'coin' | 'unknown';

export type RecoveryAction =
  | 'retry'
  | 'connect_wallet'
  | 'switch_network'
  | 'check_stream_key'
  | 'contact_support'
  | 'dismiss'
  | 'refresh'
  | 'add_funds';

export interface RecoverySuggestion {
  message: string;
  action: RecoveryAction;
  /** Label for the action button */
  actionLabel: string;
  /** Icon for the error type */
  icon: string;
  /** Whether this error is temporarily ignorable */
  dismissible: boolean;
  /** Secondary action label (e.g. "Learn More") */
  secondaryLabel?: string;
  /** Secondary action URL or callback */
  secondaryAction?: () => void;
}

export interface ErrorRecoveryProps {
  /** The error that occurred */
  error: Error | { message: string; category?: ErrorCategory };
  /** Called when the user triggers the recovery action */
  onRecover?: () => void;
  /** Called when the user dismisses the error */
  onDismiss?: () => void;
  /** Custom recovery suggestion (overrides auto-detection) */
  suggestion?: RecoverySuggestion;
  /** Optional title override */
  title?: string;
  /** Optional className for styling */
  className?: string;
  /** Compact mode for inline/in-card errors */
  compact?: boolean;
  /** Show a loading spinner while recovering */
  recovering?: boolean;
  /** Optional render prop for completely custom recovery UI */
  children?: (
    suggestion: RecoverySuggestion,
    recover: () => void,
    dismiss: () => void,
  ) => ReactNode;
  /** Auto-dismiss after this many ms (0 = no auto-dismiss) */
  autoDismissMs?: number;
}

// === Error Category Detection ==============================================

const CATEGORY_PATTERNS: Record<ErrorCategory, RegExp[]> = {
  network: [
    /network/i,
    /timeout/i,
    /timed\s*out/i,
    /fetch/i,
    /abort/i,
    /DNS/i,
    /ENOTFOUND/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /5\d{2}/,
    /429/,
    /rate\s*limit/i,
    /offline/i,
    /internet/i,
    /connection/i,
    /socket/i,
  ],
  wallet: [
    /wallet/i,
    /rejected/i,
    /denied/i,
    /insufficient/i,
    /wrong\s*network/i,
    /disconnected/i,
    /user\s*cancel/i,
    /provider.*not.*found/i,
    /no\s*wallet/i,
  ],
  contract: [
    /revert/i,
    /gas/i,
    /nonce/i,
    /contract/i,
    /execution/i,
    /already\s*known/i,
    /underpriced/i,
  ],
  stream: [
    /stream/i,
    /RTMP/i,
    /encoder/i,
    /bandwidth/i,
    /PeerTube/i,
    /broadcast/i,
    /ingest/i,
    /live.*error/i,
  ],
  coin: [
    /deploy/i,
    /coin/i,
    /vesting/i,
    /graduation/i,
    /bridge/i,
    /wormhole/i,
    /curve/i,
    /launch/i,
  ],
  unknown: [],
};

function detectCategory(message: string): ErrorCategory {
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS) as [
    ErrorCategory,
    RegExp[],
  ][]) {
    if (category === 'unknown') continue;
    for (const p of patterns) {
      if (p.test(message)) return category;
    }
  }
  // Check for TypeError specifically (fetch errors become TypeError)
  if (message.includes('TypeError') || message.includes('Failed to')) return 'network';
  return 'unknown';
}

// === Suggestion Factory ====================================================

function getSuggestion(category: ErrorCategory): RecoverySuggestion {
  switch (category) {
    case 'network':
      return {
        message:
          'Network connection issue. Your internet might be down or our servers are unreachable.',
        action: 'retry',
        actionLabel: 'Retry',
        icon: '📡',
        dismissible: true,
        secondaryLabel: 'Check Status',
      };
    case 'wallet':
      return {
        message: 'There was a problem with your wallet connection.',
        action: 'connect_wallet',
        actionLabel: 'Connect Wallet',
        icon: '👛',
        dismissible: true,
        secondaryLabel: 'Try Again',
      };
    case 'contract':
      return {
        message: 'A smart contract error occurred. This is usually temporary — try again.',
        action: 'retry',
        actionLabel: 'Retry Transaction',
        icon: '⚙️',
        dismissible: false,
        secondaryLabel: 'Contact Support',
      };
    case 'stream':
      return {
        message: 'Your stream encountered a technical issue.',
        action: 'check_stream_key',
        actionLabel: 'Check Settings',
        icon: '🎥',
        dismissible: false,
        secondaryLabel: 'Restart Stream',
      };
    case 'coin':
      return {
        message: "A coin operation didn't complete as expected. Your funds are safe.",
        action: 'retry',
        actionLabel: 'Try Again',
        icon: '🪙',
        dismissible: true,
        secondaryLabel: 'Contact Support',
      };
    default:
      return {
        message: 'Something unexpected happened. Give it another shot.',
        action: 'retry',
        actionLabel: 'Retry',
        icon: '⚠️',
        dismissible: true,
        secondaryLabel: 'Go Home',
      };
  }
}

// === Action Icon ===========================================================

function ActionIcon({ action }: { action: RecoveryAction }) {
  const paths: Record<RecoveryAction, string> = {
    retry: 'M13 3v4H9M3 8a5 5 0 019.9-1M16 8a5 5 0 01-9.9 1',
    connect_wallet: 'M12 4v16m-8-8h16',
    switch_network: 'M4 4h16v16H4zM8 8h8v8H8z',
    check_stream_key: 'M10 12h4v4m-2-6V6m0 12h0',
    contact_support:
      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4m0-4h.01',
    dismiss: 'M6 18L18 6M6 6l12 12',
    refresh: 'M1 4v6h6M23 20v-6h-6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
    add_funds: 'M12 4v16m-8-8h16',
  };

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[action]} />
    </svg>
  );
}

// === Main Component ========================================================

/**
 * ErrorRecovery — Contextual error recovery UI.
 *
 * Automatically detects the error category and shows appropriate
 * recovery actions. Integrates with the existing ErrorBoundary
 * and ErrorFallback components.
 *
 * Usage:
 * ```tsx
 * <ErrorRecovery
 *   error={error}
 *   onRecover={handleRetry}
 *   onDismiss={() => setShowError(false)}
 * />
 * ```
 *
 * For inline/compact use in cards or sections:
 * ```tsx
 * <ErrorRecovery error={error} compact onRecover={refetch} />
 * ```
 */
export function ErrorRecovery({
  error,
  onRecover,
  onDismiss,
  suggestion: forcedSuggestion,
  title: forcedTitle,
  className = '',
  compact = false,
  recovering = false,
  children,
  autoDismissMs = 0,
}: ErrorRecoveryProps) {
  const message = error?.message ?? String(error ?? 'Unknown error');
  const category =
    error && 'category' in error && error.category ? error.category : detectCategory(message);

  const suggestion = forcedSuggestion ?? getSuggestion(category);
  const title = forcedTitle ?? getTitleForCategory(category);

  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss
  useEffect(() => {
    if (autoDismissMs > 0 && !compact) {
      const timer = setTimeout(() => setDismissed(true), autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, compact]);

  const handleRecover = useCallback(() => {
    onRecover?.();
  }, [onRecover]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (dismissed) return null;

  // Render prop mode
  if (children) {
    return <>{children(suggestion, handleRecover, handleDismiss)}</>;
  }

  if (compact) {
    return (
      <div
        role="alert"
        className={`flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm ${className}`}
      >
        <span className="shrink-0 text-base mt-0.5" aria-hidden="true">
          {suggestion.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--color-fg)]">{suggestion.message}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleRecover}
              disabled={recovering}
              className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/20 disabled:opacity-50"
            >
              {recovering ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
              ) : (
                <ActionIcon action={suggestion.action} />
              )}
              {recovering ? 'Working...' : suggestion.actionLabel}
            </button>
            {suggestion.dismissible && (
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full size
  return (
    <div
      role="alert"
      className={`mx-auto max-w-md rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center ${className}`}
    >
      {/* Icon */}
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/10 text-2xl">
        <span aria-hidden="true">{suggestion.icon}</span>
      </div>

      {/* Title */}
      <h3 className="mb-1 text-lg font-bold text-[var(--color-fg)]">{title}</h3>

      {/* Message */}
      <p className="mb-4 text-sm text-[var(--color-muted)]">{suggestion.message}</p>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={handleRecover}
          disabled={recovering}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-500/15 px-5 py-2.5 text-sm font-semibold text-yellow-400 transition-all hover:bg-yellow-500/25 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {recovering ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
              Working...
            </span>
          ) : (
            <>
              <ActionIcon action={suggestion.action} />
              {suggestion.actionLabel}
            </>
          )}
        </button>

        {suggestion.secondaryLabel && (
          <button
            type="button"
            onClick={() => {
              if (suggestion.secondaryAction) {
                suggestion.secondaryAction();
              } else {
                window.location.href = '/';
              }
            }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            {suggestion.secondaryLabel}
          </button>
        )}

        {suggestion.dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-xl px-5 py-2.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

// === Title Helper ==========================================================

function getTitleForCategory(category: ErrorCategory): string {
  switch (category) {
    case 'network':
      return 'Connection Issue';
    case 'wallet':
      return 'Wallet Error';
    case 'contract':
      return 'Transaction Error';
    case 'stream':
      return 'Stream Error';
    case 'coin':
      return 'Coin Operation Failed';
    default:
      return 'Something Went Wrong';
  }
}

// === Inline Recovery Toast =================================================

interface RecoveryToastProps {
  error: Error | { message: string; category?: ErrorCategory };
  onRecover?: () => void;
  onDismiss?: () => void;
  /** Position of the toast */
  position?: 'top' | 'bottom';
  className?: string;
}

/**
 * RecoveryToast — A lightweight toast-style error recovery component.
 * Good for showing transient errors without blocking the UI.
 */
export function RecoveryToast({
  error,
  onRecover,
  onDismiss,
  position = 'top',
  className = '',
}: RecoveryToastProps) {
  const message = error?.message ?? String(error ?? 'Unknown error');
  const category =
    error && 'category' in error && error.category ? error.category : detectCategory(message);
  const suggestion = getSuggestion(category);
  const [visible, setVisible] = useState(true);

  const handleRecover = useCallback(() => {
    onRecover?.();
  }, [onRecover]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className={`fixed inset-x-4 z-50 flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-[var(--color-card)] p-4 shadow-lg backdrop-blur-sm ${
        position === 'top' ? 'top-4' : 'bottom-4'
      } ${className}`}
    >
      <span className="shrink-0 text-lg" aria-hidden="true">
        {suggestion.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--color-fg)] line-clamp-2">
          {suggestion.message}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleRecover}
          className="rounded-lg bg-yellow-500/15 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/25"
        >
          {suggestion.actionLabel}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-2 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// === Retry Button ==========================================================

interface RetryButtonProps {
  onRetry: () => void;
  label?: string;
  loading?: boolean;
  className?: string;
}

/**
 * RetryButton — A simple retry button with loading state.
 * Use inline where you need a minimal retry action.
 */
export function RetryButton({
  onRetry,
  label = 'Retry',
  loading = false,
  className = '',
}: RetryButtonProps) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-degen-500/10 px-3 py-1.5 text-xs font-semibold text-degen-400 transition-colors hover:bg-degen-500/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
      ) : (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
      )}
      {label}
    </button>
  );
}
