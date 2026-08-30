'use client';

/**
 * @degenfeed/web — Premium feed error state
 *
 * Shown when the unified feed AND every per-protocol fallback failed. Never a
 * silent empty — the visitor always gets the reason plus a one-tap retry.
 */

export function FeedErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div
      className="card border-red-500/20 bg-red-500/5 py-14 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="text-red-400"
          aria-hidden="true"
        >
          <path
            d="M10 6v5m0 3v.01M8.06 2.97 1.4 14.5a1.5 1.5 0 0 0 1.3 2.25h14.6a1.5 1.5 0 0 0 1.3-2.25L11.94 2.97a1.5 1.5 0 0 0-2.6 0Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">Failed to load feed</h2>
      <p className="mx-auto mb-5 max-w-xs text-xs leading-relaxed text-[var(--color-muted)]">
        {error}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-primary text-sm">
          Retry
        </button>
      )}
    </div>
  );
}
