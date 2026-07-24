'use client';

/**
 * @app/join/error — Error boundary for the join section.
 */

export default function JoinError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-red-900/40 bg-red-950/20 px-8 py-12 text-center backdrop-blur-sm">
        <span className="mb-4 text-4xl" aria-hidden="true">
          ⚠️
        </span>
        <h2 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Something went wrong</h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          {error.message ||
            'An unexpected error occurred while loading this page. Please try again.'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-degen-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400"
          >
            Try Again
          </button>
          <a
            href="/"
            className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
