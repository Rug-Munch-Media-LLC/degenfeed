import { Avatar, HeaderSkeleton, Line } from '@/components/loading/PageSkeleton';

function LiveDotSkeleton() {
  return (
    <span className="relative flex h-2.5 w-2.5 items-center justify-center" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-40" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 opacity-60" />
    </span>
  );
}

function LiveCardSkeleton() {
  return (
    <div
      className="flex w-[300px] shrink-0 flex-col rounded-2xl border p-5"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      {/* Host row */}
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar size="h-9 w-9" />
        <div className="flex-1 space-y-1.5">
          <Line width="w-24" height="h-3" />
          <Line width="w-16" height="h-2" />
        </div>
      </div>
      {/* Title */}
      <Line width="w-3/4" height="h-4" />
      <div className="mt-2">
        <Line width="w-1/2" height="h-3" />
      </div>
      {/* Waveform placeholder */}
      <div className="mb-4 mt-3 flex gap-[2px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-3 w-[2px] animate-pulse rounded-full"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
          />
        ))}
      </div>
      {/* Join button */}
      <div
        className="mt-auto h-10 w-full animate-pulse rounded-xl"
        style={{ backgroundColor: 'var(--color-muted)', opacity: 0.1 }}
      />
    </div>
  );
}

function GridCardSkeleton() {
  return (
    <div
      className="flex flex-col rounded-2xl border p-5"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      <div className="mb-3 flex items-start gap-3">
        <Avatar size="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Line width="w-3/4" height="h-4" />
          <Line width="w-1/2" height="h-3" />
        </div>
      </div>
      <Line width="w-24" height="h-3" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        <div
          className="h-5 w-14 animate-pulse rounded-full"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
        />
        <div
          className="h-5 w-14 animate-pulse rounded-full"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
        />
      </div>
      <div
        className="mt-auto h-10 w-full animate-pulse rounded-xl"
        style={{ backgroundColor: 'var(--color-muted)', opacity: 0.1 }}
      />
    </div>
  );
}

export default function SpacesLoading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
          >
            <div
              className="h-5 w-5 animate-pulse rounded-full"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.5 }}
            />
          </div>
          <HeaderSkeleton titleWidth="w-32" subtitleWidth="w-56" />
        </div>
        <div
          className="h-10 w-36 animate-pulse rounded-xl"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
        />
      </div>

      {/* Live section */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <LiveDotSkeleton />
          <div
            className="h-4 w-24 animate-pulse rounded"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <LiveCardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Upcoming section */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <div
            className="h-4 w-4 animate-pulse rounded"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
          />
          <div
            className="h-4 w-28 animate-pulse rounded"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <GridCardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Recent section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div
            className="h-4 w-4 animate-pulse rounded"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
          />
          <div
            className="h-4 w-20 animate-pulse rounded"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <GridCardSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Bottom spacing */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
