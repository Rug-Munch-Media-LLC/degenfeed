'use client';

import Link from 'next/link';

export function FeddyHeader({
  totalCommunities,
  onCreateLink,
}: {
  totalCommunities: number;
  onCreateLink: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-degen-500/10 text-xl">
            🌐
          </span>
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/20 px-3 py-0.5">
              <span className="text-[9px] font-medium text-purple-400 uppercase tracking-wider">
                Feddy
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)] sm:text-3xl tracking-tight">
              Feddy Communities
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              ActivityPub-native communities that span the Fediverse. Create, join, and post across
              Mastodon, Pixelfed, Lemmy, and more.
            </p>
          </div>
        </div>

        <Link
          href={onCreateLink}
          className="shrink-0 rounded-xl bg-degen-500 px-5 py-2.5 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)]"
        >
          Create Community
        </Link>
      </div>

      {/* Quick stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
          <p className="text-lg font-bold text-degen-400">{totalCommunities}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Communities</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">16</p>
          <p className="text-[10px] text-[var(--color-muted)]">Categories</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">🌐</p>
          <p className="text-[10px] text-[var(--color-muted)]">ActivityPub</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
          <p className="text-lg font-bold text-purple-400">Premium</p>
          <p className="text-[10px] text-[var(--color-muted)]">To create</p>
        </div>
      </div>
    </div>
  );
}
