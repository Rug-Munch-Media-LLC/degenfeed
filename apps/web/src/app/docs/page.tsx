import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock } from './code-block';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Documentation — DegenFeed',
  description:
    'API reference, protocol guides, self-hosting, and architecture for DegenFeed — the open-source web3 social aggregator.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs' },
  openGraph: {
    title: 'DegenFeed Documentation',
    description: 'Complete reference for the open-source multi-protocol web3 social aggregator.',
  },
};

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-900/30 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/20',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-500/20',
    blue: 'bg-blue-900/30 text-blue-400 border-blue-500/20',
    gray: 'bg-gray-900/50 text-gray-400 border-gray-700/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium ${colors[color] ?? colors.gray}`}
    >
      {children}
    </span>
  );
}

function Callout({
  type,
  children,
}: {
  type: 'info' | 'warning' | 'tip';
  children: React.ReactNode;
}) {
  const styles: Record<string, { border: string; bg: string; icon: string }> = {
    info: { border: 'border-blue-500/20', bg: 'bg-blue-500/5', icon: 'ℹ' },
    warning: { border: 'border-yellow-500/20', bg: 'bg-yellow-500/5', icon: '⚠' },
    tip: { border: 'border-degen-500/20', bg: 'bg-degen-500/5', icon: '✓' },
  };
  const s = styles[type];
  if (!s) return <>{children}</>;
  return (
    <div className={`my-4 rounded-lg border ${s.border} ${s.bg} p-4`}>
      <div className="flex gap-3">
        <span className="mt-0.5 flex-shrink-0 text-sm">{s.icon}</span>
        <div className="min-w-0 text-sm text-gray-300">{children}</div>
      </div>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-12 mb-4 flex items-center gap-3 text-2xl font-bold text-white scroll-mt-20"
    >
      {children}
      <a
        href={`#${id}`}
        className="text-gray-600 opacity-0 transition-opacity group-hover:opacity-100"
      >
        #
      </a>
    </h2>
  );
}

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="group mt-8 mb-3 flex items-center gap-2 text-lg font-semibold text-white scroll-mt-20"
    >
      {children}
      <a
        href={`#${id}`}
        className="text-gray-600 opacity-0 transition-opacity group-hover:opacity-100"
      >
        #
      </a>
    </h3>
  );
}

const feedLinks = [
  { href: '/home/all?sort=hot', label: 'All Protocols', desc: 'Trending across every network' },
  { href: '/home/nostr?sort=hot', label: 'Nostr', desc: 'Decentralized relay posts' },
  { href: '/home/farcaster?sort=hot', label: 'Farcaster', desc: 'On-chain social' },
  { href: '/home/lens?sort=hot', label: 'Lens', desc: 'Polygon-native social' },
  { href: '/home/bluesky?sort=hot', label: 'Bluesky', desc: 'AT Protocol' },
  { href: '/home/mastodon?sort=hot', label: 'Mastodon', desc: 'ActivityPub federation' },
  { href: '/home/lemmy?sort=hot', label: 'Lemmy', desc: 'Federated communities' },
  { href: '/news', label: 'News', desc: '550+ RSS sources' },
];

const protocols = [
  {
    name: 'Nostr',
    color: '#8e30eb',
    endpoint: 'wss://relay.damus.io',
    status: 'Production',
    desc: 'Decentralized relay network. Kind 1 text notes, kind 7 reactions, kind 6 reposts, kind 30023 long-form articles. NIP-05 identity verification, NIP-07 browser extension (Alby, nos2x), NIP-46 remote signing (bunker://). Zero server dependency — client signs locally with Schnorr signatures (secp256k1).',
  },
  {
    name: 'Farcaster',
    color: '#8a63d2',
    endpoint: 'hub.farcaster.standardcrypto.vc:2281',
    status: 'Production',
    desc: 'On-chain identity registry with off-chain Hubs for data storage. Messages are Ed25519-signed protobufs with BLAKE3 hashing. Full Cast Add, Reaction, and Reply support. Hub API for reading, protobuf encoding for writing. Farcaster Frames supported via frame resolution endpoint.',
  },
  {
    name: 'Lens',
    color: '#abfe2c',
    endpoint: 'api-v2.lens.dev/graphql',
    status: 'Production',
    desc: 'Polygon-based social graph with GraphQL API v2. Profiles, publications, mirrors, collects, and Open Actions. ML-powered explore feed for viral content discovery. Wallet-based authentication with challenge-response signing. Mirror feed surfaces amplified content from top curators.',
  },
  {
    name: 'Bluesky',
    color: '#1185fe',
    endpoint: 'public.api.bsky.app',
    status: 'Production',
    desc: 'AT Protocol with XRPC methods over HTTPS. DID-based decentralized identity (PLC directory). Personal Data Server (PDS) for storage, AppView for aggregation. Full CRUD: createRecord, deleteRecord for likes, reposts, replies. Thread view via getPostThread.',
  },
  {
    name: 'Mastodon / ActivityPub',
    color: '#6364ff',
    endpoint: 'social.degenfeed.xyz',
    status: 'Production',
    desc: 'GotoSocial v0.22 instance at social.degenfeed.xyz. Full ActivityPub federation with the Fediverse. REST API v1 for reads, writes, and engagement. Trending tags merged into feed trending topics. 15+ public instances aggregated for diverse content.',
  },
  {
    name: 'Lemmy',
    color: '#00b868',
    endpoint: 'lemmy.world/api/v3',
    status: 'Beta',
    desc: 'Federated Reddit alternative using ActivityPub. REST API v3 for community listing and post retrieval with real upvote/comment counts. 15 curated crypto/tech communities across lemmy.world, lemmy.ml, and programming.dev. RSS feeds available for every community.',
  },
  {
    name: 'Threads',
    color: '#888',
    endpoint: 'threads.net (public HTML)',
    status: 'Read-only',
    desc: 'Meta ActivityPub integration with HTML scraping fallback. JSON-LD metadata extraction + __INITIAL_STATE__ parsing. FlareSolverr proxy for Cloudflare bypass. 16 curated crypto/tech handles. Read-only — Meta does not expose a public write API.',
  },
  {
    name: 'Reddit',
    color: '#ff4500',
    endpoint: 'old.reddit.com/.rss',
    status: 'Production',
    desc: 'Triple-strategy: RSS feeds, JSON API, and community frontends (Redlib, Libreddit, Teddit). 91 default subreddits across crypto, tech, AI, programming, science, and finance. Real engagement (ups, num_comments) from JSON API path.',
  },
  {
    name: 'RSS / Atom',
    color: '#ffa500',
    endpoint: '550+ feed URLs',
    status: 'Production',
    desc: 'rss-parser with custom dc:creator, content:encoded, and media:content fields. Source adapters for Reddit, Mirror.xyz, Substack, Medium, Paragraph, YouTube, PeerTube, arXiv, Hacker News, and generic feeds. 93 YouTube channels across crypto, tech, AI, science, finance, and hardware.',
  },
];

const apiEndpoints = [
  {
    method: 'GET',
    path: '/api/feed/home',
    desc: 'Aggregated and ranked feed. Query params: protocols, sort, limit, category, cursor, direction, type, lang, trending',
    section: 'feed',
    tryIt: '/home/all?sort=hot',
  },
  {
    method: 'GET',
    path: '/api/feed/trending',
    desc: 'Trending posts by engagement velocity across all protocols.',
    section: 'feed',
    tryIt: '/home/all?sort=hot',
  },
  {
    method: 'GET',
    path: '/api/feed/news',
    desc: 'Curated news feed from RSS, Mastodon, and Bluesky sources.',
    section: 'feed',
    tryIt: '/news',
  },
  {
    method: 'GET',
    path: '/api/feed/stream',
    desc: 'Server-Sent Events real-time feed. Polls providers every 30s.',
    section: 'feed',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/:protocol',
    desc: 'Per-protocol feed. Replace :protocol with nostr, farcaster, lens, bluesky, mastodon, lemmy, reddit, rss.',
    section: 'feed',
    tryIt: '/home/nostr?sort=hot',
  },
  {
    method: 'GET',
    path: '/api/feed/category/:cat',
    desc: 'Filter by niche: defi, nft, ai, bitcoin, ethereum, solana, security, macro, etc.',
    section: 'feed',
    tryIt: '/home/all?category=defi',
  },
  {
    method: 'GET',
    path: '/api/feed/post/:id',
    desc: 'Single post by canonical ID. Falls back to post KV store for O(1) lookup.',
    section: 'feed',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/post/:id/replies',
    desc: 'Thread/reply context for a post. Nostr, Farcaster, Mastodon, Bluesky.',
    section: 'feed',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/related',
    desc: 'Related posts by niche overlap + time proximity. Query: ?id=postId&limit=10',
    section: 'feed',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/communities',
    desc: 'Trending communities across Reddit, Lemmy, and Farcaster.',
    section: 'feed',
    tryIt: '/discover',
  },
  {
    method: 'GET',
    path: '/api/feed/funding',
    desc: 'Crypto venture funding round tracker with regex extraction.',
    section: 'feed',
    tryIt: '/home/funding',
  },
  {
    method: 'GET',
    path: '/api/feed/rss.xml',
    desc: 'RSS 2.0 feed of top DegenFeed posts. Subscribe in any RSS reader.',
    section: 'feed',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/atom.xml',
    desc: 'Atom 1.0 feed of top DegenFeed posts.',
    section: 'feed',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/health',
    desc: 'Protocol health status — latency and uptime per provider.',
    section: 'feed',
    tryIt: '/status',
  },
  {
    method: 'POST',
    path: '/api/publish',
    desc: 'Cross-post to connected protocols. Nostr (client-side sign), Farcaster (protobuf sign), Lens (typed data), Bluesky (XRPC), Mastodon (REST), Threads (AT Protocol).',
    section: 'engagement',
    tryIt: null,
  },
  {
    method: 'POST',
    path: '/api/engage',
    desc: 'Like, unlike, repost, unrepost, bookmark, unbookmark, reply across all supported protocols.',
    section: 'engagement',
    tryIt: null,
  },
  {
    method: 'POST',
    path: '/api/tip/create',
    desc: 'Create a crypto tip: ETH, SOL, Lightning (Nostr zaps), or Lens Collect.',
    section: 'engagement',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/tip/resolve',
    desc: 'Resolve available tipping methods for a post across protocols.',
    section: 'engagement',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/tip/lightning/invoice',
    desc: 'Generate a Lightning invoice for a Nostr zap.',
    section: 'engagement',
    tryIt: null,
  },
  {
    method: 'POST',
    path: '/api/auth/wallet/nonce',
    desc: 'Request a signing nonce for SIWE or Solana wallet auth.',
    section: 'identity',
    tryIt: null,
  },
  {
    method: 'POST',
    path: '/api/auth/wallet/verify',
    desc: 'Verify a wallet signature and issue a session cookie.',
    section: 'identity',
    tryIt: null,
  },
  {
    method: 'POST',
    path: '/api/auth/gotosocial/authorize',
    desc: 'Start GotoSocial OAuth2 flow. Redirects to social.degenfeed.xyz.',
    section: 'identity',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/auth/gotosocial/callback',
    desc: 'GotoSocial OAuth2 callback. Exchanges code for access token.',
    section: 'identity',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/auth/session',
    desc: 'Verify the current session cookie and return session data.',
    section: 'identity',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/identity/resolve',
    desc: 'Resolve a handle across protocols. Query: ?handle=vitalik.eth',
    section: 'identity',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/identity/profile',
    desc: 'Cross-platform identity profile with linked accounts + recent posts.',
    section: 'identity',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/notifications',
    desc: 'Unified notification inbox: Nostr, Mastodon, Bluesky, Farcaster, Lens. Read state persisted in KV.',
    section: 'identity',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/search',
    desc: 'Cross-protocol text search. Query: ?q=bitcoin&protocols=nostr,farcaster&limit=25',
    section: 'other',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/search/identity',
    desc: 'Search for identities across protocols.',
    section: 'other',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/discover/people',
    desc: 'Who to follow — trending authors by engagement across protocols.',
    section: 'other',
    tryIt: '/discover',
  },
  {
    method: 'GET',
    path: '/api/embed/resolve',
    desc: 'Fetch OpenGraph metadata for a URL. 24h KV cache.',
    section: 'other',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/frame/resolve',
    desc: 'Parse Farcaster Frame meta tags from a URL. 5min KV cache.',
    section: 'other',
    tryIt: null,
  },
  {
    method: 'POST',
    path: '/api/frame/action',
    desc: 'Submit a Farcaster Frame button action.',
    section: 'other',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/prices',
    desc: 'Crypto prices via CoinGecko. Query: ?ids=bitcoin,ethereum,solana. 60s cache.',
    section: 'other',
    tryIt: null,
  },
  {
    method: 'POST',
    path: '/api/newsletter/subscribe',
    desc: 'Subscribe to the daily digest. Optional niche + protocol filters.',
    section: 'other',
    tryIt: '/newsletter',
  },
  {
    method: 'GET',
    path: '/api/newsletter/digest',
    desc: 'Preview the latest daily digest.',
    section: 'other',
    tryIt: '/newsletter',
  },
  {
    method: 'POST',
    path: '/api/push/subscribe',
    desc: 'Register a PWA push notification subscription.',
    section: 'other',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/account/export',
    desc: 'GDPR-compliant data export. Returns all stored user data.',
    section: 'other',
    tryIt: null,
  },
  {
    method: 'POST',
    path: '/api/account/delete',
    desc: 'Permanently delete account and all associated data.',
    section: 'other',
    tryIt: null,
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      {/* Overview */}
      <section id="overview" className="scroll-mt-20">
        <div className="mb-2 flex items-center gap-2">
          <Badge color="green">v0.2.0</Badge>
          <Badge>MIT Licensed</Badge>
          <Badge color="purple">10 Protocols</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white">DegenFeed Documentation</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-400">
          DegenFeed is an open-source multi-protocol social aggregator for web3. It pulls public
          posts from 10 decentralized and federated networks into one unified, ranked timeline.
          Browse without an account. Connect a wallet to post, engage, and tip across every
          protocol.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {feedLinks.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-degen-500/20 hover:bg-degen-500/[0.03]"
            >
              <div className="font-semibold text-white">{f.label}</div>
              <div className="mt-1 text-xs text-gray-500">{f.desc}</div>
              <span className="mt-2 inline-block text-xs font-medium text-degen-400 opacity-0 transition-opacity group-hover:opacity-100">
                View feed →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Quickstart */}
      <H2 id="quickstart">Quickstart</H2>

      <H3 id="browse">Browse the feed</H3>
      <p className="text-sm leading-relaxed text-gray-400">
        No account needed. Visit any feed URL directly. Every feed supports these query parameters:
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="py-2 pr-4 font-medium text-gray-400">Parameter</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Default</th>
              <th className="py-2 font-medium text-gray-400">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-500">
            {[
              [
                'protocols',
                'all',
                'Comma-separated: nostr,farcaster,lens,bluesky,mastodon,lemmy,reddit,rss,threads,ponder',
              ],
              ['sort', 'scored', 'scored | hot | new | top'],
              ['limit', '50', '1-200 posts per page'],
              [
                'category',
                '',
                'Filter by niche: defi, ai, bitcoin, ethereum, solana, security, macro',
              ],
              ['type', '', 'Filter by content type: video, article, image, thread, link, text'],
              ['cursor', '', 'Timestamp for cursor-based pagination'],
              ['direction', 'desc', 'asc | desc'],
              ['lang', 'en', 'en | all (language filter)'],
              ['trending', '24', 'Trending window in hours: 1 | 6 | 24'],
            ].map(([p, d, desc]) => (
              <tr key={p} className="border-b border-white/[0.02]">
                <td className="py-2 pr-4 font-mono text-degen-400 text-xs">{p}</td>
                <td className="py-2 pr-4 font-mono text-xs">{d}</td>
                <td className="py-2 text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H3 id="account">Get a @degenfeed.xyz account</H3>
      <p className="text-sm leading-relaxed text-gray-400">
        Visit{' '}
        <a
          href="https://social.degenfeed.xyz"
          target="_blank"
          rel="noopener"
          className="text-degen-400 underline"
        >
          social.degenfeed.xyz
        </a>
        , connect your wallet, and request an account. Approvals are usually processed within 24
        hours. Your handle works across the entire Fediverse via ActivityPub — follow and be
        followed by users on Mastodon, Lemmy, Pixelfed, PeerTube, and more.
      </p>
      <Callout type="tip">
        Your @degenfeed.xyz account is a full GotoSocial account. You can use any
        Mastodon-compatible client to access it. Federation is enabled — your posts are visible to
        the entire Fediverse.
      </Callout>

      <H3 id="curl">curl examples</H3>
      <CodeBlock>{`# Trending feed across all protocols
curl "https://degenfeed.xyz/api/feed/home?sort=hot&limit=10"

# Nostr + Farcaster only, DeFi category, newest first
curl "https://degenfeed.xyz/api/feed/home?protocols=nostr,farcaster&category=defi&sort=new&limit=20"

# Video content only, trending in the last hour
curl "https://degenfeed.xyz/api/feed/home?type=video&trending=1&limit=15"

# Paginate: next page after cursor
curl "https://degenfeed.xyz/api/feed/home?cursor=1720000000000&direction=desc&limit=50"

# Resolve a cross-platform identity
curl "https://degenfeed.xyz/api/identity/profile?handle=vitalik.eth"

# Fetch OpenGraph metadata for a link
curl "https://degenfeed.xyz/api/embed/resolve?url=https://cointelegraph.com/news/bitcoin-halving"`}</CodeBlock>

      {/* Protocols */}
      <H2 id="protocols">Protocols</H2>
      <p className="text-sm leading-relaxed text-gray-400">
        DegenFeed aggregates 9 protocols plus RSS/Atom. Each protocol has a dedicated provider that
        handles authentication, content normalization, and health monitoring.
      </p>

      <div className="mt-6 space-y-4">
        {protocols.map((p) => (
          <div
            key={p.name}
            id={p.name.toLowerCase().replace(/[^a-z]/g, '')}
            className="scroll-mt-20 rounded-2xl border border-white/5 bg-white/[0.02] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{p.name}</h3>
                    <Badge
                      color={
                        p.status === 'Production'
                          ? 'green'
                          : p.status === 'Beta'
                            ? 'yellow'
                            : 'gray'
                      }
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{p.desc}</p>
                  <div className="mt-2">
                    <code className="inline-block rounded-md bg-gray-900/70 px-2 py-0.5 font-mono text-[11px] text-degen-400">
                      {p.endpoint}
                    </code>
                  </div>
                </div>
              </div>
              <Link
                href={`/home/${p.name
                  .toLowerCase()
                  .replace(/[^a-z]/g, '')
                  .replace('rss / atom', 'rss')
                  .replace('mastodon / activitypub', 'mastodon')}?sort=hot`}
                className="flex-shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-degen-500/30 hover:text-degen-400"
              >
                Live feed →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* API Reference */}
      <H2 id="api">API Reference</H2>
      <p className="text-sm leading-relaxed text-gray-400">
        All endpoints are served from{' '}
        <code className="rounded-md bg-gray-900/70 px-1.5 py-0.5 font-mono text-xs text-degen-400">
          degenfeed.xyz/api/*
        </code>
        . Rate limit: 60 requests per 5-second window per IP. No API key required for public read
        endpoints. State-changing endpoints require session authentication.
      </p>

      <Callout type="info">
        The rate limiter uses Cloudflare KV for global consistency across worker isolates. It fails
        open — a KV outage will never block legitimate traffic. Authenticated sessions have higher
        rate limits.
      </Callout>

      <H3 id="feed">Feed endpoints</H3>
      <div className="space-y-1">
        {apiEndpoints
          .filter((e) => e.section === 'feed')
          .map((ep) => (
            <div
              key={ep.path}
              className="group flex items-start gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2.5 transition-colors hover:border-white/10"
            >
              <span
                className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${ep.method === 'GET' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}
              >
                {ep.method}
              </span>
              <code className="mt-0.5 flex-shrink-0 font-mono text-xs text-degen-400">
                {ep.path}
              </code>
              <span className="min-w-0 flex-1 text-xs text-gray-500">{ep.desc}</span>
              {ep.tryIt && (
                <Link
                  href={ep.tryIt}
                  className="flex-shrink-0 rounded border border-white/10 px-2 py-0.5 text-[11px] text-gray-400 opacity-0 transition-all hover:border-degen-500/30 hover:text-degen-400 group-hover:opacity-100"
                >
                  Try →
                </Link>
              )}
            </div>
          ))}
      </div>

      <H3 id="engagement">Engagement</H3>
      <div className="space-y-1">
        {apiEndpoints
          .filter((e) => e.section === 'engagement')
          .map((ep) => (
            <div
              key={ep.path}
              className="group flex items-start gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2.5 transition-colors hover:border-white/10"
            >
              <span
                className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${ep.method === 'GET' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}
              >
                {ep.method}
              </span>
              <code className="mt-0.5 flex-shrink-0 font-mono text-xs text-degen-400">
                {ep.path}
              </code>
              <span className="min-w-0 flex-1 text-xs text-gray-500">{ep.desc}</span>
              {ep.tryIt && (
                <Link
                  href={ep.tryIt}
                  className="flex-shrink-0 rounded border border-white/10 px-2 py-0.5 text-[11px] text-gray-400 opacity-0 transition-all hover:border-degen-500/30 hover:text-degen-400 group-hover:opacity-100"
                >
                  Try →
                </Link>
              )}
            </div>
          ))}
      </div>

      <H3 id="identity">Identity & Auth</H3>
      <div className="space-y-1">
        {apiEndpoints
          .filter((e) => e.section === 'identity')
          .map((ep) => (
            <div
              key={ep.path}
              className="group flex items-start gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2.5 transition-colors hover:border-white/10"
            >
              <span
                className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${ep.method === 'GET' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}
              >
                {ep.method}
              </span>
              <code className="mt-0.5 flex-shrink-0 font-mono text-xs text-degen-400">
                {ep.path}
              </code>
              <span className="min-w-0 flex-1 text-xs text-gray-500">{ep.desc}</span>
              {ep.tryIt && (
                <Link
                  href={ep.tryIt}
                  className="flex-shrink-0 rounded border border-white/10 px-2 py-0.5 text-[11px] text-gray-400 opacity-0 transition-all hover:border-degen-500/30 hover:text-degen-400 group-hover:opacity-100"
                >
                  Try →
                </Link>
              )}
            </div>
          ))}
      </div>

      <H3 id="other">Other endpoints</H3>
      <div className="space-y-1">
        {apiEndpoints
          .filter((e) => e.section === 'other')
          .map((ep) => (
            <div
              key={ep.path}
              className="group flex items-start gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2.5 transition-colors hover:border-white/10"
            >
              <span
                className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${ep.method === 'GET' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}
              >
                {ep.method}
              </span>
              <code className="mt-0.5 flex-shrink-0 font-mono text-xs text-degen-400">
                {ep.path}
              </code>
              <span className="min-w-0 flex-1 text-xs text-gray-500">{ep.desc}</span>
              {ep.tryIt && (
                <Link
                  href={ep.tryIt}
                  className="flex-shrink-0 rounded border border-white/10 px-2 py-0.5 text-[11px] text-gray-400 opacity-0 transition-all hover:border-degen-500/30 hover:text-degen-400 group-hover:opacity-100"
                >
                  Try →
                </Link>
              )}
            </div>
          ))}
      </div>

      {/* Ranking */}
      <H2 id="ranking">Ranking Algorithm</H2>
      <p className="text-sm leading-relaxed text-gray-400">
        Every post is scored by a transparent 7-factor model. Each component is exposed in the API
        response via{' '}
        <code className="rounded-md bg-gray-900/70 px-1.5 py-0.5 font-mono text-xs text-degen-400">
          score.reasons[]
        </code>{' '}
        so users can see exactly why a post appears where it does.
      </p>

      <div className="mt-4 rounded-2xl border border-degen-500/10 bg-degen-500/[0.02] p-5">
        <div className="font-mono text-sm leading-relaxed text-gray-300">
          score = (recency × 2.4 + engagement × 3.5 + relevance × 1.8 + quality × 1.4 + diversity ×
          1.0 + source × 0.8 + velocity × 1.2) × freshnessBoost × mediaBoost × contentQuality
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          {
            factor: 'Recency (2.4)',
            desc: '12-hour half-life exponential decay. Posts decay to 50% score after 12 hours.',
          },
          {
            factor: 'Engagement (3.5)',
            desc: 'log(1 + likes + 2×reposts + 3×replies + 4×quotes). Log scaling prevents viral domination.',
          },
          {
            factor: 'Relevance (1.8)',
            desc: 'keywordRelevance × nicheRelevance × platformRelevance. 200+ crypto terms + 60 tech/AI terms.',
          },
          {
            factor: 'Quality (1.4)',
            desc: 'sourceQuality (followerCount-based) + followed-author boost (+1.2).',
          },
          {
            factor: 'Diversity (1.0)',
            desc: 'Penalizes repeat authors. -0.2 per extra post after 3, capped at -0.8.',
          },
          {
            factor: 'Source (0.8)',
            desc: 'Protocol tier weight. Nostr/Farcaster/Lens/Lemmy = 1.0, Threads = 0.7, RSS = 0.6.',
          },
          {
            factor: 'Velocity (1.2)',
            desc: 'Engagement rate-of-change vs previous snapshot. Trending-now posts get up to 3x boost.',
          },
          {
            factor: 'Freshness',
            desc: 'Multiplier for very recent content: 2.0x for &lt;15min, 1.5x for &lt;1h, 1.2x for &lt;2h.',
          },
          { factor: 'Media', desc: '1.2x multiplier for posts with image or video embeds.' },
          {
            factor: 'Content quality',
            desc: 'Penalty for low-effort posts: single-word (0.3x), emoji-spam (0.2x), all-caps (0.3x).',
          },
        ].map((r) => (
          <div key={r.factor} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="font-semibold text-white text-sm">{r.factor}</div>
            <p className="mt-1 text-xs text-gray-500">{r.desc}</p>
          </div>
        ))}
      </div>

      <Callout type="tip">
        Users can customize ranking weights with persistent preferences (saved in KV) or anonymous
        cookie preferences. Query params override stored preferences for one-off exploration. Set{' '}
        <code className="rounded bg-gray-900/70 px-1 text-degen-400">?sort=new</code> to bypass
        ranking entirely and see chronological order.
      </Callout>

      {/* Self-hosting */}
      <H2 id="self-hosting">Self-Hosting</H2>
      <p className="text-sm leading-relaxed text-gray-400">
        DegenFeed is MIT licensed. Run your own instance on Cloudflare Pages (free tier includes
        100K requests/day) or any Node.js host. The entire stack — frontend, API worker, caching,
        and ranking — runs on Cloudflare's edge network with zero server costs at low traffic.
      </p>

      <H3 id="setup">Setup</H3>
      <CodeBlock>{`# Clone the repository
git clone https://git.rugmunch.io/RugMunchMedia/degenfeed-web.git
cd degenfeed-web

# Install dependencies (pnpm required)
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and configuration

# Start development server
pnpm dev

# Build for production
pnpm build

# Deploy to Cloudflare Pages
npx wrangler pages deploy apps/web --project-name degenfeed-web
npx wrangler deploy workers/api/src/index.ts --name degenfeed-api`}</CodeBlock>

      <H3 id="env">Environment variables</H3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="py-2 pr-4 font-medium text-gray-400">Variable</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Required</th>
              <th className="py-2 font-medium text-gray-400">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-500">
            {[
              [
                'AUTH_SECRET',
                'Yes',
                'HMAC-SHA256 session signing secret. Generate: openssl rand -hex 32',
              ],
              [
                'ALLOWED_ORIGINS',
                'Yes',
                'Comma-separated CORS origins for state-changing requests',
              ],
              ['RELAY_URLS', 'No', 'Comma-separated Nostr relay WebSocket URLs'],
              ['FARCASTER_HUB_URL', 'No', 'Farcaster Hub HTTP endpoint'],
              ['LENS_API_URL', 'No', 'Lens GraphQL API endpoint'],
              ['GTS_CLIENT_ID', 'No', 'GotoSocial OAuth2 client ID'],
              ['GTS_CLIENT_SECRET', 'No', 'GotoSocial OAuth2 client secret'],
              ['GTS_INSTANCE_URL', 'No', 'GotoSocial instance URL'],
              ['SOLANA_RPC_URL', 'No', 'Solana RPC endpoint for wallet verification'],
              ['VAPID_PUBLIC_KEY', 'No', 'Web Push VAPID public key (JWK JSON)'],
              ['VAPID_PRIVATE_KEY', 'No', 'Web Push VAPID private key (JWK JSON)'],
              ['VAPID_SUBJECT', 'No', 'VAPID subject (mailto:admin@example.com)'],
              ['POSTMARK_SERVER_TOKEN', 'No', 'Postmark API token for email delivery'],
              ['ADMIN_API_KEY', 'No', 'Bearer token for admin endpoints (push, newsletter status)'],
              ['RMI_BACKEND_URL', 'No', 'RMI DataBus backend URL for enhanced news feed'],
              ['SENTRY_DSN', 'No', 'Sentry DSN for error reporting'],
            ].map(([key, req, desc]) => (
              <tr key={key} className="border-b border-white/[0.02]">
                <td className="py-2 pr-4 font-mono text-degen-400 text-xs">{key}</td>
                <td className="py-2 pr-4">
                  <Badge color={req === 'Yes' ? 'yellow' : 'gray'}>{req}</Badge>
                </td>
                <td className="py-2 text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H3 id="deploy">Deployment</H3>
      <p className="text-sm leading-relaxed text-gray-400">
        The recommended deployment is Cloudflare Pages (frontend) + Cloudflare Workers (API). Both
        are free-tier eligible. You'll also need two KV namespaces —{' '}
        <code className="rounded-md bg-gray-900/70 px-1 py-0.5 font-mono text-xs text-degen-400">
          CACHE
        </code>{' '}
        for feed caching and rate limiting, and{' '}
        <code className="rounded-md bg-gray-900/70 px-1 py-0.5 font-mono text-xs text-degen-400">
          SUBSCRIPTIONS
        </code>{' '}
        for newsletter and billing data.
      </p>
      <Callout type="info">
        The worker uses ~5ms of CPU per uncached feed request (after provider KV cache hits) and
        ~50ms for a full cache-miss fetch across all 10 protocols due to parallelization. At 100K
        requests/day (Cloudflare free tier), you'll use roughly 500K CPU-ms — well under the 10M
        limit.
      </Callout>

      {/* Architecture */}
      <H2 id="architecture">Architecture</H2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-3 font-semibold text-white">Monorepo Structure</h3>
          <div className="space-y-1.5 text-xs">
            {[
              ['apps/web', 'Next.js 15 App Router frontend'],
              ['workers/api', 'Cloudflare Worker (65+ endpoints)'],
              ['packages/types', 'UnifiedPost, UnifiedIdentity, Protocol'],
              ['packages/feed-core', 'Normalization, 11-layer dedup, spam, niches, language'],
              ['packages/feed-providers', '10 protocol adapters'],
              ['packages/ranking', '7-factor transparent scoring engine'],
              ['packages/identity', 'Cross-protocol handle resolution'],
              ['packages/auth', 'SIWE + Solana + Nostr/Farcaster/Lens sign-in'],
              ['packages/storage', 'IndexedDB client with 10 object stores'],
              ['packages/ui', 'React components (PostCard, ComposeModal, etc.)'],
              ['packages/nostr-sdk', 'Nostr SDK (NIP-01/05/19/46 + RelayPool)'],
              ['packages/farcaster-sdk', 'Hub client + protobuf signing'],
              ['packages/lens-sdk', 'Lens API v2 GraphQL client'],
              ['packages/bluesky-sdk', 'AT Protocol XRPC client'],
              ['packages/mastodon-sdk', 'GotoSocial/Mastodon REST client'],
              ['packages/rss-sdk', 'RSS/Atom with 6 source adapters'],
              ['packages/threads-sdk', 'Threads AT Protocol wrapper'],
            ].map(([pkg, desc]) => (
              <div key={pkg} className="flex items-baseline gap-2">
                <code className="flex-shrink-0 font-mono text-degen-400">{pkg}</code>
                <span className="text-gray-600">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="mb-3 font-semibold text-white">Request Lifecycle</h3>
            <ol className="space-y-1.5 text-xs text-gray-500">
              {[
                'Worker receives GET /api/feed/home',
                'KV feed cache check (30s TTL) → return if hit',
                'Per-protocol KV cache check (60s TTL) → skip if fresh',
                'Circuit breaker check → skip failing providers',
                'Parallel provider fetches across 10 protocols',
                'Spam filter → niche detection → content type detection',
                '11-layer cross-protocol dedup + Jaccard similarity',
                'Post KV store write (1h TTL) for O(1) lookups',
                'Load user context: follows, mutes, preferences',
                'Language filter: Accept-Language → English default',
                'Nostr zap count enrichment (fire-and-forget)',
                '7-factor scoring with freshness + media + quality boosts',
                'Diversity ranker with per-protocol minimums',
                'Cursor pagination + sort mode + content type filter',
                'Feed cache write → JSON response',
              ].map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="flex-shrink-0 font-mono text-degen-500">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="mb-3 font-semibold text-white">Tech Stack</h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                'TypeScript 5',
                'Next.js 15',
                'React 19',
                'Cloudflare Workers',
                'Cloudflare Pages',
                'Cloudflare KV',
                'pnpm 11',
                'Turborepo 2',
                'Biome',
                'Tailwind CSS',
                'GotoSocial 0.22',
                'Wagmi',
                'Solana Web3.js',
                'viem',
                'Noble Curves',
                'Noble Hashes',
                'IDB',
                'Vitest',
                'Wrangler',
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-gray-900/60 px-2 py-1 text-[11px] text-gray-500"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <h3 className="mb-1 font-semibold text-white">Deduplication Pipeline</h3>
        <p className="text-xs text-gray-500">
          11 layers prevent the same content from appearing multiple times in your feed, even when
          cross-posted across protocols.
        </p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {[
            '1. Canonical ID — exact protocol:nativeId match',
            '2. Content fingerprint — 12-word normalized shingle',
            '3. Normalized full-text hash — URL-stripped comparison',
            '4. Primary URL dedup — same first link across protocols',
            '5. Text prefix — first 120 chars match',
            '6. Short exact text — <80 char posts',
            '7. Same-author cross-post window',
            '8. Repost/quote chain dedup — RT/@via patterns',
            '9. Ticker + first-sentence snapshot',
            '10. Embed-only dedup — same media URLs',
            '11. Image URL fingerprint — normalized CDN URLs',
          ].map((l) => (
            <div
              key={l}
              className="rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-1.5 text-[11px] text-gray-500"
            >
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Resources */}
      <H2 id="resources">Resources</H2>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            href: '/faq',
            title: 'FAQ',
            desc: 'Common questions about accounts, protocols, federation, payments, and privacy.',
          },
          {
            href: '/about',
            title: 'About',
            desc: 'Mission, team, Rug Munch Media LLC, infrastructure, and open-source commitment.',
          },
          {
            href: '/status',
            title: 'Status',
            desc: 'Live health dashboard. Latency and uptime for all protocol providers.',
          },
          {
            href: 'https://git.rugmunch.io/RugMunchMedia/degenfeed-web',
            title: 'Forgejo',
            desc: 'Primary repository. Issues and pull requests welcome.',
            external: true,
          },
          {
            href: 'https://gitlab.com/cryptorugmuncher/degenfeed-web',
            title: 'GitLab Mirror',
            desc: 'Public mirror synced on every push. CI/CD pipeline.',
            external: true,
          },
          {
            href: '/newsletter',
            title: 'Newsletter',
            desc: 'Daily digest. Curated web3, crypto, and AI news to your inbox.',
          },
        ].map((r) => (
          <Link
            key={r.href}
            href={r.href}
            target={r.external ? '_blank' : undefined}
            rel={r.external ? 'noopener' : undefined}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-degen-500/20 hover:bg-degen-500/[0.03]"
          >
            <h3 className="font-semibold text-white">{r.title}</h3>
            <p className="mt-1 text-xs text-gray-500">{r.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-12 border-t border-white/5 pt-6 text-center">
        <p className="text-xs text-gray-600">
          DegenFeed is a product of <strong className="text-gray-500">Rug Munch Media LLC</strong>.
          MIT Licensed. Built on open protocols. 10 networks. One window.
        </p>
      </div>
    </div>
  );
}
