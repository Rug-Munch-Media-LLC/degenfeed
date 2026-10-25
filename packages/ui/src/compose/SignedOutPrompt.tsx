'use client';

/**
 * @degenfeed/ui — composer gate for signed-out visitors.
 */

export function SignedOutPrompt() {
  return (
    <div className="py-12 text-center">
      <p className="mb-4 text-[var(--color-muted)]">Sign in to compose</p>
      <a
        href="/home"
        className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg)] transition hover:brightness-110"
      >
        Sign In
      </a>
    </div>
  );
}
