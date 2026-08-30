import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock } from '../docs/code-block';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'API Documentation — DegenFeed',
  description:
    'Complete v1 API reference for DegenFeed. Feed endpoints, identity resolution, tipping, search, and more. Build on the open social web.',
  alternates: { canonical: 'https://app.degenfeed.xyz/api-docs' },
  openGraph: {
    title: 'DegenFeed API v1 Documentation',
    description: 'Build on the open social web with the DegenFeed public API.',
  },
};

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-900/30 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/20',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-500/20',
    blue: 'bg-blue-900/30 text-blue-400 border-blue-500/20',
    gray: 'bg-[var(--color-muted)] text-[var(--color-muted)] border-[var(--color-border)]/30',
    red: 'bg-red-900/30 text-red-400 border-red-500/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium ${colors[color] ?? colors.gray}`}
    >
      {children}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-green-900/30 text-green-400',
    POST: 'bg-blue-900/30 text-blue-400',
    PUT: 'bg-yellow-900/30 text-yellow-400',
    DELETE: 'bg-red-900/30 text-red-400',
    PATCH: 'bg-purple-900/30 text-purple-400',
  };
  return (
    <span
      className={`flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${colors[method] ?? 'bg-black/30 text-[var(--color-muted)]'}`}
    >
      {method}
    </span>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-12 mb-4 flex items-center gap-3 text-2xl font-bold text-[var(--color-fg)] scroll-mt-20"
    >
      {children}
      <a
        href={`#${id}`}
        className="text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100"
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
      className="group mt-8 mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--color-fg)] scroll-mt-20"
    >
      {children}
      <a
        href={`#${id}`}
        className="text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100"
      >
        #
      </a>
    </h3>
  );
}

interface Endpoint {
  method: string;
  path: string;
  desc: string;
  queryParams?: { name: string; type: string; required?: boolean; desc: string }[];
  exampleReq?: string;
  exampleRes?: string;
  auth?: string;
}

const endpoints: Record<string, Endpoint[]> = {
  feed: [
    {
      method: 'GET',
      path: '/v1/feed/home',
      desc: 'Aggregated and ranked feed from all protocols.',
      queryParams: [
        {
          name: 'protocols',
          type: 'string',
          desc: 'Comma-separated: nostr,farcaster,lens,bluesky,mastodon,lemmy,reddit,rss (threads requires explicit opt-in; experimental)',
        },
        { name: 'sort', type: 'string', desc: 'scored | hot | new | top' },
        { name: 'limit', type: 'number', desc: '1-200 posts per page (default 50)' },
        {
          name: 'category',
          type: 'string',
          desc: 'Filter: defi, ai, bitcoin, ethereum, solana, security, macro',
        },
        { name: 'cursor', type: 'string', desc: 'Pagination cursor timestamp' },
      ],
      auth: 'read:feed',
      exampleReq: 'GET /v1/feed/home?protocols=nostr,farcaster&sort=hot&limit=10',
      exampleRes: `{
  "posts": [
    {
      "id": "nostr:note1...",
      "protocol": "nostr",
      "author": { "handle": "alice", "protocol": "nostr" },
      "content": "Bitcoin is the future of money.",
      "score": 89.4,
      "engagement": { "likes": 42, "replies": 7, "reposts": 12 },
      "timestamp": 1720000000000
    }
  ],
  "cursor": "1720000100000"
}`,
    },
    {
      method: 'GET',
      path: '/v1/feed/trending',
      desc: 'Trending posts by engagement velocity.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/feed/news',
      desc: 'Curated news feed from 353+ RSS sources.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/feed/stream',
      desc: 'Server-Sent Events real-time feed stream.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/feed/post/:postId',
      desc: 'Single post by canonical ID.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/feed/post/:postId/replies',
      desc: 'Thread/reply context for a post.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/feed/related',
      desc: 'Related posts by niche overlap + time proximity.',
      auth: 'read:feed',
      queryParams: [
        { name: 'id', type: 'string', required: true, desc: 'Post ID' },
        { name: 'limit', type: 'number', desc: 'Max results (default 10)' },
      ],
    },
    {
      method: 'GET',
      path: '/v1/feed/:protocol',
      desc: 'Per-protocol feed: nostr, farcaster, lens, bluesky, mastodon, lemmy, reddit, rss.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/feed/category/:category',
      desc: 'Filter by niche category.',
      auth: 'read:feed',
    },
    { method: 'GET', path: '/v1/feed/presets', desc: 'Available feed presets.', auth: 'read:feed' },
  ],
  search: [
    {
      method: 'GET',
      path: '/v1/search',
      desc: 'Cross-protocol text search.',
      auth: 'read:feed',
      queryParams: [
        { name: 'q', type: 'string', required: true, desc: 'Search query' },
        { name: 'protocols', type: 'string', desc: 'Comma-separated protocol filter' },
        { name: 'limit', type: 'number', desc: 'Max results (default 25)' },
      ],
      exampleReq: 'GET /v1/search?q=bitcoin&protocols=nostr,farcaster&limit=10',
      exampleRes: `{
  "results": [
    { "id": "farcaster:0x...", "protocol": "farcaster", "content": "...", "author": { "handle": "bob" }, "score": 0.95 }
  ],
  "total": 42
}`,
    },
    {
      method: 'GET',
      path: '/v1/search/identity',
      desc: 'Search for identities across protocols.',
      auth: 'read:identity',
    },
  ],
  identity: [
    {
      method: 'GET',
      path: '/v1/identity/resolve',
      desc: 'Resolve a handle across protocols.',
      auth: 'read:identity',
      queryParams: [
        {
          name: 'handle',
          type: 'string',
          required: true,
          desc: 'Handle to resolve (e.g. vitalik.eth)',
        },
      ],
      exampleReq: 'GET /v1/identity/resolve?handle=vitalik.eth',
      exampleRes: `{
  "handle": "vitalik.eth",
  "resolved": [
    { "protocol": "farcaster", "fid": 123, "username": "vitalik.eth" },
    { "protocol": "lens", "handle": "vitalik.lens" },
    { "protocol": "nostr", "npub": "npub1..." }
  ]
}`,
    },
    {
      method: 'GET',
      path: '/v1/identity/profile',
      desc: 'Cross-platform identity profile with linked accounts.',
      auth: 'read:identity',
      queryParams: [
        { name: 'wallet', type: 'string', desc: 'Wallet address for cross-protocol lookup' },
        { name: 'handle', type: 'string', desc: 'Handle to look up (legacy)' },
      ],
    },
    {
      method: 'POST',
      path: '/v1/identity/link',
      desc: 'Link an identity from another protocol.',
      auth: 'read:identity',
    },
    {
      method: 'DELETE',
      path: '/v1/identity/link',
      desc: 'Unlink a previously linked identity.',
      auth: 'read:identity',
    },
  ],
  tip: [
    {
      method: 'POST',
      path: '/v1/tip/create',
      desc: 'Send a crypto tip (ETH, SOL, Lightning, Lens Collect).',
      auth: 'write:tip',
    },
    {
      method: 'GET',
      path: '/v1/tip/resolve',
      desc: 'Resolve available tipping methods for a post.',
      auth: 'write:tip',
    },
    {
      method: 'GET',
      path: '/v1/tip/settings',
      desc: 'Get tipping preferences for a user.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/tip/lightning/invoice',
      desc: 'Generate a Lightning invoice for a Nostr zap.',
      auth: 'write:tip',
    },
    {
      method: 'GET',
      path: '/v1/tip/unified/stats',
      desc: 'Cross-platform tip statistics.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/tip/unified/leaderboard',
      desc: 'Top tippers across all platforms.',
      auth: 'read:feed',
    },
  ],
  health: [
    {
      method: 'GET',
      path: '/v1/health',
      desc: 'Legacy relay health status.',
      auth: 'none',
      exampleRes: `{ "wss://relay.damus.io": "ok", "wss://nos.lol": "ok" }`,
    },
    {
      method: 'GET',
      path: '/v1/health/protocols',
      desc: 'Protocol health — latency and uptime per provider.',
      auth: 'none',
      exampleRes: `{
  "summary": { "up": 8, "degraded": 1, "down": 0, "total": 9 },
  "protocols": [
    { "name": "nostr", "status": "up", "latencyMs": 120 },
    { "name": "farcaster", "status": "up", "latencyMs": 85 }
  ]
}`,
    },
    {
      method: 'GET',
      path: '/v1/status',
      desc: 'API service status.',
      auth: 'none',
      exampleRes: `{ "status": "ok", "service": "degenfeed-api", "version": "1.0.0" }`,
    },
  ],
  community: [
    {
      method: 'GET',
      path: '/v1/communities',
      desc: 'List all communities across protocols.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/community/:name',
      desc: 'Get community details by name.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/community/:name/feed',
      desc: 'Get community feed.',
      auth: 'read:feed',
    },
    {
      method: 'POST',
      path: '/v1/community',
      desc: 'Create a new community (session required).',
      auth: 'read:feed',
    },
    {
      method: 'POST',
      path: '/v1/community/:name/join',
      desc: 'Join a community (session required).',
      auth: 'read:feed',
    },
  ],
  content: [
    {
      method: 'GET',
      path: '/v1/content/*',
      desc: 'Resolve df:// content URIs to canonical posts.',
      auth: 'read:feed',
    },
  ],
  leaderboard: [
    {
      method: 'GET',
      path: '/v1/leaderboard/creators',
      desc: 'Top creators by engagement across protocols.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/leaderboard/tippers',
      desc: 'Top tippers by volume.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/leaderboard/trending',
      desc: 'Trending authors right now.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/leaderboard/communities',
      desc: 'Most active communities.',
      auth: 'read:feed',
    },
  ],
  publish: [
    {
      method: 'POST',
      path: '/v1/publish',
      desc: 'Cross-post to connected protocols. Session required.',
      auth: 'write:posts',
    },
    {
      method: 'POST',
      path: '/v1/engage',
      desc: 'Like, repost, reply, bookmark across protocols. Session required.',
      auth: 'write:posts',
    },
  ],
  other: [
    { method: 'GET', path: '/v1/analytics', desc: 'Analytics data.', auth: 'read:analytics' },
    {
      method: 'GET',
      path: '/v1/notifications',
      desc: 'Unified notification inbox.',
      auth: 'read:feed',
    },
    { method: 'GET', path: '/v1/discover', desc: 'Discover trending content.', auth: 'read:feed' },
    { method: 'GET', path: '/v1/discover/people', desc: 'Who to follow.', auth: 'read:feed' },
    {
      method: 'GET',
      path: '/v1/prices',
      desc: 'Crypto prices via CoinGecko.',
      auth: 'none',
      queryParams: [
        {
          name: 'ids',
          type: 'string',
          desc: 'Comma-separated coin IDs (e.g. bitcoin,ethereum,solana)',
        },
      ],
      exampleReq: 'GET /v1/prices?ids=bitcoin,ethereum',
      exampleRes: `{ "bitcoin": { "usd": 60000 }, "ethereum": { "usd": 3400 } }`,
    },
    {
      method: 'GET',
      path: '/v1/embed/resolve',
      desc: 'Fetch OpenGraph metadata for a URL.',
      auth: 'read:feed',
    },
    {
      method: 'GET',
      path: '/v1/frame/resolve',
      desc: 'Parse Farcaster Frame meta tags from a URL.',
      auth: 'read:feed',
    },
    {
      method: 'POST',
      path: '/v1/frame/action',
      desc: 'Submit a Farcaster Frame button action.',
      auth: 'read:feed',
    },
    { method: 'GET', path: '/v1/features', desc: 'Feature flags status.', auth: 'none' },
  ],
};

const sectionOrder = [
  'feed',
  'search',
  'identity',
  'tip',
  'health',
  'community',
  'content',
  'leaderboard',
  'publish',
  'other',
];
const sectionLabels: Record<string, string> = {
  feed: 'Feed',
  search: 'Search',
  identity: 'Identity & Profiles',
  tip: 'Tipping',
  health: 'Health & Status',
  community: 'Communities',
  content: 'Content Resolution',
  leaderboard: 'Leaderboards',
  publish: 'Publish & Engage',
  other: 'Other Endpoints',
};

function EndpointRow({ ep }: { ep: Endpoint }) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2.5 transition-colors hover:border-white/10">
      <MethodBadge method={ep.method} />
      <code className="mt-0.5 flex-shrink-0 font-mono text-xs text-degen-400">{ep.path}</code>
      <span className="min-w-0 flex-1 text-xs text-[var(--color-muted)]">{ep.desc}</span>
      {ep.auth && ep.auth !== 'none' && <Badge color="purple">{ep.auth}</Badge>}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      {/* Header */}
      <section id="overview" className="scroll-mt-20">
        <div className="mb-2 flex items-center gap-2">
          <Badge color="green">v1.0.0</Badge>
          <Badge color="blue">Stable</Badge>
          <Badge color="purple">API Key Required</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
          DegenFeed API v1
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
          Build on the open social web. The DegenFeed API aggregates 9 decentralized and federated
          social networks into a single, ranked, real-time feed. All endpoints use the{' '}
          <code className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-xs text-degen-400">
            /v1/
          </code>{' '}
          prefix and require an API key.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link
            href="#authentication"
            className="group rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4 transition-all hover:border-degen-500/20 hover:bg-degen-500/[0.03]"
          >
            <div className="font-semibold text-[var(--color-fg)]">Authentication</div>
            <div className="mt-1 text-xs text-[var(--color-muted)]">
              API keys, scopes, and how to authenticate.
            </div>
          </Link>
          <Link
            href="#rate-limiting"
            className="group rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4 transition-all hover:border-degen-500/20 hover:bg-degen-500/[0.03]"
          >
            <div className="font-semibold text-[var(--color-fg)]">Rate Limits</div>
            <div className="mt-1 text-xs text-[var(--color-muted)]">
              Free and premium tier limits with retry guidance.
            </div>
          </Link>
          <Link
            href="#sdks"
            className="group rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4 transition-all hover:border-degen-500/20 hover:bg-degen-500/[0.03]"
          >
            <div className="font-semibold text-[var(--color-fg)]">SDK Examples</div>
            <div className="mt-1 text-xs text-[var(--color-muted)]">
              JavaScript, Python, and curl quickstarts.
            </div>
          </Link>
        </div>
      </section>
      {/* Authentication */}
      <H2 id="authentication">Authentication</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        All v1 API endpoints require authentication via an API key sent in the{' '}
        <code className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-xs text-degen-400">
          Authorization
        </code>{' '}
        header:
      </p>
      <CodeBlock>{`Authorization: Bearer df_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>
      <H3 id="get-api-key">Getting an API key</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Generate an API key from your{' '}
        <Link href="/profile/settings/api" className="text-degen-400 underline">
          profile settings
        </Link>
        . Each key can be limited to specific scopes:
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Scope</th>
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Permission</th>
              <th className="py-2 font-medium text-[var(--color-muted)]">Endpoints</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-muted)]">
            {[
              ['read:feed', 'Read feeds and search posts', 'Feed, search, discover, prices'],
              ['write:posts', 'Publish and engage', 'Publish, engage (session required)'],
              ['read:identity', 'Resolve identities', 'Identity resolution, profiles'],
              ['write:tip', 'Send tips', 'Tip creation, invoices'],
              ['read:analytics', 'Read analytics', 'Analytics endpoints'],
            ].map(([scope, perm, endpoints]) => (
              <tr key={scope} className="border-b border-white/[0.02]">
                <td className="py-2 pr-4 font-mono text-degen-400 text-xs">{scope}</td>
                <td className="py-2 pr-4 text-xs">{perm}</td>
                <td className="py-2 text-xs">{endpoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H3 id="scope-scope-errors">Error responses</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Invalid or missing API keys return 401. Keys without sufficient scope return 403.
      </p>
      <CodeBlock>{`// 401 — Invalid key
{ "error": "Invalid or revoked API key" }

// 403 — Insufficient scope
{ "error": "Missing required scopes: write:tip" }`}</CodeBlock>
      {/* Rate Limiting */}
      <H2 id="rate-limiting">Rate Limiting</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        API keys are rate-limited per key based on tier:
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Tier</th>
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Rate Limit</th>
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Window</th>
              <th className="py-2 font-medium text-[var(--color-muted)]">Retry-After</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-muted)]">
            <tr className="border-b border-white/[0.02]">
              <td className="py-2 pr-4">
                <Badge color="gray">Free</Badge>
              </td>
              <td className="py-2 pr-4 font-mono text-xs">1,000 req</td>
              <td className="py-2 pr-4 font-mono text-xs">1 hour</td>
              <td className="py-2 text-xs">Retry-After header (seconds)</td>
            </tr>
            <tr className="border-b border-white/[0.02]">
              <td className="py-2 pr-4">
                <Badge color="yellow">Premium</Badge>
              </td>
              <td className="py-2 pr-4 font-mono text-xs">10,000 req</td>
              <td className="py-2 pr-4 font-mono text-xs">1 hour</td>
              <td className="py-2 text-xs">Retry-After header (seconds)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
        When exceeded, the API returns a 429 response with a Retry-After header. The response body
        includes the tier, limit, and remaining retry time.
      </p>
      <CodeBlock>{`// 429 — Rate limit exceeded
{
  "error": "Rate limit exceeded",
  "retryAfterMs": 1800000,
  "tier": "free",
  "limit": 1000,
  "window": "1h"
}`}</CodeBlock>
      <div className="my-8 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
        <div className="flex gap-3">
          <span className="mt-0.5 flex-shrink-0 text-sm">⚠</span>
          <div className="min-w-0 text-sm text-[var(--color-muted)]">
            <strong>Legacy API deprecation:</strong> The{' '}
            <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs text-degen-400">
              /api/*
            </code>{' '}
            routes are deprecated and will be removed on <strong>November 1, 2026</strong>. Migrate
            to{' '}
            <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs text-degen-400">
              /v1/*
            </code>{' '}
            before then. Legacy routes include deprecation headers in responses.
          </div>
        </div>
      </div>
      {/* Endpoints */}
      <H2 id="endpoints">Endpoints</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Base URL:{' '}
        <code className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-xs text-degen-400">
          https://degenfeed.xyz/v1/
        </code>
        . All responses return JSON. Timestamps are in milliseconds since Unix epoch.
      </p>
      {sectionOrder.map((section) => (
        <div key={section}>
          <H3 id={`section-${section}`}>{sectionLabels[section]}</H3>
          <div className="space-y-1">
            {endpoints[section]
              ?.filter((ep) => ep)
              .map((ep) => (
                <EndpointRow key={`${ep.method}-${ep.path}`} ep={ep} />
              ))}
          </div>

          {/* Show detail for endpoints with examples */}
          {endpoints[section]
            ?.filter(
              (ep) =>
                ep.exampleReq || ep.exampleRes || (ep.queryParams && ep.queryParams.length > 0),
            )
            .slice(0, 2)
            .map((ep) => (
              <div
                key={`detail-${ep.method}-${ep.path}`}
                className="mt-4 mb-6 rounded-lg border border-white/[0.05] bg-white/[0.01] p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <MethodBadge method={ep.method} />
                  <code className="font-mono text-xs text-degen-400">{ep.path}</code>
                </div>
                {ep.queryParams && ep.queryParams.length > 0 && (
                  <div className="mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Query Parameters
                    </span>
                    <div className="mt-1 space-y-1">
                      {ep.queryParams.map((p) => (
                        <div key={p.name} className="flex items-baseline gap-3 text-xs">
                          <code className="font-mono text-degen-400">{p.name}</code>
                          <span className="text-[var(--color-muted)]">{p.type}</span>
                          {p.required && <span className="text-red-400">required</span>}
                          <span className="text-[var(--color-muted)]">{p.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {ep.exampleReq && (
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                        Request
                      </span>
                      <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-3 font-mono text-[11px] text-[var(--color-muted)]">
                        {ep.exampleReq}
                      </pre>
                    </div>
                  )}
                  {ep.exampleRes && (
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                        Response
                      </span>
                      <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-3 font-mono text-[11px] text-[var(--color-muted)]">
                        {ep.exampleRes}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      ))}
      {/* SDK Examples */}
      <H2 id="sdks">SDK Examples</H2>
      <H3 id="curl">curl</H3>
      <CodeBlock>{`# Get the trending feed
curl -H "Authorization: Bearer df_key_..." \\
  "https://degenfeed.xyz/v1/feed/home?sort=hot&limit=10"

# Search for Bitcoin posts
curl -H "Authorization: Bearer df_key_..." \\
  "https://degenfeed.xyz/v1/search?q=bitcoin&limit=5"

# Resolve an identity
curl -H "Authorization: Bearer df_key_..." \\
  "https://degenfeed.xyz/v1/identity/resolve?handle=vitalik.eth"

# Check protocol health (no auth required)
curl "https://degenfeed.xyz/v1/health/protocols"`}</CodeBlock>
      <H3 id="javascript">JavaScript / TypeScript</H3>
      <CodeBlock>{`// Install: npm install @degenfeed/api-client
import { DegenFeedClient } from '@degenfeed/api-client';

const client = new DegenFeedClient({
  apiKey: 'df_key_...',
});

// Get the trending feed
const feed = await client.feed.home({
  protocols: ['nostr', 'farcaster'],
  sort: 'hot',
  limit: 20,
});

// Search
const results = await client.search.query('bitcoin');

// Resolve identity
const identity = await client.identity.resolve('vitalik.eth');

// console.log(feed.posts, results.results, identity.resolved);`}</CodeBlock>
      {/* */}
      <CodeBlock>{`// Or use fetch directly
// const API_KEY = 'df_key_...';
// const BASE = 'https://degenfeed.xyz/v1';
//
// async function getFeed() {
//   const res = await fetch(\`\${BASE}/feed/home?sort=hot&limit=10\`, {
//     headers: { Authorization: \`Bearer \${API_KEY}\` },
//   });
  if (!res.ok) throw new Error(\`API error: \${res.status}\`);
  return res.json();
}

async function searchIdentity(handle) {
  const res = await fetch(\`\${BASE}/identity/resolve?handle=\${handle}\`, {
    headers: { Authorization: \`Bearer \${API_KEY}\` },
  });
  return res.json();
}`}</CodeBlock>
      <H3 id="python">Python</H3>
      <CodeBlock>{`# Install: pip install degenfeed-client
from degenfeed import DegenFeedClient

client = DegenFeedClient(api_key="df_key_...")

# Get the trending feed
feed = client.feed.home(protocols=["nostr", "farcaster"], sort="hot", limit=20)

# Search
results = client.search.query("bitcoin")

# Resolve identity
identity = client.identity.resolve("vitalik.eth")

print(feed, results, identity)`}</CodeBlock>
      <CodeBlock>{`# Or use httpx directly
import httpx

API_KEY = "df_key_..."
BASE = "https://degenfeed.xyz/v1"

def get_feed():
    res = httpx.get(
        f"{BASE}/feed/home",
        params={"sort": "hot", "limit": 10},
        headers={"Authorization": f"Bearer {API_KEY}"},
    )
    res.raise_for_status()
    return res.json()

def search_identity(handle: str):
    res = httpx.get(
        f"{BASE}/identity/resolve",
        params={"handle": handle},
        headers={"Authorization": f"Bearer {API_KEY}"},
    )
    return res.json()`}</CodeBlock>
      {/* Migration guide */}
      <H2 id="migration">Migration from v0 (legacy /api/)</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        The legacy{' '}
        <code className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-xs text-degen-400">
          /api/*
        </code>{' '}
        routes are deprecated. To migrate:
      </p>
      <ol className="mt-3 space-y-2 text-sm text-[var(--color-muted)] list-decimal list-inside">
        <li>
          Replace{' '}
          <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs">/api/</code> with{' '}
          <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs">/v1/</code> in
          all request paths
        </li>
        <li>Generate an API key from your profile settings</li>
        <li>
          Add the{' '}
          <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs">
            Authorization: Bearer df_key_...
          </code>{' '}
          header to all requests
        </li>
        <li>
          Check the{' '}
          <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs">
            Deprecation
          </code>{' '}
          and <code className="rounded bg-[var(--color-muted)] px-1 font-mono text-xs">Sunset</code>{' '}
          response headers on legacy routes for the migration deadline
        </li>
      </ol>
      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          Questions? Join our{' '}
          <a href="/c/developers" className="text-degen-400 underline">
            Developer Community
          </a>
          . Report issues on{' '}
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed"
            target="_blank"
            rel="noopener noreferrer"
            className="text-degen-400 underline"
          >
            Forgejo
          </a>
          .
        </p>
      </div>
    </div>
  );
}
