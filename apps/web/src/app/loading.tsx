// Root loading state — shows landing page content immediately while JS hydrates
// Prevents the blue spinner from appearing on initial load
export default function RootLoading() {
  return (
    <div className="landing-page">
      <div className="mx-auto max-w-[1200px]">
        {/* Hero Section */}
        <section
          className="px-6 pb-20 pt-28 lg:pt-40 text-center"
          style={{ paddingTop: '7rem', paddingBottom: '5rem' }}
        >
          <h1
            className="mx-auto max-w-4xl text-4xl font-bold tracking-tight lg:text-6xl"
            style={{ fontFamily: 'Sora, sans-serif' }}
          >
            See what&apos;s happening in web3 right now.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-muted)]">
            Every network. One feed. Nostr, Farcaster, Lens, Bluesky, Mastodon, and more — all in
            one place.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <span className="inline-flex h-12 w-32 animate-pulse rounded-full bg-[var(--color-muted)]" />
            <span className="inline-flex h-12 w-40 animate-pulse rounded-full bg-[var(--color-muted)]" />
          </div>
        </section>

        {/* Stats Bar */}
        <section className="border-t border-[var(--color-border)] py-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-[var(--color-muted)]">
            <span>101+ Protocols</span>
            <span>319 RSS Sources</span>
            <span>137 Reddit Communities</span>
            <span>68 YouTube Channels</span>
          </div>
        </section>

        {/* Feature Grid Skeleton */}
        <section className="border-t border-[var(--color-border)] px-6 py-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6"
              >
                <div className="mb-3 h-8 w-8 animate-pulse rounded-lg bg-[var(--color-muted)]" />
                <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-[var(--color-muted)]" />
                <div className="h-4 w-full animate-pulse rounded bg-[var(--color-muted)]" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
