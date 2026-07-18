import { Avatar, Badge, HeaderSkeleton, Line } from '@/components/loading/PageSkeleton';

export default function DiscoverLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <HeaderSkeleton titleWidth="w-40" subtitleWidth="w-64" />

      {/* Category cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border p-5 space-y-3"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center animate-pulse rounded-xl"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
              />
              <Line width="w-24" height="h-4" />
            </div>
            <Line width="w-full" height="h-3" />
            <Line width="w-3/4" height="h-3" />
            <Line width="w-16" height="h-3" />
          </div>
        ))}
      </div>

      {/* Trending creators */}
      <div className="mb-6">
        <Line width="w-36" height="h-5" />
      </div>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border p-4"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <Avatar size="h-12 w-12" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <Line width="w-28" height="h-4" />
                <Badge width="w-14" />
              </div>
              <Line width="w-full" height="h-3" />
              <Line width="w-3/4" height="h-3" />
              <div className="flex items-center gap-4 pt-1">
                <Line width="w-16" height="h-3" />
                <Line width="w-16" height="h-3" />
              </div>
            </div>
            <div
              className="h-8 w-20 animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            />
          </div>
        ))}
      </div>

      {/* Communities */}
      <div className="mb-6">
        <Line width="w-32" height="h-5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border p-5 space-y-3"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <div className="flex items-center gap-3">
              <Avatar size="h-12 w-12" />
              <div className="flex-1 space-y-1">
                <Line width="w-32" height="h-4" />
                <Line width="w-20" height="h-3" />
              </div>
            </div>
            <Line width="w-full" height="h-3" />
            <Line width="w-2/3" height="h-3" />
            <div className="flex items-center gap-3 pt-1">
              <Line width="w-24" height="h-3" />
              <Line width="w-16" height="h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
