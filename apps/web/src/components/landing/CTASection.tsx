'use client';

import Link from 'next/link';

/**
 * CTASection — Final call to action. Bold wallet-connect prompt with privacy assurance.
 */

export function CTASection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 text-center md:py-28">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, var(--color-accent-glow) 0%, transparent 60%), radial-gradient(ellipse at 50% 80%, var(--color-accent-secondary-glow) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl">
        {/* Decorative icon */}
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl"
          style={{
            background: 'var(--color-accent-soft)',
            border: '1px solid rgba(0,255,65,0.2)',
            color: 'var(--color-accent)',
          }}
          aria-hidden="true"
        >
          ⚡
        </div>

        <h2
          className="mb-4 text-3xl font-black leading-tight md:text-5xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Ready to unify <span className="gradient-text">your social web?</span>
        </h2>

        <p
          className="mx-auto mb-8 max-w-lg text-base leading-relaxed md:text-lg"
          style={{ color: 'var(--color-fg-secondary)' }}
        >
          One feed. Every protocol. Your rules. Join thousands of users already bridging the
          decentralized social graph.
        </p>

        {/* Big CTA */}
        <Link
          href="https://app.degenfeed.xyz"
          className="btn-glow inline-flex items-center gap-3 px-10 py-4 text-lg font-bold"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Connect Wallet
        </Link>

        <p className="mt-4 text-sm" style={{ color: 'var(--color-muted)' }}>
          No email required. No phone number. Just your wallet.
        </p>

        {/* Trust indicators */}
        <div
          className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-4 text-xs"
          style={{ color: 'var(--color-muted)' }}
        >
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Non-custodial
          </span>
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Open source
          </span>
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            No tracking
          </span>
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Free forever
          </span>
        </div>
      </div>
    </section>
  );
}
