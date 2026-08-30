'use client';

/**
 * @degenfeed/web — Premium feed empty state
 *
 * Shown when the timeline returns zero posts. Copy is per-tab and always
 * nudges toward the two recovery actions that actually populate a feed:
 * following protocols / accounts and exploring what's live right now.
 */

import Link from 'next/link';

const TAB_COPY: Record<string, { icon: string; title: string; body: string }> = {
  following: {
    icon: '👤',
    title: 'No posts from followed accounts',
    body: 'Follow some accounts to see their posts here, or switch to "For You" to discover new content across protocols.',
  },
  trending: {
    icon: '📈',
    title: 'Nothing trending right now',
    body: 'No trending posts at the moment. Check back soon or explore the live feed.',
  },
  'custom-mix': {
    icon: '🎛️',
    title: 'No posts match this mix',
    body: 'Your custom mix came up empty. Loosen the protocol weights or try another preset.',
  },
  news: {
    icon: '📰',
    title: 'No news posts yet — follow protocols',
    body: 'Nothing in the news feed yet. Follow protocols you care about, or switch tabs to see what the network is talking about.',
  },
};

export function FeedEmptyState({
  activeTab,
  onRefresh,
}: {
  activeTab: string;
  onRefresh?: () => void;
}) {
  const copy = TAB_COPY[activeTab] ?? {
    icon: '🏠',
    title: 'No posts yet — follow protocols',
    body: 'Your feed is quiet. Follow protocols you care about, or explore what the network is posting right now.',
  };
  return (
    <div className="card border-[var(--color-border)] bg-[var(--color-card)] py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
        <span className="text-2xl text-[var(--color-muted)]" aria-hidden="true">
          {copy.icon}
        </span>
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-[var(--color-fg)]">{copy.title}</h3>
      <p className="mx-auto mb-5 max-w-xs text-xs leading-relaxed text-[var(--color-muted)]">
        {copy.body}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRefresh && (
          <button type="button" onClick={onRefresh} className="btn-primary text-sm">
            Refresh
          </button>
        )}
        <Link
          href="/trending"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-semibold text-black transition-all hover:opacity-90 hover:shadow-[0_0_16px_var(--color-accent-glow)]"
        >
          Explore trending
        </Link>
        <Link
          href="/discover"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--color-border)] px-5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          Discover people
        </Link>
      </div>
    </div>
  );
}
