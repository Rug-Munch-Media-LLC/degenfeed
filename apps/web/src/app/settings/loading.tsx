export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <div className="mb-2 h-8 w-40 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
        <div className="h-4 w-56 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }} />
      </div>
      {[1, 2, 3, 4].map((section) => (
        <div key={section} className="mb-8 rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--color-glass-border)' }}>
          <div className="h-6 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }} />
          <div className="h-4 w-full animate-pulse rounded" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }} />
          <div className="h-10 w-full animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }} />
          <div className="h-10 w-3/4 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }} />
          <div className="flex gap-3">
            <div className="h-10 w-24 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }} />
            <div className="h-10 w-24 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
