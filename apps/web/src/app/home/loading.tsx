import { Avatar, Badge, Line } from '@/components/loading/PageSkeleton';

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Hero section */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          <div
            className="h-20 w-20 animate-pulse rounded-2xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
          />
        </div>
        <div className="mx-auto mb-3 space-y-2">
          <Line width="w-64" height="h-8" />
          <Line width="w-96" height="h-4" />
        </div>
        <div className="mx-auto flex justify-center gap-2">
          <Badge width="w-28" />
          <Badge width="w-28" />
        </div>
      </div>

      {/* Section tabs */}
      <div className="mb-6 flex gap-2 border-b pb-3" style={{ borderColor: 'var(--color-glass-border)' }}>
        {['For You', 'Following', 'Trending', 'Latest'].map((t) => (
          <div
            key={t}
            className="h-8 w-24 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Content sections grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border p-5"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              <Avatar size="h-10 w-10" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Line width="w-28" height="h-4" />
                  <Badge width="w-14" />
                  <Line width="w-16" height="h-3" />
                </div>
                <Line width="w-full" height="h-4" />
                <Line width="w-full" height="h-4" />
                <Line width="w-3/4" height="h-4" />
                <div className="flex items-center gap-6 pt-1">
                  <Line width="w-12" height="h-3" />
                  <Line width="w-12" height="h-3" />
                  <Line width="w-12" height="h-3" />
                  <Line width="w-12" height="h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <Line width="w-32" height="h-5" />
            <Line width="w-full" height="h-3" />
            <Line width="w-full" height="h-3" />
            <Line width="w-3/4" height="h-3" />
          </div>
          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <Line width="w-36" height="h-5" />
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="h-2 w-2 animate-pulse rounded-full"
                  style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
                />
                <Line width="w-full" height="h-3" />
              </div>
            ))}
          </div>
          <div
            className="h-40 w-full animate-pulse rounded-2xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
          />
        </aside>
      </div>
    </div>
  );
}
