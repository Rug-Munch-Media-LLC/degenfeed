export default function LaunchLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 animate-page-enter">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="skeleton h-10 w-48 rounded-lg mb-2" />
        <div className="skeleton h-5 w-96 rounded-lg" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <div className="skeleton h-3 w-20 rounded mb-2" />
            <div className="skeleton h-8 w-24 rounded" />
          </div>
        ))}
      </div>

      {/* Leaderboard skeleton */}
      <div className="mb-8">
        <div className="skeleton h-7 w-64 rounded-lg mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
