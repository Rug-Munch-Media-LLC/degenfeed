'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [code] = useState(() => {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `DF-${rand}`;
  });

  useEffect(() => {
    console.error('[DegenFeed fatal error]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
      {/* Premium error illustration */}
      <div className="mb-8 flex items-center justify-center">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          aria-hidden="true"
          className="opacity-80"
        >
          <rect
            x="8"
            y="8"
            width="64"
            height="64"
            rx="16"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.15"
          />
          <circle cx="40" cy="36" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <path
            d="M28 56c0-8 5-12 12-12s12 4 12 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.2"
          />
          <path
            d="M36 32l8 8M44 32l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.4"
          />
        </svg>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Something went wrong</h1>
      <p className="mb-2 text-sm text-[var(--color-muted)] max-w-sm leading-relaxed">
        An unexpected error occurred. Our team has been notified and is looking into it.
      </p>
      <p
        className="mb-8 text-xs text-[var(--color-muted)] opacity-50 font-mono"
        title={error.message}
      >
        {code}
      </p>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <button type="button" onClick={reset} className="btn-primary text-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
          Try Again
        </button>
        <Link href="/" className="btn-secondary text-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M1 8l7-6 7 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 6v7h3v-4h4v4h3V6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Go Home
        </Link>
      </div>

      <div className="mt-12 flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <Link
          href="/status"
          className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--color-fg)]"
        >
          System Status
        </Link>
        <span aria-hidden="true" className="opacity-30">
          ·
        </span>
        <a
          href="https://discord.gg/degenfeed"
          target="_blank"
          className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--color-fg)]"
          rel="noopener"
        >
          Get Help
        </a>
        <span aria-hidden="true" className="opacity-30">
          ·
        </span>
        <Link
          href="/faq"
          className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--color-fg)]"
        >
          FAQ
        </Link>
      </div>
    </div>
  );
}
