import { Avatar, Badge, HeaderSkeleton, Line } from '@/components/loading/PageSkeleton';

export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <HeaderSkeleton titleWidth="w-40" subtitleWidth="w-52" />
        <Badge width="w-20" />
      </div>

      {/* Filter pills */}
      <div className="mb-6 flex gap-2">
        {['All', 'Mentions', 'Likes', 'Follows', 'Tips'].map((f) => (
          <div
            key={f}
            className="h-8 w-20 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        ))}
      </div>

      {/* Notification groups */}
      <div className="space-y-1">
        {/* Today group */}
        <Line width="w-16" height="h-4" />
        <div className="space-y-1 pl-2 mt-2 mb-6">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              key={i}
              className="flex items-start gap-3 rounded-xl border p-4"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              <div className="relative">
                <Avatar size="h-10 w-10" />
                {/* Notification type icon */}
                <div
                  className="absolute -bottom-1 -right-1 h-5 w-5 animate-pulse rounded-full border-2"
                  style={{
                    backgroundColor: 'var(--color-muted)',
                    opacity: 0.3,
                    borderColor: 'var(--color-bg)',
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Line width="w-48" height="h-4" />
                  <Line width="w-10" height="h-3" />
                </div>
                <Line width="w-full" height="h-3" />
                <Line width="w-2/3" height="h-3" />
              </div>
            </div>
          ))}
        </div>

        {/* Yesterday group */}
        <Line width="w-20" height="h-4" />
        <div className="space-y-1 pl-2 mt-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              key={`y-${i}`}
              className="flex items-start gap-3 rounded-xl border p-4"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              <Avatar size="h-10 w-10" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Line width="w-40" height="h-4" />
                <Line width="w-3/4" height="h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
