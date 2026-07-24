export default function FeaturesLoading() {
  return (
    <div className="landing-page">
      <div className="mx-auto max-w-[1200px]">
        <div className="features-hero">
          <div className="mx-auto max-w-2xl text-center">
            <div
              className="mb-4 h-12 w-3/4 animate-pulse rounded-lg mx-auto"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            />
            <div
              className="h-5 w-full animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
            />
          </div>
        </div>
        {[1, 2, 3].map((section) => (
          <div key={section} className="feature-detail-section">
            <div
              className="mb-4 h-8 w-64 animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.3 }}
            />
            <div
              className="mb-6 h-4 w-full animate-pulse rounded"
              style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((card) => (
                <div key={card} className="feature-detail-card">
                  <div
                    className="mb-2 h-5 w-32 animate-pulse rounded"
                    style={{ backgroundColor: 'var(--color-muted)', opacity: 0.25 }}
                  />
                  <div
                    className="h-4 w-full animate-pulse rounded"
                    style={{ backgroundColor: 'var(--color-muted)', opacity: 0.15 }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
