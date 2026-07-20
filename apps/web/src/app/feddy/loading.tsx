export default function FeddyLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="mb-4 space-y-3">
          <div className="h-8 w-48 rounded bg-[var(--color-muted)]/20" />
          <div className="h-4 w-96 rounded bg-[var(--color-muted)]/10" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-[var(--color-muted)]/10" />
          ))}
        </div>
      </div>

      {/* Search skeleton */}
      <div className="mb-6 h-12 rounded-xl bg-[var(--color-muted)]/10" />

      {/* Category skeleton */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-[var(--color-muted)]/10" />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-[var(--color-muted)]/5" />
        ))}
      </div>
    </div>
  );
}
