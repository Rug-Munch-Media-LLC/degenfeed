/**
 * Landing page redirect or app entry point.
 * Unauthenticated users see the landing. Authenticated users go to /home.
 * For now, render the hero from the static landing inline.
 */

export default function HomePage() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-4">
      <section className="mx-auto max-w-3xl text-center">
        <div className="mb-6 text-sm font-medium uppercase tracking-widest text-degen-500">
          Open Beta
        </div>
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
          The social feed
          <br />
          of <span className="text-degen-500">web3</span>
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-lg text-gray-400">
          No account? Just browse. One key? Like & reply. Multiple keys? Cross-post all networks.
        </p>
        <div className="mb-12 flex flex-wrap items-center justify-center gap-4">
          <span className="rounded-full bg-gray-800 px-4 py-1.5 text-sm text-gray-400">Nostr</span>
          <span className="rounded-full bg-gray-800 px-4 py-1.5 text-sm text-gray-400">
            Farcaster
          </span>
          <span className="rounded-full bg-gray-800 px-4 py-1.5 text-sm text-gray-400">Lens</span>
          <span className="rounded-full bg-gray-800 px-4 py-1.5 text-sm text-gray-400">
            Bluesky
          </span>
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a href="/home" className="btn-primary text-base">
            Launch App
          </a>
          <a
            href="https://github.com/RugMunchMedia/degenfeed-web"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-base"
          >
            View on GitHub
          </a>
        </div>
      </section>
    </main>
  );
}
