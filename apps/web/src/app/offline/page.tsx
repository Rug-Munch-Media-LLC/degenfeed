'use client';

export default function Offline() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--color-overlay)' }}
        >
          <span className="text-3xl" role="img" aria-label="Satellite dish">
            📡
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">You&rsquo;re offline</h1>
        <p className="mb-6 max-w-xs text-sm text-[var(--color-muted)]">
          Your connection dropped. Some features may be unavailable until you reconnect.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary text-sm"
          >
            Try again
          </button>
          <a href="/home" className="btn-secondary text-sm">
            Back to home
          </a>
        </div>
        <p className="mt-6 text-xs text-[var(--color-muted)]">
          DegenFeed works best with a stable internet connection. Cached content may still be
          available.
        </p>
      </div>
    </div>
  );
}
