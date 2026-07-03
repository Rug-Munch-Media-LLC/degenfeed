/**
 * Home feed page. Shows the user's aggregated feed.
 *
 * Route: /home
 * State: feed (loading | loaded | error), identities (linked protocols)
 *
 * TODO(v1):
 *   - Wire up feed-core + ranking for real feed rendering
 *   - Add compose button that opens ComposeBox
 *   - Add protocol filter tabs (All, Nostr, Farcaster, Lens, Bluesky)
 *   - Add pull-to-refresh on mobile
 *   - Add infinite scroll
 *   - Show identity sidebar when signed in
 */

export default function HomeFeedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Top bar */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Feed</h1>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary" disabled>
            Compose
          </button>
          <button type="button" className="btn-ghost">
            Sign In
          </button>
        </div>
      </header>

      {/* Protocol filter tabs */}
      <nav className="mb-6 flex gap-1 rounded-lg bg-gray-900 p-1" role="tablist">
        {['All', 'Nostr', 'Farcaster', 'Lens', 'Bluesky'].map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
              ${tab === 'All' ? 'bg-degen-500 text-black' : 'text-gray-400 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Feed placeholder */}
      <div className="space-y-4">
        <div className="card">
          <p className="text-gray-500">
            Sign in with Nostr, Farcaster, Lens, or Bluesky to see your feed.
          </p>
        </div>
      </div>
    </div>
  );
}
