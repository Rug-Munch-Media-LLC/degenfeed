'use client';

import Link from 'next/link';

interface LaunchCTAProps {
  className?: string;
}

export default function LaunchCTA({ className = '' }: LaunchCTAProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-degen-500/20 bg-gradient-to-br from-degen-500/10 via-[var(--color-card)] to-purple-500/10 p-5 sm:p-8 text-center ${className}`}
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-degen-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative">
        <div className="mx-auto mb-3 sm:mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-purple-500/20 touch-target">
          <span className="text-2xl sm:text-3xl">🚀</span>
        </div>
        <h2 className="text-xl font-bold text-[var(--color-fg)] sm:text-2xl">
          Launch Your Own Coin
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-[var(--color-muted)] sm:text-sm">
          Create your own creator coin with a fair prebonding curve. Set your parameters, share with
          your community, and watch it grow toward graduation.
        </p>
        <div className="mt-6 sm:mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/launch/create"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-degen-500 px-6 py-3.5 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] active:scale-[0.98] touch-target"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Launch Your Coin
          </Link>
          <Link
            href="/launch/create"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-6 py-3.5 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 hover:text-degen-400 touch-target"
          >
            Learn More
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
