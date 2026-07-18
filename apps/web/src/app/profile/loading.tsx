import { Avatar, Line, ListSkeleton, MetricCardSkeleton } from '@/components/loading/PageSkeleton';

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Profile card */}
      <div
        className="mb-8 overflow-hidden rounded-3xl border"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {/* Banner */}
        <div
          className="h-32 w-full animate-pulse sm:h-48"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }}
        />
        <div className="relative px-6 pb-6">
          {/* Avatar — offset to overlap banner */}
          <div className="relative -mt-12 mb-4">
            <Avatar size="h-24 w-24" />
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Line width="w-40" height="h-6" />
              <Line width="w-24" height="h-4" />
              <Line width="w-64" height="h-3" />
              <div className="flex items-center gap-4 pt-1">
                <Line width="w-24" height="h-3" />
                <Line width="w-24" height="h-3" />
                <Line width="w-24" height="h-3" />
              </div>
            </div>
            <div
              className="mt-4 h-10 w-28 animate-pulse rounded-xl sm:mt-0"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-2 border-b pb-3"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {['Posts', 'Replies', 'Likes', 'Bookmarks', 'Settings'].map((t) => (
          <div
            key={t}
            className="h-8 w-24 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Metrics */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, _i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Content */}
      <ListSkeleton count={6} />
    </div>
  );
}
