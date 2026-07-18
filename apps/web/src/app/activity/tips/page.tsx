'use client';

import { ErrorBoundary, TipActivityFeed } from '@degenfeed/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PLATFORM_LINKS = [
  { href: '/activity/tips', label: 'Tips', active: true },
  { href: '/leaderboard', label: 'Leaderboard', active: false },
] as const;

export default function TipsActivityPage() {
  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-fg)]">Tip Activity</h1>
            <p className="mt-1 text-xs text-gray-500">
              Live feed of tips across DegenFeed, Lemmy, and PeerTube
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="rounded-lg bg-degen-500/10 px-3 py-1.5 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/20"
          >
            Leaderboard →
          </Link>
        </div>

        {/* Platform nav */}
        <div className="mb-4 flex gap-2">
          {PLATFORM_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                l.active
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[var(--color-muted)]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Live feed */}
        <TipActivityFeed pollIntervalMs={15_000} limit={50} />
      </div>
    </ErrorBoundary>
  );
}
