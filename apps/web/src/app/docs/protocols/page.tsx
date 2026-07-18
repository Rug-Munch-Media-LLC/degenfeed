import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '../_components/doc-badge';
import { Callout } from '../_components/doc-callout';
import { CodeBlock } from '../_components/doc-code-block';
import { H2, H3 } from '../_components/doc-heading';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Protocol Integration Guide — DegenFeed',
  description:
    'How DegenFeed integrates Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, Threads, Reddit, and RSS protocols. Data sources, limitations, and rate limits.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/protocols' },
  openGraph: {
    title: 'DegenFeed Protocol Integration Guide',
    description: 'Detailed protocol integration guide for all 9 supported networks plus RSS/Atom.',
  },
};

interface ProtocolInfo {
  id: string;
  name: string;
  color: string;
  endpoint: string;
  status: 'Production' | 'Beta' | 'Read-only';
  data: string[];
  auth: string;
  limits: string;
  health: string;
}

const protocols: ProtocolInfo[] = [
  {
    id: 'nostr',
    name: 'Nostr',
    color: '#8b5cf6',
    endpoint: 'wss://relay.damus.io (default)',
    status: 'Production',
    data: [
      'Kind 1 text notes with Markdown content',
      'Kind 6 reposts (reblogs)',
      'Kind 7 reactions (likes)',
      'Kind 30023 long-form articles',
      'Kind 9734 zap requests (Lightning)',
      'Profile metadata (NIP-01, NIP-05)',
      'Relay list (NIP-65)',
    ],
    auth: 'NIP-07 browser extension (Alby, nos2x) or direct nsec/npub. NIP-46 remote signing. All signing client-side.',
    limits:
      'Relay-dependent. Typical limits: 1 req/s per relay. Some relays cap at 500 chars for Kind 1. DegenFeed uses a relay pool of 10 relays for redundancy.',
    health:
      'Relay connection health, message latency, and subscription success rate. Circuit breaker trips after 5 consecutive failures.',
  },
  {
    id: 'farcaster',
    name: 'Farcaster',
    color: '#8a63d2',
    endpoint: 'hub.farcaster.standardcrypto.vc:2283',
    status: 'Production',
    data: [
      'Cast Adds (text posts with embeds)',
      'Reactions (likes, recasts)',
      'Replies with thread context',
      'User profiles with verified addresses',
      'Farcaster Frames metadata',
      'Channel membership and posts',
    ],
    auth: 'Wallet-based. Sign with the wallet owning your Farcaster ID. Hub API confirms identity via Ed25519 signatures.',
    limits:
      'Hub-specific rate limits. Public Hubs: ~100 req/min. DegenFeed runs multiple Hub connections for redundancy.',
    health:
      'Hub sync status, gRPC latency, protobuf decode success rate. Automatic failover between Hub endpoints.',
  },
  {
    id: 'lens',
    name: 'Lens',
    color: '#abfe2c',
    endpoint: 'api-v2.lens.dev/graphql',
    status: 'Production',
    data: [
      'Publications (posts, mirrors, comments)',
      'Reactions (upvotes, downvotes)',
      'Profile data with stats',
      'Explore feed (ML-ranked)',
      'Collects (NFT minting)',
      'Open Actions',
    ],
    auth: 'Challenge-response signing via connected wallet. Lens profile must exist on Polygon.',
    limits: 'GraphQL API: ~10 req/s per IP. Polygon RPC: ~100 req/s (Lens-specific endpoints).',
    health:
      'GraphQL query latency, Polygon RPC health, mutation success rate. Temperature monitoring for rate limit proximity.',
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    color: '#1185fe',
    endpoint: 'public.api.bsky.app (read) / bsky.social (write)',
    status: 'Production',
    data: [
      'Feed posts with rich text (facets)',
      'Reposts, likes, replies',
      'Thread view via getPostThread',
      'User profiles with DID resolution',
      'Feed generation and custom feeds',
      'Embedded media (images, videos)',
    ],
    auth: 'AT Protocol XRPC session. App password required (create in Bluesky Settings → App Passwords).',
    limits: 'PDS-dependent. Public API: ~3000 req/5min. DegenFeed caches aggressively (60s TTL).',
    health:
      'PDS response time, XRPC method availability, rate limit headroom. Automatic cache extension during degradation.',
  },
  {
    id: 'mastodon',
    name: 'Mastodon / ActivityPub',
    color: '#6364ff',
    endpoint: 'social.degenfeed.xyz (GotoSocial v0.22)',
    status: 'Production',
    data: [
      'Statuses (posts with content warning support)',
      'Favourites, boosts, replies',
      'Notifications (mentions, follows)',
      'Timelines (home, local, federated)',
      'Trending tags',
      'Account profiles with federation data',
    ],
    auth: 'OAuth2 via GotoSocial instance. User requests account at social.degenfeed.xyz, then authorizes via standard OAuth flow.',
    limits:
      'Instance-dependent. GotoSocial: ~300 req/5min. 15+ public instances aggregated for diverse content.',
    health:
      'Instance response time, OAuth token expiry, ActivityPub federation lag. Per-instance circuit breakers.',
  },
  {
    id: 'lemmy',
    name: 'Lemmy',
    color: '#00b868',
    endpoint: 'lemmy.world/api/v3',
    status: 'Beta',
    data: [
      'Posts with title, body, and URL',
      'Upvote/downvote counts',
      'Comment counts',
      'Community listings',
      'User profiles',
    ],
    auth: 'No authentication required for read-only. Write not yet implemented.',
    limits:
      'Instance-dependent. lemmy.world: ~60 req/min. 15 curated crypto/tech communities across 3 instances.',
    health:
      'API response time, community data freshness. Auto-suspension if instance becomes unresponsive.',
  },
  {
    id: 'threads',
    name: 'Threads (Experimental)',
    color: '#888888',
    endpoint: 'threads.net (HTML scraping)',
    status: 'Read-only',
    data: [
      'Posts from curated crypto/tech handles',
      'Engagement metrics (likes, replies)',
      'JSON-LD metadata extraction',
      '__INITIAL_STATE__ parsing for structured data',
    ],
    auth: 'No authentication required. Public HTML scraping only.',
    limits:
      'No formal API (Meta has not released one). DegenFeed uses FlareSolverr for Cloudflare bypass. 16 curated handles.',
    health:
      'HTML parse success rate, Cloudflare challenge frequency, data freshness. Degraded if FlareSolverr unavailable.',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    color: '#ff4500',
    endpoint: 'old.reddit.com/.rss (primary)',
    status: 'Production',
    data: [
      'Posts from 91 default subreddits',
      'Real engagement data (ups, num_comments)',
      'Post metadata (title, selftext, URL)',
      'Flairs and categories',
    ],
    auth: 'No API key required for RSS and JSON paths. API key available for authenticated endpoints.',
    limits:
      'Triple strategy: RSS feeds, JSON API, community frontends (Redlib, Libreddit, Teddit). 60 req/min with API key.',
    health:
      'RSS feed freshness, JSON API response time, frontend fallback availability. Degraded during API changes.',
  },
  {
    id: 'rss',
    name: 'RSS / Atom',
    color: '#ffa500',
    endpoint: '353+ feed URLs',
    status: 'Production',
    data: [
      'Normalized feed entries from 353+ sources',
      'Custom fields: dc:creator, content:encoded, media:content',
      'Source adapters: Reddit, Mirror.xyz, Substack, Medium',
      '68 YouTube channels (via RSS)',
      'arXiv, Hacker News, PeerTube',
      'Generic feed support',
    ],
    auth: 'No authentication. Public RSS/Atom feeds only.',
    limits:
      'Configurable per-source refresh interval (default: 15-60min). Rate limits determined by source servers.',
    health:
      'Feed parse success rate, staleness tracking, source adapter error rate. Circuit breaker for persistently failing feeds.',
  },
];

const statusColors: Record<string, 'green' | 'yellow' | 'gray'> = {
  Production: 'green',
  Beta: 'yellow',
  'Read-only': 'gray',
};

export default function ProtocolsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-2 flex items-center gap-2">
        <Badge>Protocols</Badge>
        <Badge color="purple">9 Protocols + RSS</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
        Protocol Integration Guide
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-400">
        DegenFeed aggregates content from 9 decentralized and federated protocols plus RSS/Atom.
        Each protocol has a dedicated provider adapter that handles authentication, content
        normalization, and health monitoring.
      </p>

      {/* Protocol cards */}
      <div className="mt-8 space-y-5">
        {protocols.map((p) => (
          <div
            key={p.id}
            id={p.id}
            className="scroll-mt-24 rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--color-fg)]">{p.name}</h3>
                    <Badge color={statusColors[p.status]}>{p.status}</Badge>
                  </div>

                  <div className="mt-2">
                    <code className="inline-block rounded-md bg-[var(--color-muted)]/30 px-2 py-0.5 font-mono text-[11px] text-degen-400">
                      {p.endpoint}
                    </code>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                        Data Fetched
                      </div>
                      <ul className="space-y-1">
                        {p.data.map((d) => (
                          <li key={d} className="flex items-start gap-1.5 text-xs text-gray-400">
                            <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-degen-500/50" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                        Authentication
                      </div>
                      <p className="text-xs text-gray-400">{p.auth}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3">
                      <div className="text-xs font-semibold text-[var(--color-fg)]">
                        Rate Limits
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{p.limits}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3">
                      <div className="text-xs font-semibold text-[var(--color-fg)]">
                        Health Monitoring
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{p.health}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Adding a New Protocol */}
      <H2 id="adding-new-protocols">Adding a New Protocol</H2>
      <p className="text-sm leading-relaxed text-gray-400">
        DegenFeed is designed to be extensible. Adding a new protocol requires implementing a
        provider that follows the standard interface.
      </p>

      <Callout type="info">
        Before implementing a new provider, check that the protocol has a public API that provides
        read access to content and (optionally) write access for posting.
      </Callout>

      <H3 id="provider-interface">Provider Interface</H3>
      <CodeBlock lang="typescript">{`interface ProtocolProvider {
  /** Unique identifier for this protocol */
  id: string;

  /** Fetch latest posts (used by the worker) */
  fetch(options: FetchOptions): Promise<RawPost[]>;

  /** Normalize a protocol-specific post to UnifiedPost */
  normalize(raw: RawPost): UnifiedPost;

  /** Health check - returns latency in ms or throws */
  healthCheck(): Promise<number>;

  /** Optional: authenticate a user */
  authenticate?(credentials: AuthCredentials): Promise<AuthResult>;

  /** Optional: publish a post */
  publish?(post: PublishOptions): Promise<PublishResult>;

  /** Optional: engage (like, repost, reply) */
  engage?(action: EngageAction): Promise<void>;
}`}</CodeBlock>

      <H3 id="implementation-steps">Implementation Steps</H3>
      <ol className="mt-4 space-y-3">
        {[
          [
            'Create provider package',
            'Add a new package in packages/feed-providers/{protocol}-sdk/.',
          ],
          ['Implement the interface', 'Create a provider class that implements ProtocolProvider.'],
          [
            'Add normalization',
            'Map raw protocol data to UnifiedPost in packages/feed-core/normalizers/.',
          ],
          [
            'Register in router',
            'Add the provider to the worker router at workers/api/src/providers/.',
          ],
          ['Add caching', 'Configure KV cache TTL and refresh strategy.'],
          ['Add health monitoring', 'Implement health checks and circuit breaker thresholds.'],
          ['Add frontend support', 'Add to the protocol selector in the frontend.'],
          ['Write tests', 'Add unit and integration tests for the provider.'],
        ].map(([step, desc], i) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-gray-400">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
              {i + 1}
            </span>
            <div>
              <strong className="text-gray-300">{step}</strong>
              <p className="mt-0.5 text-gray-500">{desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <H3 id="example-provider">Minimal Provider Example</H3>
      <CodeBlock lang="typescript">{`import { ProtocolProvider, RawPost, UnifiedPost } from '@degenfeed/types';

export class MyProtocolProvider implements ProtocolProvider {
  id = 'myprotocol';
  private baseUrl = 'https://api.myprotocol.io';

  async fetch(options: FetchOptions): Promise<RawPost[]> {
    const url = \`\${this.baseUrl}/posts?limit=\${options.limit}&cursor=\${options.cursor}\`;
    const res = await fetch(url);
    const data = await res.json();
    return data.posts;
  }

  normalize(raw: RawPost): UnifiedPost {
    return {
      id: \`myprotocol:\${raw.id}\`,
      protocol: 'myprotocol',
      author: {
        displayName: raw.author.name,
        handle: raw.author.handle,
        avatar: raw.author.avatarUrl,
      },
      content: raw.body,
      timestamp: new Date(raw.createdAt).getTime(),
      stats: {
        likes: raw.likeCount,
        replies: raw.commentCount,
        reposts: raw.shareCount,
      },
    };
  }

  async healthCheck(): Promise<number> {
    const start = Date.now();
    await fetch(\`\${this.baseUrl}/health\`);
    return Date.now() - start;
  }
}`}</CodeBlock>

      <H3 id="registering">Registering the Provider</H3>
      <CodeBlock lang="typescript">{`// In workers/api/src/providers/index.ts
import { MyProtocolProvider } from './myprotocol';

export const providers: Record<string, ProtocolProvider> = {
  nostr: new NostrProvider(),
  farcaster: new FarcasterProvider(),
  lens: new LensProvider(),
  bluesky: new BlueskyProvider(),
  // ... existing providers
  myprotocol: new MyProtocolProvider(),
};`}</CodeBlock>

      <Callout type="tip">
        Follow the existing provider patterns in{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
          packages/feed-providers/
        </code>
        . The Nostr provider is the most complete example. Submit a PR when your provider is ready!
      </Callout>

      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-gray-600">
          Want to contribute a new protocol?{' '}
          <Link href="/docs/contributing" className="text-degen-400 underline">
            Check the contributing guide
          </Link>
        </p>
      </div>
    </div>
  );
}
