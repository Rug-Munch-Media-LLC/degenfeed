import { Avatar, HeaderSkeleton, Line, Badge, AspectRatio } from '@/components/loading/PageSkeleton';

export default function SpacesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <HeaderSkeleton titleWidth="w-36" subtitleWidth="w-56" />
        <div
          className="h-10 w-32 animate-pulse rounded-xl"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
      </div>

      {/* Active now banner */}
      <div
        className="mb-6 flex items-center gap-3 rounded-2xl border p-4"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <div
          className="h-3 w-3 animate-pulse rounded-full"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
        <Line width="w-40" height="h-4" />
        <div className="flex -space-x-2 ml-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-8 animate-pulse rounded-full border-2 border-black"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* Space cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            {/* Banner */}
            <div
              className="h-24 w-full animate-pulse"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
            />
            <div className="p-4 space-y-3">
              {/* Host row */}
              <div className="flex items-center gap-3">
                <Avatar size="h-10 w-10" />
                <div className="flex-1 space-y-1.5">
                  <Line width="w-32" height="h-4" />
                  <Line width="w-20" height="h-3" />
                </div>
              </div>
              <Line width="w-full" height="h-4" />
              <Line width="w-3/4" height="h-3" />
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-3 w-3 animate-pulse rounded"
                    style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
                  />
                  <Line width="w-12" height="h-3" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-3 w-3 animate-pulse rounded"
                    style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
                  />
                  <Line width="w-16" height="h-3" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['tag1', 'tag2', 'tag3'].map((t) => (
                  <div
                    key={t}
                    className="h-5 w-16 animate-pulse rounded-full"
                    style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
