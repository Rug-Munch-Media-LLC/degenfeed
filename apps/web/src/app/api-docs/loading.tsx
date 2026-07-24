export default function ApiDocsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <div
          className="mb-2 h-8 w-40 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
        <div
          className="h-4 w-64 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
        />
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((section) => (
          <div
            key={section}
            className="rounded-2xl border p-5 space-y-3"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <div
              className="h-6 w-48 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            />
            <div
              className="h-4 w-full animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
            />
            <div
              className="h-20 w-full animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.1 }}
            />
            <div
              className="h-4 w-3/4 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
