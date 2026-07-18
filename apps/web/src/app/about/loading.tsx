import { HeaderSkeleton, Line, Avatar } from '@/components/loading/PageSkeleton';

export default function AboutLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-10 text-center">
        <HeaderSkeleton titleWidth="w-48" subtitleWidth="w-64" />
      </div>

      {/* Mission */}
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-6 h-24 w-24 animate-pulse rounded-3xl"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }}
        />
        <Line width="w-3/4" height="h-5" />
        <Line width="w-full" height="h-4" />
        <Line width="w-full" height="h-4" />
        <Line width="w-2/3" height="h-4" />
      </div>

      {/* Stats */}
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="text-center space-y-2" key={i}>
            <Line width="w-16" height="h-8" />
            <Line width="w-20" height="h-3" />
          </div>
        ))}
      </div>

      {/* Team */}
      <div className="mb-8">
        <Line width="w-28" height="h-5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-3 rounded-2xl border p-6 text-center"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <Avatar size="h-20 w-20" />
            <div className="space-y-1">
              <Line width="w-24" height="h-4" />
              <Line width="w-20" height="h-3" />
            </div>
            <Line width="w-3/4" height="h-3" />
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="mb-8">
        <Line width="w-32" height="h-5" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className="h-4 w-4 animate-pulse rounded-full"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
              />
              {i < 3 && (
                <div
                  className="h-full w-px animate-pulse"
                  style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }}
                />
              )}
            </div>
            <div className="flex-1 pb-6 space-y-2">
              <Line width="w-24" height="h-4" />
              <Line width="w-full" height="h-3" />
              <Line width="w-3/4" height="h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
