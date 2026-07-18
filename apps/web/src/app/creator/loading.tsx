import {
  Avatar,
  HeaderSkeleton,
  Line,
  ListSkeleton,
  MetricCardSkeleton,
} from '@/components/loading/PageSkeleton';

export default function CreatorLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <HeaderSkeleton titleWidth="w-44" subtitleWidth="w-56" />
        <div
          className="h-10 w-36 animate-pulse rounded-xl"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
      </div>

      {/* Profile card */}
      <div
        className="mb-8 flex items-center gap-4 rounded-2xl border p-6"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <Avatar size="h-16 w-16" />
        <div className="flex-1 space-y-2">
          <Line width="w-40" height="h-5" />
          <Line width="w-24" height="h-4" />
          <Line width="w-64" height="h-3" />
        </div>
        <div
          className="h-10 w-28 animate-pulse rounded-xl"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
      </div>

      {/* Metrics grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-2 border-b pb-3"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {['Content', 'Analytics', 'Monetization', 'Schedule'].map((t) => (
          <div
            key={t}
            className="h-8 w-28 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Content dashboard sections */}
      <div className="mb-8">
        <Line width="w-32" height="h-5" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="rounded-2xl border p-5 space-y-3"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              <Line width="w-full" height="h-28" />
              <Line width="w-3/4" height="h-4" />
              <Line width="w-1/2" height="h-3" />
              <div className="flex items-center justify-between pt-2">
                <Line width="w-16" height="h-3" />
                <Line width="w-20" height="h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <Line width="w-36" height="h-5" />
        <div className="mt-4">
          <ListSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}
