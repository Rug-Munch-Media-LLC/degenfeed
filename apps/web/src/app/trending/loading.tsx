import { HeaderSkeleton, Badge, Line, ListSkeleton } from '@/components/loading/PageSkeleton';

export default function TrendingLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <HeaderSkeleton titleWidth="w-40" subtitleWidth="w-60" />

      {/* Time filter tabs */}
      <div className="mb-6 flex gap-2">
        {['Now', 'Today', 'This Week', 'This Month'].map((t) => (
          <div
            key={t}
            className="h-8 w-24 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Trending topics grid */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border p-5 space-y-3"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <div className="flex items-center justify-between">
              <Line width="w-8" height="h-5" />
              <div className="flex gap-1">
                <Badge width="w-12" />
                <Badge width="w-14" />
              </div>
            </div>
            <Line width="w-4/5" height="h-5" />
            <Line width="w-full" height="h-3" />
            <Line width="w-2/3" height="h-3" />
            <div className="flex items-center gap-4 pt-2">
              <Line width="w-16" height="h-3" />
              <Line width="w-16" height="h-3" />
              <Line width="w-16" height="h-3" />
            </div>
          </div>
        ))}
      </div>

      {/* Trending posts section */}
      <div className="mb-4">
        <Line width="w-36" height="h-6" />
      </div>
      <ListSkeleton count={4} />
    </div>
  );
}
