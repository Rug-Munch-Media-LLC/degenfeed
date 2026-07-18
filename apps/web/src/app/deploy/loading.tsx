import { HeaderSkeleton, FormFieldSkeleton, Line } from '@/components/loading/PageSkeleton';

export default function DeployLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-8">
        <HeaderSkeleton titleWidth="w-44" subtitleWidth="w-64" />
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center justify-center gap-4">
        {['Select', 'Configure', 'Review', 'Deploy'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center animate-pulse rounded-full"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            >
              <Line width="w-3" height="h-3" />
            </div>
            <Line width="w-16" height="h-4" />
            {i < 3 && (
              <div
                className="h-px w-8 animate-pulse"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form card */}
      <div
        className="rounded-2xl border p-6 space-y-6"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <div className="space-y-1">
          <Line width="w-48" height="h-5" />
          <Line width="w-64" height="h-3" />
        </div>

        <FormFieldSkeleton />
        <FormFieldSkeleton />

        <div className="space-y-2">
          <Line width="w-28" height="h-3" />
          <div
            className="h-24 w-full animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        </div>

        <FormFieldSkeleton />

        {/* Toggle row */}
        <div className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--color-glass-border)' }}>
          <div className="space-y-1">
            <Line width="w-36" height="h-4" />
            <Line width="w-48" height="h-3" />
          </div>
          <div
            className="h-6 w-10 animate-pulse rounded-full"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        </div>

        {/* Cost estimate */}
        <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.1 }}>
          <div className="flex items-center justify-between">
            <Line width="w-24" height="h-4" />
            <Line width="w-16" height="h-4" />
          </div>
          <div className="flex items-center justify-between">
            <Line width="w-20" height="h-3" />
            <Line width="w-14" height="h-3" />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex items-center justify-between">
        <div
          className="h-10 w-28 animate-pulse rounded-xl"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
        <div className="flex gap-3">
          <div
            className="h-10 w-24 animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
          <div
            className="h-10 w-32 animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}
