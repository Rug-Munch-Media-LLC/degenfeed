'use client';

export default function Offline() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <span className="text-2xl" role="img" aria-label="Satellite antenna">
          📡
        </span>
      </div>
      <h1 className="mb-2 text-xl font-bold">You&rsquo;re offline</h1>
      <p className="mb-4 text-muted-foreground">Check your connection and try again</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Retry
      </button>
    </div>
  );
}
