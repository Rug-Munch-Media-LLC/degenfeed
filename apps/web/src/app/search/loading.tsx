import { Avatar, Badge, Line } from '@/components/loading/PageSkeleton';

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Search bar */}
      <div className="mb-8">
        <div
          className="h-12 w-full animate-pulse rounded-2xl"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {['Top', 'Latest', 'People', 'Topics', 'Tokens'].map((t) => (
          <div
            key={t}
            className="h-8 w-20 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Results */}
      <div className="space-y-4">
        {/* People results */}
        <Line width="w-24" height="h-5" />
        <div className="grid gap-3 sm:grid-cols-2 mb-8">
          {Array.from({ length: 4 }, (_, i) => (
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
              </div>
            </div>
          ))}
        </div>

        {/* Post results */}
        <Line width="w-20" height="h-5" />
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border p-4"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              <Avatar size="h-8 w-8" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Line width="w-24" height="h-4" />
                  <Line width="w-16" height="h-3" />
                  <Line width="w-12" height="h-3" />
                </div>
                <Line width="w-full" height="h-3" />
                <Line width="w-full" height="h-3" />
                <Line width="w-2/3" height="h-3" />
                <div className="flex items-center gap-4 pt-1">
                  <Line width="w-12" height="h-3" />
                  <Line width="w-12" height="h-3" />
                  <Line width="w-12" height="h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
