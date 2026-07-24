'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function CommunityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const symbol = typeof params.symbol === 'string' ? params.symbol : '';

  useEffect(() => {
    console.error('[Community error]', error.message, error.stack);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center animate-page-enter">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10">
        <span className="text-4xl text-red-400" aria-hidden="true">
          ⚠
        </span>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Community not available</h1>
      <p className="mb-8 text-sm text-[var(--color-muted)]">
        Something went wrong loading the community hub.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <button type="button" onClick={reset} className="btn-primary">
          Try Again
        </button>
        {symbol && (
          <Link
            href={`/launch/${symbol}`}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Back to Coin
          </Link>
        )}
      </div>
    </div>
  );
}
