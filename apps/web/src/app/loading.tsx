// Root loading state — a content-shaped skeleton for the landing page.
// NEVER a raw spinner: even if a route's RSC stream is slow or a fetch
// hangs, the user sees a real page skeleton (header + hero + protocol
// grid + features + footer) instead of an infinite "orb". The landing
// page itself is static, so this skeleton is only visible during the
// initial stream / soft navigations to routes without their own
// loading.tsx, and it mirrors the landing layout to avoid layout shift.
import Link from 'next/link';

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--color-muted)] ${className ?? ''}`}
      style={{ opacity: 0.25 }}
      aria-hidden="true"
    />
  );
}

export default function RootLoading() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Static header while page loads */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/degenfeedlogo-nav.png" alt="DegenFeed" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/feed"
              className="rounded-lg bg-[#00ff41] px-4 py-2 text-sm font-semibold text-black"
            >
              Open App
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-16">
        {/* Hero skeleton — mirrors the landing hero */}
        <section className="flex flex-col items-center py-16 text-center">
          <SkeletonBlock className="h-20 w-20 rounded-2xl" />
          <SkeletonBlock className="mt-6 h-10 w-72 max-w-full sm:w-96" />
          <SkeletonBlock className="mt-3 h-4 w-64 max-w-full" />
          <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
          <div className="mt-8 flex items-center gap-3">
            <SkeletonBlock className="h-12 w-40" />
            <SkeletonBlock className="h-12 w-32" />
          </div>
        </section>

        {/* Protocols grid skeleton */}
        <section className="py-8">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="mt-3 h-8 w-72" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonBlock key={i} className="h-28 w-full" />
            ))}
          </div>
        </section>

        {/* Features skeleton */}
        <section className="py-8">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="mt-3 h-8 w-64" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonBlock key={i} className="h-40 w-full" />
            ))}
          </div>
        </section>

        {/* Footer skeleton */}
        <footer className="mt-8 border-t border-[#1a1a1a] py-8">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonBlock key={i} className="h-3 w-20" />
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
