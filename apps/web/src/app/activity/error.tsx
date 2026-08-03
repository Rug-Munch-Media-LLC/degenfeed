'use client';

export default function ActivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
        <span className="text-xl text-red-400">!</span>
      </div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Activity feed unavailable</h2>
      <p className="mb-6 text-sm text-[var(--color-muted)]">{error.message}</p>
      <button type="button" onClick={reset} className="btn-primary text-sm">
        Try Again
      </button>
    </div>
  );
}
