import { AspectRatio, HeaderSkeleton, Line, Badge } from '@/components/loading/PageSkeleton';

export default function VideosLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <HeaderSkeleton titleWidth="w-32" subtitleWidth="w-64" />

      {/* Video grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden border"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <AspectRatio />
            <div className="p-4 space-y-2">
              <Badge width="w-14" />
              <Line width="w-full" height="h-4" />
              <Line width="w-3/4" height="h-3" />
              <div className="flex items-center gap-2 pt-1">
                <div
                  className="h-5 w-5 animate-pulse rounded-full"
                  style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
                />
                <Line width="w-24" height="h-3" />
              </div>
              <div className="flex gap-3 pt-1">
                <Line width="w-14" height="h-3" />
                <Line width="w-14" height="h-3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
