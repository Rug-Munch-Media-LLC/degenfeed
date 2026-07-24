export default function StatusLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <div
          className="mb-2 h-8 w-48 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
        <div
          className="h-4 w-64 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border p-5 space-y-3"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-4 w-4 animate-pulse rounded-full"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
              />
              <div
                className="h-5 w-32 animate-pulse rounded"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
              />
            </div>
            <div
              className="h-8 w-16 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
            />
            <div
              className="h-3 w-full animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
