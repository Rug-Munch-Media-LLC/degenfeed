import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '../_components/doc-badge';
import { DocBreadcrumbs } from '../_components/doc-breadcrumbs';
import { Callout } from '../_components/doc-callout';
import { CodeBlock, CodeTabs } from '../_components/doc-code-block';
import { H2, H3 } from '../_components/doc-heading';
import { DocTable, MethodBadge } from '../_components/doc-table';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'API Reference — DegenFeed',
  description:
    'Complete API reference for DegenFeed. Authentication, rate limits, feed endpoints, tipping, identity, search, and error codes.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/api' },
  openGraph: {
    title: 'DegenFeed API Reference',
    description: 'Complete API documentation with code examples in JavaScript, Python, and curl.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed API Reference',
    description: 'Complete API documentation with code examples in JavaScript, Python, and curl.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
};

const feedEndpoints = [
  {
    method: 'GET',
    path: '/api/feed/home',
    desc: 'Aggregated ranked feed across all protocols. Primary feed endpoint.',
    tryIt: '/home/all?sort=hot',
  },
  {
    method: 'GET',
    path: '/api/feed/trending',
    desc: 'Trending posts by engagement velocity.',
    tryIt: '/home/all?sort=hot',
  },
  {
    method: 'GET',
    path: '/api/feed/news',
    desc: 'Curated news feed from RSS, Mastodon, and Bluesky.',
    tryIt: '/news',
  },
  {
    method: 'GET',
    path: '/api/feed/stream',
    desc: 'Server-Sent Events real-time feed.',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/:protocol',
    desc: 'Per-protocol feed. Replace :protocol with nostr, farcaster, lens, bluesky, mastodon, lemmy, reddit, rss.',
    tryIt: '/home/nostr?sort=hot',
  },
  {
    method: 'GET',
    path: '/api/feed/category/:cat',
    desc: 'Filter by niche: defi, nft, ai, bitcoin, ethereum, solana, security, macro.',
    tryIt: '/home/all?category=defi',
  },
  {
    method: 'GET',
    path: '/api/feed/post/:id',
    desc: 'Single post by canonical ID. O(1) KV lookup.',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/post/:id/replies',
    desc: 'Thread context for a post. Nostr, Farcaster, Mastodon, Bluesky.',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/related',
    desc: 'Related posts by niche overlap + time proximity.',
    tryIt: null,
  },
  {
    method: 'GET',
    path: '/api/feed/communities',
    desc: 'Trending communities across Reddit, Lemmy, Farcaster.',
    tryIt: '/discover',
  },
  {
    method: 'GET',
    path: '/api/feed/funding',
    desc: 'Crypto venture funding tracker.',
    tryIt: '/home/funding',
  },
  { method: 'GET', path: '/api/feed/rss.xml', desc: 'RSS 2.0 feed of top posts.', tryIt: null },
  { method: 'GET', path: '/api/feed/atom.xml', desc: 'Atom 1.0 feed of top posts.', tryIt: null },
  {
    method: 'GET',
    path: '/api/feed/health',
    desc: 'Protocol health: latency and uptime per provider.',
    tryIt: '/status',
  },
];

const engagementEndpoints = [
  { method: 'POST', path: '/api/publish', desc: 'Cross-post to connected protocols.' },
  { method: 'POST', path: '/api/engage', desc: 'Like, repost, bookmark, reply.' },
  { method: 'POST', path: '/api/tip/create', desc: 'Create a crypto tip: ETH, SOL, Lightning.' },
  { method: 'GET', path: '/api/tip/resolve', desc: 'Resolve available tipping methods.' },
  { method: 'GET', path: '/api/tip/lightning/invoice', desc: 'Generate Lightning invoice.' },
];

const identityEndpoints = [
  {
    method: 'POST',
    path: '/api/auth/wallet/nonce',
    desc: 'Request signing nonce for wallet auth.',
  },
  {
    method: 'POST',
    path: '/api/auth/wallet/verify',
    desc: 'Verify wallet signature, issue session cookie.',
  },
  { method: 'POST', path: '/api/auth/gotosocial/authorize', desc: 'Start GotoSocial OAuth2 flow.' },
  { method: 'GET', path: '/api/auth/gotosocial/callback', desc: 'OAuth2 callback handler.' },
  { method: 'GET', path: '/api/auth/session', desc: 'Verify session cookie.' },
  { method: 'GET', path: '/api/identity/resolve', desc: 'Resolve handle across protocols.' },
  { method: 'GET', path: '/api/identity/profile', desc: 'Cross-platform identity profile.' },
  { method: 'GET', path: '/api/notifications', desc: 'Unified notification inbox.' },
];

const searchEndpoints = [
  {
    method: 'GET',
    path: '/api/search',
    desc: 'Cross-protocol text search. Query: ?q=bitcoin&protocols=nostr,farcaster&limit=25',
  },
  { method: 'GET', path: '/api/search/identity', desc: 'Search identities across protocols.' },
];

const otherEndpoints = [
  { method: 'GET', path: '/api/discover/people', desc: 'Who to follow — trending authors.' },
  {
    method: 'GET',
    path: '/api/embed/resolve',
    desc: 'OpenGraph metadata for a URL. 24h KV cache.',
  },
  {
    method: 'GET',
    path: '/api/frame/resolve',
    desc: 'Parse Farcaster Frame meta tags. 5min cache.',
  },
  { method: 'POST', path: '/api/frame/action', desc: 'Submit Farcaster Frame button action.' },
  { method: 'GET', path: '/v1/prices', desc: 'Crypto prices via CoinGecko. 60s cache.' },
  { method: 'POST', path: '/api/newsletter/subscribe', desc: 'Subscribe to daily digest.' },
  { method: 'GET', path: '/api/newsletter/digest', desc: 'Preview latest daily digest.' },
  { method: 'POST', path: '/api/push/subscribe', desc: 'Register PWA push subscription.' },
  { method: 'GET', path: '/api/account/export', desc: 'GDPR-compliant data export.' },
  { method: 'POST', path: '/api/account/delete', desc: 'Permanently delete account.' },
];

const errorCodes = [
  {
    status: 400,
    code: 'BAD_REQUEST',
    meaning: 'Invalid parameters',
    desc: 'Missing or malformed query parameters or request body.',
  },
  {
    status: 401,
    code: 'UNAUTHORIZED',
    meaning: 'No valid session',
    desc: 'State-changing endpoint without valid authentication.',
  },
  {
    status: 403,
    code: 'FORBIDDEN',
    meaning: 'Insufficient permissions',
    desc: 'Authenticated but not allowed for this action.',
  },
  {
    status: 404,
    code: 'NOT_FOUND',
    meaning: 'Resource not found',
    desc: 'Post, profile, or endpoint does not exist.',
  },
  {
    status: 429,
    code: 'RATE_LIMITED',
    meaning: 'Too many requests',
    desc: 'Rate limit exceeded. Retry after indicated time.',
  },
  {
    status: 500,
    code: 'INTERNAL_ERROR',
    meaning: 'Server error',
    desc: 'Unexpected server error. Try again later.',
  },
];

function EndpointRow({
  ep,
}: {
  ep: { method: string; path: string; desc: string; tryIt?: string | null };
}) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-2.5 transition-colors hover:border-white/10">
      <span className="mt-0.5 flex-shrink-0">
        <MethodBadge method={ep.method} />
      </span>
      <code className="mt-0.5 flex-shrink-0 font-mono text-xs text-degen-400">{ep.path}</code>
      <span className="min-w-0 flex-1 text-xs text-[var(--color-muted)]">{ep.desc}</span>
      {ep.tryIt && (
        <Link
          href={ep.tryIt}
          className="flex-shrink-0 rounded border border-white/10 px-2 py-0.5 text-[11px] text-[var(--color-muted)] opacity-0 transition-all hover:border-degen-500/30 hover:text-degen-400 group-hover:opacity-100"
        >
          Try →
        </Link>
      )}
    </div>
  );
}

export default function ApiPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <DocBreadcrumbs items={[{ label: 'Docs', href: '/docs' }, { label: 'API Reference' }]} />
      <div className="mb-2 flex items-center gap-2">
        <Badge>API Reference</Badge>
        <Badge color="blue">REST</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">API Reference</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        All endpoints are served from{' '}
        <code className="rounded-md bg-[var(--color-muted)]/30 px-1.5 py-0.5 font-mono text-xs text-degen-400">
          degenfeed.xyz/api/*
        </code>
        . Public read endpoints require no authentication. State-changing endpoints require a valid
        session.
      </p>

      {/* Authentication */}
      <H2 id="authentication">Authentication</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        DegenFeed uses two authentication methods depending on the endpoint:
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Public (no auth)</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            All <span className="font-mono text-degen-400">GET</span> feed and search endpoints are
            publicly accessible. Rate-limited by IP.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Session (cookie)</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            All <span className="font-mono text-degen-400">POST</span> endpoints require a valid
            session cookie obtained via wallet authentication.
          </p>
        </div>
      </div>

      <H3 id="wallet-auth">Wallet Authentication</H3>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        DegenFeed uses Sign-In with Ethereum (EIP-4361) and Solana wallet authentication. The flow
        is a standard challenge-response:
      </p>

      <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-[var(--color-muted)]">
        <li>
          Request a nonce from{' '}
          <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs text-degen-400">
            POST /api/auth/wallet/nonce
          </code>
        </li>
        <li>Ask the user to sign the nonce with their wallet</li>
        <li>
          Verify the signature at{' '}
          <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs text-degen-400">
            POST /api/auth/wallet/verify
          </code>
        </li>
        <li>A session cookie is set. Include it in subsequent requests.</li>
      </ol>

      <CodeTabs
        tabs={[
          {
            label: 'JavaScript',
            code: `// Step 1: Request nonce
const nonceRes = await fetch('https://degenfeed.xyz/api/auth/wallet/nonce', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: '0x...', chainId: 1 }),
});
const { nonce } = await nonceRes.json();

// Step 2: Sign with wallet (use ethers, viem, or web3)
// const signature = await wallet.signMessage(nonce);

// Step 3: Verify signature
const verifyRes = await fetch('https://degenfeed.xyz/api/auth/wallet/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    address: '0x...',
    message: nonce,
    signature: signature,
  }),
});

const { session } = await verifyRes.json();`,
          },
          {
            label: 'Python',
            code: `import requests

# Step 1: Request nonce
nonce_res = requests.post(
    'https://degenfeed.xyz/api/auth/wallet/nonce',
    json={'address': '0x...', 'chainId': 1}
)
nonce = nonce_res.json()['nonce']

# Step 2: Sign with wallet (use web3.py)
# signature = wallet.sign_message(nonce)

# Step 3: Verify signature
session = requests.Session()
verify_res = session.post(
    'https://degenfeed.xyz/api/auth/wallet/verify',
    json={
        'address': '0x...',
        'message': nonce,
        'signature': signature
    }
)

# Session cookie is now saved in the session object`,
          },
          {
            label: 'curl',
            code: `# Step 1: Request nonce
curl -X POST https://degenfeed.xyz/api/auth/wallet/nonce \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x...", "chainId": 1}'

# Step 2: Sign with wallet (in your wallet UI)

# Step 3: Verify and save cookie
curl -X POST https://degenfeed.xyz/api/auth/wallet/verify \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x...", "message": "<nonce>", "signature": "0x..."}' \\
  -c cookies.txt`,
          },
        ]}
      />

      {/* Rate Limits */}
      <H2 id="rate-limits">Rate Limits</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Rate limiting is enforced per IP address. The rate limiter uses Cloudflare KV for global
        consistency and fails open during KV outages.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { level: 'Anonymous', limit: '60 req / 5s', note: 'Per IP address' },
          { level: 'Authenticated', limit: '120 req / 5s', note: 'With valid session cookie' },
          { level: 'API Key', limit: '300 req / 5s', note: 'Contact us for a key' },
        ].map((r) => (
          <div
            key={r.level}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4"
          >
            <div className="text-xs font-semibold text-[var(--color-fg)]">{r.level}</div>
            <div className="mt-1 font-mono text-lg font-bold text-degen-400">{r.limit}</div>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">{r.note}</p>
          </div>
        ))}
      </div>

      <Callout type="info">
        The rate limiter fails open. A KV outage will never block legitimate traffic. Rate limit
        headers are returned as{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
          X-RateLimit-Remaining
        </code>{' '}
        and{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
          X-RateLimit-Reset
        </code>
        .
      </Callout>

      {/* Feed Endpoints */}
      <H2 id="feed-endpoints">Feed Endpoints</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Feed endpoints return paginated arrays of unified post objects. All support cursor-based
        pagination via the{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">cursor</code>{' '}
        parameter.
      </p>

      <div className="mt-4 space-y-1">
        {feedEndpoints.map((ep) => (
          <EndpointRow key={ep.path} ep={ep} />
        ))}
      </div>

      <H3 id="feed-home-example">Home Feed Request/Response</H3>
      <CodeTabs
        tabs={[
          {
            label: 'JavaScript',
            code: `const response = await fetch(
  'https://degenfeed.xyz/api/feed/home?sort=hot&protocols=nostr,farcaster&limit=5'
);
const data = await response.json();
// {
//   posts: [{ id, protocol, author, content, score, ... }],
//   cursor: "1720000000000",
//   hasMore: true
// }`,
          },
          {
            label: 'Python',
            code: `import requests

response = requests.get(
    'https://degenfeed.xyz/api/feed/home',
    params={'sort': 'hot', 'protocols': 'nostr,farcaster', 'limit': 5}
)
data = response.json()
# data['posts'] contains unified post objects`,
          },
          {
            label: 'curl',
            code: `curl "https://degenfeed.xyz/api/feed/home?sort=hot&protocols=nostr,farcaster&limit=5" \\
  | python3 -m json.tool`,
          },
        ]}
      />

      <CodeBlock lang="json" title="Response shape">{`{
  "posts": [
    {
      "id": "nostr:note1abc...",
      "protocol": "nostr",
      "author": {
        "displayName": "Alice",
        "handle": "alice@nostr",
        "avatar": "https://..."
      },
      "content": "Bitcoin is the future of money. Here's why...",
      "score": 94.2,
      "scoreReasons": [
        { "factor": "engagement", "weight": 3.5, "value": 42.1 },
        { "factor": "recency", "weight": 2.4, "value": 18.3 }
      ],
      "stats": { "likes": 142, "replies": 23, "reposts": 15 },
      "timestamp": 1720000000000,
      "media": [{ "type": "image", "url": "https://..." }]
    }
  ],
  "cursor": "1720000000000",
  "hasMore": true
}`}</CodeBlock>

      <H3 id="feed-params">Query Parameters</H3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Parameter</th>
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Default</th>
              <th className="py-2 font-medium text-[var(--color-muted)]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-muted)]">
            {[
              [
                'protocols',
                'all',
                'Comma-separated: nostr,farcaster,lens,bluesky,mastodon,lemmy,reddit,rss (threads requires explicit opt-in; experimental)',
              ],
              ['sort', 'scored', 'scored | hot | new | top'],
              ['limit', '50', '1-200 posts per page'],
              [
                'category',
                '',
                'Filter by niche: defi, ai, bitcoin, ethereum, solana, security, macro',
              ],
              ['type', '', 'Content type: video, article, image, thread, link, text'],
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

      {/* Tipping Endpoints */}
      <H2 id="tipping-endpoints">Tipping Endpoints</H2>
      <div className="mt-4 space-y-1">
        {engagementEndpoints.slice(2).map((ep) => (
          <EndpointRow key={ep.path} ep={ep} />
        ))}
      </div>

      <CodeTabs
        tabs={[
          {
            label: 'curl',
            code: `# Create a 0.01 ETH tip
curl -X POST https://degenfeed.xyz/api/tip/create \\
  -H "Content-Type: application/json" \\
  -H "Cookie: session=..." \\
  -d '{
    "postId": "nostr:note1abc...",
    "currency": "ETH",
    "amount": "0.01",
    "recipientAddress": "0x..."
  }'

# Resolve tipping methods for a post
curl "https://degenfeed.xyz/api/tip/resolve?postId=nostr:note1abc..."

# Generate Lightning invoice
curl "https://degenfeed.xyz/api/tip/lightning/invoice?amount=1000&pubkey=<npub>"`,
          },
        ]}
      />

      {/* Identity Endpoints */}
      <H2 id="identity-endpoints">Identity &amp; Auth Endpoints</H2>
      <div className="mt-4 space-y-1">
        {identityEndpoints.map((ep) => (
          <EndpointRow key={ep.path} ep={ep} />
        ))}
      </div>

      {/* Search Endpoints */}
      <H2 id="search-endpoints">Search Endpoints</H2>
      <div className="mt-4 space-y-1">
        {searchEndpoints.map((ep) => (
          <EndpointRow key={ep.path} ep={ep} />
        ))}
      </div>

      <CodeBlock lang="bash">{`# Cross-protocol text search
curl "https://degenfeed.xyz/api/search?q=bitcoin&protocols=nostr,farcaster&limit=25"

# Search for identities
curl "https://degenfeed.xyz/api/search/identity?q=vitalik"`}</CodeBlock>

      {/* Discover & Other */}
      <H2 id="other-endpoints">Discover &amp; Other Endpoints</H2>
      <div className="mt-4 space-y-1">
        {otherEndpoints.map((ep) => (
          <EndpointRow key={ep.path} ep={ep} />
        ))}
      </div>

      {/* Error Codes */}
      <H2 id="error-codes">Error Codes</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        All errors return a consistent JSON structure with an appropriate HTTP status code.
      </p>

      <CodeBlock lang="json" title="Error response format">{`{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Try again in 3 seconds.",
    "status": 429,
    "retryAfter": 3
  }
}`}</CodeBlock>

      <DocTable
        columns={[
          {
            header: 'Status',
            key: 'status',
            render: (v) => <span className="font-mono text-yellow-400">{String(v)}</span>,
          },
          {
            header: 'Code',
            key: 'code',
            render: (v) => <span className="font-mono text-degen-400">{String(v)}</span>,
          },
          { header: 'Meaning', key: 'meaning' },
          { header: 'Description', key: 'desc' },
        ]}
        data={errorCodes}
      />

      <Callout type="tip">
        All errors include a{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
          retryAfter
        </code>{' '}
        field for 429 responses. Always retry with exponential backoff for 5xx errors.
      </Callout>

      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          Questions about the API?{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>
        </p>
      </div>
    </div>
  );
}
