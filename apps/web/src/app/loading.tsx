// Root loading state — shows the actual landing page content immediately
// so users never see a spinner. The landing page is a server component
// that streams in the same RSC response; this loading skeleton is rendered
// only during the initial navigation to a new route (e.g. clicking a link).
import Link from 'next/link';

export default function RootLoading() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Simple static header while page loads */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/degenfeedlogo-nav.png" alt="DegenFeed" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/feed" className="rounded-lg bg-[#00ff41] px-4 py-2 text-sm font-semibold text-black">
              Open App
            </Link>
          </div>
        </div>
      </header>
      <div className="flex min-h-screen items-center justify-center pt-16">
        <div className="animate-pulse text-[#00ff41] text-lg font-semibold">Loading...</div>
      </div>
    </main>
  );
}
