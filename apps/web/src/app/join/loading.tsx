/**
 * @app/join/loading — Loading state for the join section.
 */

export default function JoinLoading() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col lg:flex-row gap-4 p-4">
      {/* Player skeleton */}
      <div className="flex-1">
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-[var(--color-muted)]/10" />
        <div className="mt-4 space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--color-muted)]/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-muted)]/8" />
          <div className="flex gap-2 mt-3">
            <div className="h-8 w-20 animate-pulse rounded-xl bg-[var(--color-muted)]/8" />
            <div className="h-8 w-20 animate-pulse rounded-xl bg-[var(--color-muted)]/8" />
            <div className="h-8 w-28 animate-pulse rounded-xl bg-degen-500/10" />
          </div>
        </div>
      </div>
      {/* Chat skeleton */}
      <div className="w-full lg:w-80 xl:w-96">
        <div className="h-[500px] animate-pulse rounded-2xl bg-[var(--color-muted)]/10" />
      </div>
    </div>
  );
}
