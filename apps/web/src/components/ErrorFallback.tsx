'use client';

/* === Error code helpers ===================================== */

let _errorCounter = 0;
function generateCode(): string {
  _errorCounter += 1;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DF-${rand}`;
}

/* === Friendly messages per error pattern ==================== */

const FRIENDLY_MESSAGES = [
  'Something hiccupped. Give it another shot.',
  'The tubes are clogged. Try refreshing.',
  'Looks like the server took a coffee break.',
  'A wild glitch appeared! Try again.',
  "Not on our watch. Let's retry that.",
  'The internet gremlins are at it again.',
];

const NETWORK_MESSAGES = [
  'Your connection seems spotty. Check your internet and try again.',
  "Can't reach our servers. Your Wi-Fi might be napping.",
  "Network hiccup! Things should work once you're back online.",
];

/* === ErrorFallback ========================================== */

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Page-specific title */
  title?: string;
  /** Page-specific message */
  message?: string;
  /** Icon emoji */
  icon?: string;
  /** Custom error code override */
  errorCode?: string;
}

/**
 * Reusable error fallback for per-page error.tsx files.
 * Provides friendly messages, error codes, retry, and report links.
 */
export function ErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  message,
  icon = '⚠',
  errorCode,
}: ErrorFallbackProps) {
  const code = errorCode ?? generateCode();
  const isNetworkError =
    error.message?.toLowerCase().includes('network') ||
    error.message?.toLowerCase().includes('fetch') ||
    error.message?.toLowerCase().includes('failed to') ||
    error instanceof TypeError;

  const friendlyMessage =
    message ??
    (isNetworkError
      ? NETWORK_MESSAGES[Math.floor(Math.random() * NETWORK_MESSAGES.length)]
      : FRIENDLY_MESSAGES[Math.floor(Math.random() * FRIENDLY_MESSAGES.length)]);

  // Log for debugging
  console.error(`[DegenFeed ${code}]`, error);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="card border-red-900/30 bg-red-950/20 py-12 text-center">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-2xl text-red-400">
          {icon}
        </div>

        <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">{title}</h2>

        <p className="mb-2 text-sm text-[var(--color-muted)] max-w-md mx-auto">{friendlyMessage}</p>

        {/* Suggested actions */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 1v6h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Try refreshing
          </span>
          <span className="text-[var(--color-glass-border)]" aria-hidden="true">
            ·
          </span>
          <span className="inline-flex items-center gap-1">
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
            Check your connection
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary text-sm">
            Try Again
          </button>
          <a
            href="/"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Go Home
          </a>
        </div>

        {/* Error code & report */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-[var(--color-muted)]">
          <span className="font-mono opacity-40" title={error.message}>
            {code}
          </span>
          <span className="opacity-20" aria-hidden="true">
            ·
          </span>
          <a
            href={`mailto:support@degenfeed.xyz?subject=Error%20${code}&body=What%20were%20you%20doing%3F%0A%0AError%3A%20${encodeURIComponent(error.message)}`}
            className="underline decoration-dotted underline-offset-2 opacity-50 hover:opacity-100 transition-opacity"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report this issue
          </a>
        </div>
      </div>
    </div>
  );
}

/* === ErrorCard (inline, for data sections) ================== */

interface ErrorCardProps {
  message?: string;
  onRetry?: () => void;
  /** Hide the full code, just show suggestion */
  compact?: boolean;
}

export function ErrorCard({ message = 'Could not load data', onRetry, compact }: ErrorCardProps) {
  const code = generateCode();

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <div className="mb-3 text-2xl text-red-400" aria-hidden="true">
        ⚠
      </div>

      <p className="mb-1 text-sm font-medium text-[var(--color-fg)]">{message}</p>

      <p className="mb-3 text-xs text-[var(--color-muted)]">
        This content is temporarily unavailable.
        {!compact && (
          <>
            <br />
            <span className="opacity-60">Try refreshing or check your connection.</span>
          </>
        )}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 active:scale-[0.97]"
        >
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
          Retry
        </button>
      )}

      {!compact && (
        <p className="mt-3 text-[10px] font-mono text-[var(--color-muted)] opacity-30">{code}</p>
      )}
    </div>
  );
}

/* === ErrorMessage (inline text, for forms/inputs) =========== */

interface ErrorMessageProps {
  message: string;
  /** Optional suggestion */
  suggestion?: string;
  /** Optional retry action */
  onRetry?: () => void;
}

export function ErrorMessage({ message, suggestion, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs">
      <span className="mt-0.5 shrink-0 text-red-400" aria-hidden="true">
        ⚠
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-red-300 font-medium">{message}</p>
        {suggestion && <p className="mt-0.5 text-[var(--color-muted)]">{suggestion}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
