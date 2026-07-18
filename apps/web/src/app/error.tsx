'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DegenFeed fatal error]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10">
        <span className="text-4xl text-red-400" aria-hidden="true">
          ⚠
        </span>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Something went wrong</h1>
      <p className="mb-8 text-sm text-[var(--color-muted)]">
        An unexpected error occurred. Our team has been notified.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <button type="button" onClick={reset} className="btn-primary">
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Go Home
        </Link>
      </div>
      <div className="mt-10 flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <Link href="/status" className="underline transition-colors hover:text-[var(--color-fg)]">
          System Status
        </Link>
        <span aria-hidden="true">·</span>
        <a
          href="https://discord.gg/degenfeed"
          target="_blank"
          className="underline transition-colors hover:text-[var(--color-fg)]"
          rel="noopener"
        >
          Get Help
        </a>
        <span aria-hidden="true">·</span>
        <Link href="/faq" className="underline transition-colors hover:text-[var(--color-fg)]">
          FAQ
        </Link>
      </div>
    </div>
  );
}
