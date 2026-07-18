import { HeaderSkeleton, Line, Badge } from '@/components/loading/PageSkeleton';

export default function PremiumLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <HeaderSkeleton titleWidth="w-48" subtitleWidth="w-72" />
      </div>

      {/* Pricing cards */}
      <div className="mb-10 grid gap-6 md:grid-cols-3">
        {['Free', 'Premium', 'Pro'].map((plan, i) => (
          <div
            key={plan}
            className={`rounded-3xl border p-6 space-y-5 ${
              i === 1 ? 'scale-105 border-degen-500/30' : ''
            }`}
            style={{ borderColor: i === 1 ? 'var(--color-glass-border)' : 'var(--color-glass-border)' }}
          >
            <div className="space-y-2">
              <Line width="w-20" height="h-5" />
              <Line width="w-32" height="h-8" />
              <Line width="w-40" height="h-3" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 animate-pulse rounded-full"
                    style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
                  />
                  <Line width="w-3/4" height="h-3" />
                </div>
              ))}
            </div>
            <div
              className="h-12 w-full animate-pulse rounded-xl"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            />
          </div>
        ))}
      </div>

      {/* Feature comparison */}
      <div className="mb-8">
        <Line width="w-40" height="h-5" />
      </div>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        {/* Table header */}
        <div
          className="flex items-center gap-4 px-6 py-4"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.1 }}
        >
          <div className="flex-1">
            <Line width="w-24" height="h-4" />
          </div>
          <Line width="w-16" height="h-4" />
          <Line width="w-16" height="h-4" />
          <Line width="w-16" height="h-4" />
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-t px-6 py-4"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <div className="flex-1">
              <Line width="w-40" height="h-4" />
            </div>
            <div className="flex justify-center w-16">
              <div
                className="h-4 w-4 animate-pulse rounded"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
              />
            </div>
            <div className="flex justify-center w-16">
              <div
                className="h-4 w-4 animate-pulse rounded"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
              />
            </div>
            <div className="flex justify-center w-16">
              <div
                className="h-4 w-4 animate-pulse rounded"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
