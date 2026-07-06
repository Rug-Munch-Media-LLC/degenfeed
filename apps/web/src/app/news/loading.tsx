export default function NewsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 h-8 w-56 animate-pulse rounded-xl bg-gray-800" />
            <div className="h-4 w-72 animate-pulse rounded-lg bg-gray-800" />
          </div>
          <div className="h-4 w-32 animate-pulse rounded-lg bg-gray-800" />
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="h-10 flex-1 animate-pulse rounded-xl bg-gray-800" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-gray-800" />
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', 'bitcoin', 'ethereum', 'solana', 'defi', 'ai', 'security', 'nft'].map((c) => (
            <div key={c} className="h-7 w-16 animate-pulse rounded-full bg-gray-800" />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'].map((k) => (
              <div key={k} className="card animate-pulse p-4">
                <div className="mb-3 aspect-video w-full rounded-xl bg-gray-800" />
                <div className="mb-2 h-3 w-20 rounded-lg bg-gray-800" />
                <div className="mb-2 h-5 w-full rounded-lg bg-gray-800" />
                <div className="h-4 w-3/4 rounded-lg bg-gray-800" />
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card h-40 animate-pulse" />
          <div className="card h-56 animate-pulse" />
          <div className="card h-40 animate-pulse" />
        </aside>
      </div>
    </div>
  );
}
