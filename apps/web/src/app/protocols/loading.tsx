import { HeaderSkeleton, Line } from '@/components/loading/PageSkeleton';

export default function ProtocolsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-10 text-center">
        <HeaderSkeleton titleWidth="w-48" subtitleWidth="w-64" />
      </div>

      {/* Protocol explainer cards */}
      <div className="space-y-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border p-6"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="h-10 w-10 animate-pulse rounded-xl"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
              />
              <div className="space-y-2">
                <Line width="w-32" height="h-5" />
                <Line width="w-48" height="h-3" />
              </div>
            </div>
            <Line width="w-full" height="h-4" />
            <Line width="w-full" height="h-4" />
            <Line width="w-5/6" height="h-4" />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {Array.from({ length: 3 }, (_, j) => (
                <div
                  key={j}
                  className="h-6 w-24 animate-pulse rounded-full"
                  style={{ backgroundColor: 'var(--color-muted)', opacity: 0.12 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
