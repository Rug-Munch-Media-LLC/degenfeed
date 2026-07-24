'use client';

import Link from 'next/link';

export default function VideoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-red-400"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="mb-2 text-xl font-bold text-[var(--color-fg)]">Something went wrong</h1>
      <p className="mb-6 text-sm text-[var(--color-muted)]">
        {error.message || "The video hub couldn't load properly."}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-degen-400"
        >
          Try again
        </button>
        <Link
          href="/feed"
          className="rounded-xl border border-[var(--color-glass-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Back to Feed
        </Link>
      </div>
    </div>
  );
}
