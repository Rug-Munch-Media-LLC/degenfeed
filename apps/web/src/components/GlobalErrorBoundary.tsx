'use client';

import Link from 'next/link';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Client boundary wrapper for the server-side layout.
 * Catches rendering errors in the entire app tree.
 *
 * Unlike the default "Something went wrong" fallback, this boundary:
 *  - keeps protocol navigation tabs visible so users can still move between
 *    feeds even when the current page blew up
 *  - offers a Retry button that resets the boundary (and re-fetches via
 *    `onReset` when the parent provides one)
 *  - surfaces the error code so support/debugging has a breadcrumb
 */

const ERROR_TABS: { id: string; label: string; href: string; color: string }[] = [
  { id: 'all', label: '◆ All', href: '/feed', color: '#10b981' },
  { id: 'nostr', label: '⚡ Nostr', href: '/feed/nostr', color: '#8e30eb' },
  { id: 'farcaster', label: '◈ Farcaster', href: '/feed/farcaster', color: '#8a63d2' },
  { id: 'lens', label: '🌿 Lens', href: '/feed/lens', color: '#abfe2c' },
  { id: 'bluesky', label: '🦋 Bluesky', href: '/feed/bluesky', color: '#1185fe' },
  { id: 'mastodon', label: '🐘 Mastodon', href: '/feed/mastodon', color: '#6364ff' },
  { id: 'lemmy', label: '☰ Lemmy', href: '/feed/lemmy', color: '#4ade80' },
  { id: 'rss', label: '📡 News', href: '/feed/rss', color: '#ffa500' },
];

export function GlobalErrorBoundary({
  children,
  onReset,
}: {
  children: React.ReactNode;
  /** Optional recovery callback (e.g. re-fetch feed data). */
  onReset?: () => void;
}) {
  return (
    <ErrorBoundary
      onReset={onReset}
      fallback={(error, reset) => (
        <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
          {/* Protocol tabs — keep navigation available even when a page crashed */}
          <nav
            aria-label="Protocol feeds"
            className="mb-8 flex max-w-full flex-wrap items-center justify-center gap-1.5"
          >
            {ERROR_TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: `${tab.color}14`,
                  color: tab.color,
                }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            <span className="text-3xl text-red-400" aria-hidden="true">
              ⚠
            </span>
          </div>
          <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">
            This part of the app hit a snag
          </h2>
          <p className="mb-2 max-w-md text-sm text-[var(--color-muted)]">
            The current view couldn&apos;t be rendered, but your feeds are still one tap away. Use
            the tabs above, or retry this page.
          </p>
          <p className="mb-6 text-[10px] font-mono text-[var(--color-muted)] opacity-40">
            {error.message?.slice(0, 120) || 'Unknown error'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                reset();
                onReset?.();
              }}
              className="rounded-lg bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-colors hover:bg-degen-500/30 active:scale-[0.97]"
            >
              Retry
            </button>
            <a
              href="/feed"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Go to feed
            </a>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
