import { Avatar, Badge, HeaderSkeleton, Line } from '@/components/loading/PageSkeleton';

export default function LeaderboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <HeaderSkeleton titleWidth="w-48" subtitleWidth="w-56" />
        <div className="flex gap-2">
          <Badge width="w-20" />
          <Badge width="w-24" />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {['All Time', 'This Week', 'Today'].map((t) => (
          <div
            key={t}
            className="h-8 w-24 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Podium — top 3 */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {/* 2nd place */}
        <div className="flex flex-col items-center gap-3 pt-8">
          <Avatar size="h-14 w-14" />
          <Badge width="w-12" />
          <Line width="w-20" height="h-4" />
          <Line width="w-12" height="h-3" />
        </div>
        {/* 1st place */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-6 w-6 animate-pulse rounded"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
          <Avatar size="h-16 w-16" />
          <Badge width="w-14" />
          <Line width="w-24" height="h-4" />
          <Line width="w-16" height="h-3" />
        </div>
        {/* 3rd place */}
        <div className="flex flex-col items-center gap-3 pt-8">
          <Avatar size="h-14 w-14" />
          <Badge width="w-12" />
          <Line width="w-20" height="h-4" />
          <Line width="w-12" height="h-3" />
        </div>
      </div>

      {/* Table header */}
      <div
        className="mb-2 flex items-center gap-4 rounded-xl px-4 py-3"
        style={{ backgroundColor: 'var(--color-muted)', opacity: 0.1 }}
      >
        <Line width="w-6" height="h-4" />
        <Line width="w-32" height="h-4" />
        <Line width="w-20" height="h-4" />
        <Line width="w-16" height="h-4" />
        <Line width="w-20" height="h-4" />
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border px-4 py-3.5"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            {/* Rank */}
            <div
              className="h-6 w-6 animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            />
            {/* Avatar + name */}
            <div className="flex items-center gap-3 flex-1">
              <Avatar size="h-9 w-9" />
              <div className="flex-1 space-y-1">
                <Line width="w-32" height="h-4" />
                <Line width="w-20" height="h-3" />
              </div>
            </div>
            {/* Score */}
            <Line width="w-16" height="h-4" />
            {/* Posts */}
            <Line width="w-14" height="h-4" />
            {/* Engagement */}
            <Line width="w-20" height="h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
