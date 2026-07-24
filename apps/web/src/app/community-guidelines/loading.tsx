export default function CommunityGuidelinesLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div
          className="mb-2 h-8 w-56 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
        />
        <div
          className="h-4 w-32 animate-pulse rounded-lg"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
        />
      </div>
      <div className="space-y-6">
        {[1, 2, 3, 4, 5, 6].map((section) => (
          <div key={section} className="space-y-2">
            <div
              className="h-5 w-48 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
            />
            <div
              className="h-4 w-full animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }}
            />
            <div
              className="h-4 w-full animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
