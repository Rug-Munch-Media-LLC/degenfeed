'use client';

import Link from 'next/link';

interface FeedMeta {
  total?: number;
  limit?: number;
  perProtocol?: Record<string, number>;
  errors?: string[];
  notices?: string[];
  providerSources?: Record<string, string>;
  trending?: { topic: string; count: number; score: number }[];
  topOfHour?: string | null;
  fetchedAt?: number;
  personalization?: {
    hasProfile: boolean;
    boostApplied: boolean;
    isOnboarding: boolean;
    reasons?: string[];
  };
}

export function FeedLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-2.5 w-20" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedEmptyState({ activeTab }: { activeTab: string }) {
  return (
    <div className="card border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
        <span className="text-2xl text-[var(--color-muted)]">
          {activeTab === 'following' ? '👤' : activeTab === 'trending' ? '📈' : '🏠'}
        </span>
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-[var(--color-fg)]">
        {activeTab === 'following' ? 'No posts from followed accounts' : 'No posts yet'}
      </h3>
      <p className="mb-5 text-xs text-[var(--color-muted)] max-w-xs mx-auto">
        {activeTab === 'following'
          ? 'Follow some accounts to see their posts here, or switch to "For You" to discover new content.'
          : activeTab === 'trending'
            ? 'No trending posts right now. Check back soon or try a different feed.'
            : 'Your feed is empty. Try following some accounts or exploring trending topics.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
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

export function FeedErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card border-red-500/20 bg-red-500/5 py-12 text-center">
      <div className="mb-3 text-3xl text-red-400">!</div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Failed to load feed</h2>
      <p className="mb-4 text-sm text-[var(--color-muted)]">{error}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-primary text-sm">
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Non-blocking sign-in prompt shown above the public timeline.
 * Reading the feed never requires auth — signing in only unlocks
 * posting, engaging, and personalization.
 */
export function FeedAuthBanner({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section
      aria-label="Sign in to post and engage"
      className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4"
    >
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
          <span className="text-lg text-degen-400" aria-hidden="true">
            ◆
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-[var(--color-fg)]">DegenFeed</h1>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">
            Browsing the public timeline. Connect a wallet or sign in to post, like, and reply
            across protocols.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 text-sm"
        >
          Connect Wallet
        </button>
      </div>
    </section>
  );
}

export function FeedNewPostsBanner({ count, onRefresh }: { count: number; onRefresh: () => void }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="w-full rounded-xl border border-degen-500/20 bg-degen-500/5 py-2.5 text-xs font-medium text-degen-400 transition-all hover:bg-degen-500/10"
    >
      {count} new post{count !== 1 ? 's' : ''} available — tap to refresh
    </button>
  );
}

export function FeedProtocolSummary({ meta }: { meta?: FeedMeta }) {
  if (!meta?.perProtocol || Object.keys(meta.perProtocol).length === 0) return null;
  const fallbackSources = meta.providerSources ?? {};
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {Object.entries(meta.perProtocol).map(([protocol, count]) => {
        const protocolVar = `--color-protocol-${protocol}`;
        const fallbackColor = '#666';
        const source = fallbackSources[protocol];
        const isFallback = source === 'fallback' || source === 'cached';
        return (
          <span
            key={protocol}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
            style={{
              backgroundColor: `color-mix(in srgb, var(${protocolVar}, ${fallbackColor}) 15%, transparent)`,
              color: `var(${protocolVar}, ${fallbackColor})`,
            }}
          >
            {protocol} {count}
            {isFallback && (
              <span
                className="rounded-full bg-amber-500/10 px-1.5 text-[9px] font-medium text-amber-400"
                title={`${protocol} content is being served from a fallback source because the primary source is unavailable`}
              >
                via fallback
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
