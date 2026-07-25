'use client';

export default function AudienceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <div className="card border-red-500/20 bg-red-500/5 py-12">
        <div className="mb-3 text-3xl text-red-400">!</div>
        <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">
          Failed to load audience data
        </h2>
        <p className="mb-4 text-sm text-[var(--color-muted)]">{error.message}</p>
        <button type="button" onClick={reset} className="btn-primary text-sm">
          Try again
        </button>
      </div>
    </div>
  );
}
