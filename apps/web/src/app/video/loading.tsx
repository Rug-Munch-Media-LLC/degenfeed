/**
 * @degenfeed/web — /video loading state
 *
 * Skeleton loading state for the video hub while data is being fetched.
 * Displays shimmer placeholders that match the Netflix-style layout.
 */

export default function VideoLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb skeleton */}
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-[var(--color-card)]" />

      {/* Category pills skeleton */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 animate-pulse rounded-full bg-[var(--color-card)]"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Hero skeleton */}
      <div className="mb-8 h-[360px] animate-pulse rounded-2xl bg-[var(--color-card)]" />

      {/* Row skeletons */}
      {[1, 2, 3].map((row) => (
        <div key={row} className="mb-8">
          <div
            className="mb-3 h-5 w-48 animate-pulse rounded bg-[var(--color-card)]"
            style={{ animationDelay: `${row * 100}ms` }}
          />
          <div className="flex gap-4">
            {Array.from({ length: 6 }).map((_, card) => (
              <div
                key={card}
                className="w-64 shrink-0 animate-pulse"
                style={{ animationDelay: `${(row * 6 + card) * 50}ms` }}
              >
                <div className="mb-2 aspect-video rounded-xl bg-[var(--color-card)]" />
                <div className="flex gap-2">
                  <div className="h-7 w-7 rounded-full bg-[var(--color-card)]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-[var(--color-card)]" />
                    <div className="h-2 w-1/2 rounded bg-[var(--color-card)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
