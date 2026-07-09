import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'DegenFeed documentation — API reference, protocol integration, self-hosting, and architecture overview. Open-source web3 social aggregator.',
};

const apiEndpoints = [
  { method: 'GET', path: '/api/feed/home', desc: 'Home timeline. Aggregated and ranked feed across all enabled protocols.' },
  { method: 'GET', path: '/api/feed/trending', desc: 'Trending posts across all protocols. Sorted by engagement velocity.' },
  { method: 'GET', path: '/api/feed/news', desc: 'Curated news feed from RSS, Mastodon, and Bluesky sources.' },
  { method: 'GET', path: '/api/feed/rss.xml', desc: 'RSS feed of top DegenFeed posts. Subscribe in any RSS reader.' },
  { method: 'GET', path: '/api/feed/:protocol', desc: 'Per-protocol feed (nostr, farcaster, lens, bluesky, mastodon, threads, reddit, rss).' },
  { method: 'GET', path: '/api/feed/health', desc: 'Protocol health status. Latency and uptime per provider.' },
  { method: 'GET', path: '/api/feed/category/:cat', desc: 'Filtered feed by niche category (defi, nft, ai, gaming, etc.).' },
  { method: 'POST', path: '/api/publish', desc: 'Cross-post to connected protocols. Requires wallet authentication.' },
  { method: 'POST', path: '/api/engage', desc: 'Like, reply, or repost. Protocol-native signing per platform.' },
  { method: 'GET', path: '/api/search', desc: 'Cross-protocol search. Query params: q, protocol, limit.' },
  { method: 'GET', path: '/api/account/export', desc: 'Export all your data. GDPR-compliant data portability.' },
  { method: 'POST', path: '/api/account/delete', desc: 'Permanently delete your account and all associated data.' },
  { method: 'POST', path: '/api/newsletter/subscribe', desc: 'Subscribe to the daily digest newsletter. Optional topic preferences.' },
  { method: 'GET', path: '/api/newsletter/digest', desc: 'Preview the latest daily digest.' },
  { method: 'POST', path: '/api/tip/create', desc: 'Create a crypto tip (ETH, SOL, USDC). Returns transaction payload.' },
];

const protocols = [
  { name: 'Nostr', endpoint: 'wss://relay.damus.io', auth: 'nsec key', type: 'Decentralized relays' },
  { name: 'Farcaster', endpoint: 'hub.farcaster.standardcrypto.vc:2281', auth: 'Signer key', type: 'Hubs + on-chain registry' },
  { name: 'Lens', endpoint: 'api.lens.xyz/graphql', auth: 'Wallet sign-in', type: 'Polygon smart contracts' },
  { name: 'Bluesky', endpoint: 'public.api.bsky.app', auth: 'App password', type: 'AT Protocol PDS' },
  { name: 'Mastodon', endpoint: 'social.degenfeed.xyz', auth: 'OAuth token', type: 'ActivityPub federation' },
  { name: 'Threads', endpoint: 'threads.net (public HTML)', auth: 'None (read-only)', type: 'Meta ActivityPub + scraping' },
  { name: 'Reddit', endpoint: 'reddit.com/.rss', auth: 'None (RSS)', type: 'RSS feed scraping' },
  { name: 'RSS', endpoint: 'Any feed URL', auth: 'None', type: 'Syndication standard' },
];

const selfHostSteps = [
  { title: 'Clone the repo', cmd: 'git clone https://git.rugmunch.io/RugMunchMedia/degenfeed-web.git && cd degenfeed-web' },
  { title: 'Install dependencies', cmd: 'pnpm install' },
  { title: 'Configure environment', cmd: 'cp .env.example .env && $EDITOR .env' },
  { title: 'Start development server', cmd: 'pnpm dev' },
  { title: 'Build for production', cmd: 'pnpm build' },
  { title: 'Deploy to Cloudflare', cmd: 'npx wrangler pages deploy apps/web --project-name degenfeed-web' },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-sm leading-relaxed text-gray-300">
      <h1 className="mb-2 text-3xl font-bold text-white">Documentation</h1>
      <p className="mb-8 text-gray-500">
        Everything you need to know about DegenFeed — the open-source web3 social aggregator.
      </p>

      <nav className="mb-10 flex flex-wrap gap-3 text-sm">
        {['Quick start', 'Protocols', 'API reference', 'Self-hosting', 'Architecture', 'More resources'].map((s) => (
          <a key={s} href={`#${s.toLowerCase().replace(/\s+/g, '-')}`} className="rounded-full bg-gray-900 px-3 py-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white">{s}</a>
        ))}
      </nav>

      {/* Quick start */}
      <section id="quick-start" className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-white">Quick start</h2>
        <div className="space-y-4">
          <p>
            DegenFeed is a multi-protocol social aggregator that pulls public posts from 8 networks into one unified timeline.
            <strong className="text-white"> No account is needed to browse.</strong> Connect your wallet to like, reply, cross-post, and tip.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <a href="https://app.degenfeed.xyz" className="card block transition-colors hover:border-degen-500/30">
              <h3 className="font-semibold text-white">Open the web app</h3>
              <p className="mt-1 text-gray-500">Browse all feeds immediately. Zero sign-up.</p>
              <span className="mt-2 inline-block text-degen-400">app.degenfeed.xyz →</span>
            </a>
            <a href="https://social.degenfeed.xyz" target="_blank" rel="noopener" className="card block transition-colors hover:border-degen-500/30">
              <h3 className="font-semibold text-white">Get a handle</h3>
              <p className="mt-1 text-gray-500">Free @degenfeed.xyz Mastodon account. Federates with the entire Fediverse.</p>
              <span className="mt-2 inline-block text-degen-400">social.degenfeed.xyz →</span>
            </a>
          </div>
        </div>
      </section>

      {/* Protocols */}
      <section id="protocols" className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-white">Supported protocols</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="pb-2 pr-4 font-medium">Protocol</th>
                <th className="pb-2 pr-4 font-medium">Endpoint</th>
                <th className="pb-2 pr-4 font-medium">Authentication</th>
                <th className="pb-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {protocols.map((p) => (
                <tr key={p.name} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4 font-medium text-white">{p.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-500">{p.endpoint}</td>
                  <td className="py-2 pr-4 text-gray-400">{p.auth}</td>
                  <td className="py-2 text-gray-400">{p.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* API reference */}
      <section id="api-reference" className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-white">API reference</h2>
        <p className="mb-4 text-gray-500">
          All endpoints are served from <code className="rounded bg-gray-900 px-1.5 py-0.5 text-xs text-degen-400">degenfeed.xyz/api/*</code>.
          No API key is required for public endpoints. Rate limit: 20 requests per 5 seconds per IP.
        </p>
        <div className="space-y-2">
          {apiEndpoints.map((ep) => (
            <div key={ep.path} className="card flex items-start gap-4 py-3">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ep.method === 'GET' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                {ep.method}
              </span>
              <code className="mt-0.5 text-xs text-degen-400">{ep.path}</code>
              <span className="flex-1 text-gray-500">{ep.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Self-hosting */}
      <section id="self-hosting" className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-white">Self-hosting</h2>
        <p className="mb-4 text-gray-500">
          DegenFeed is licensed under MIT. You can run your own instance on Cloudflare Pages (free tier) or any Node.js host.
        </p>
        <div className="space-y-3">
          {selfHostSteps.map((step, i) => (
            <div key={step.title} className="card flex items-start gap-4 py-3">
              <span className="mt-0.5 font-mono text-xs text-degen-500">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="font-medium text-white">{step.title}</h3>
                <code className="mt-1 block rounded bg-gray-900 px-3 py-1.5 text-xs text-gray-300">{step.cmd}</code>
              </div>
            </div>
          ))}
        </div>
        <div className="card mt-4">
          <h3 className="mb-2 font-semibold text-white">Environment variables</h3>
          <p className="mb-2 text-gray-500">Required for full functionality (posting, tipping, auth):</p>
          <div className="space-y-1 font-mono text-xs text-gray-400">
            <div><code className="text-degen-400">AUTH_SECRET</code> — session signing secret (generate with openssl rand -hex 32)</div>
            <div><code className="text-degen-400">ALLOWED_ORIGINS</code> — comma-separated allowed CORS origins</div>
            <div><code className="text-degen-400">RELAY_URLS</code> — comma-separated Nostr relay URLs</div>
            <div><code className="text-degen-400">FARCASTER_HUB_URL</code> — Farcaster hub gRPC endpoint</div>
            <div><code className="text-degen-400">LENS_API_URL</code> — Lens GraphQL API endpoint</div>
            <div><code className="text-degen-400">SOLANA_RPC_URL</code> — Solana RPC for wallet verification</div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-white">Architecture</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card">
            <h3 className="font-semibold text-white">Monorepo structure</h3>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">
              <li><code className="text-degen-400">apps/web/</code> — Next.js 15 App Router frontend</li>
              <li><code className="text-degen-400">workers/api/</code> — Cloudflare Worker edge proxy + aggregator</li>
              <li><code className="text-degen-400">packages/feed-core/</code> — Feed normalization and deduplication</li>
              <li><code className="text-degen-400">packages/feed-providers/</code> — 8 protocol adapters (Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS)</li>
              <li><code className="text-degen-400">packages/ranking/</code> — 7-component transparent scoring algorithm</li>
              <li><code className="text-degen-400">packages/ui/</code> — Shared React components</li>
              <li><code className="text-degen-400">packages/identity/</code> — Cross-protocol identity resolution</li>
              <li><code className="text-degen-400">packages/auth/</code> — SIWE + Solana wallet sign-in</li>
            </ul>
          </div>
          <div className="card">
            <h3 className="font-semibold text-white">Data flow</h3>
            <ol className="mt-2 space-y-1.5 text-xs text-gray-500">
              <li>1. Worker receives feed request</li>
              <li>2. Providers fetch posts in parallel</li>
              <li>3. Feed core normalizes to UnifiedPost</li>
              <li>4. Ranking engine scores each post</li>
              <li>5. Results merged, deduplicated, sorted</li>
              <li>6. Response cached at edge (30s)</li>
              <li>7. Client renders with infinite scroll</li>
            </ol>
          </div>
        </div>
        <div className="card mt-4">
          <h3 className="mb-2 font-semibold text-white">Tech stack</h3>
          <div className="flex flex-wrap gap-2">
            {['TypeScript 5', 'Next.js 15', 'React 19', 'Cloudflare Workers', 'Cloudflare Pages', 'Cloudflare KV', 'pnpm 11', 'Turborepo 2', 'Biome', 'Tailwind CSS', 'GotoSocial 0.22', 'SQLite', 'Wagmi', 'Solana Web3.js', 'viem'].map((t) => (
              <span key={t} className="rounded bg-gray-900 px-2 py-1 text-xs text-gray-500">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* More resources */}
      <section id="more-resources" className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-white">More resources</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <a href="/faq" className="card block transition-colors hover:border-degen-500/30">
            <h3 className="font-semibold text-white">FAQ</h3>
            <p className="mt-1 text-xs text-gray-500">15 common questions about accounts, protocols, federation, payments, and privacy.</p>
          </a>
          <a href="/about" className="card block transition-colors hover:border-degen-500/30">
            <h3 className="font-semibold text-white">About</h3>
            <p className="mt-1 text-xs text-gray-500">Mission, team, Rug Munch Media LLC, infrastructure, and open-source commitment.</p>
          </a>
          <a href="/status" className="card block transition-colors hover:border-degen-500/30">
            <h3 className="font-semibold text-white">Status</h3>
            <p className="mt-1 text-xs text-gray-500">Live health dashboard for all 8 protocol providers. Latency and uptime.</p>
          </a>
          <a href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web" target="_blank" rel="noopener" className="card block transition-colors hover:border-degen-500/30">
            <h3 className="font-semibold text-white">Source code (Forgejo)</h3>
            <p className="mt-1 text-xs text-gray-500">Full monorepo source. MIT licensed. Issues and PRs welcome.</p>
          </a>
          <a href="https://gitlab.com/cryptorugmuncher/degenfeed-web" target="_blank" rel="noopener" className="card block transition-colors hover:border-degen-500/30">
            <h3 className="font-semibold text-white">GitLab mirror</h3>
            <p className="mt-1 text-xs text-gray-500">Public mirror synced on every push. CI/CD and merge requests.</p>
          </a>
          <a href="/newsletter" className="card block transition-colors hover:border-degen-500/30">
            <h3 className="font-semibold text-white">Newsletter</h3>
            <p className="mt-1 text-xs text-gray-500">Daily digest of curated web3, crypto, and AI news from 8 protocols.</p>
          </a>
        </div>
      </section>

      <div className="mt-10 border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
        DegenFeed is a product of <strong className="text-gray-500">Rug Munch Media LLC</strong>. MIT licensed. Built on open protocols.
      </div>
    </div>
  );
}
