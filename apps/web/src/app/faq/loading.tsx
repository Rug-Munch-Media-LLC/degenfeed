export default function FaqLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <div
          className="mx-auto mb-2 h-8 w-48 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
        <div
          className="mx-auto h-4 w-64 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
        />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <div className="flex items-center justify-between">
              <div
                className="h-5 w-3/4 animate-pulse rounded"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
              />
              <div
                className="h-4 w-4 animate-pulse rounded"
                style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
