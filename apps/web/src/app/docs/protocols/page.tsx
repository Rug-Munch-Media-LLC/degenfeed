import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '../_components/doc-badge';
import { DocBreadcrumbs } from '../_components/doc-breadcrumbs';
import { Callout } from '../_components/doc-callout';
import { CodeBlock } from '../_components/doc-code-block';
import { H2, H3 } from '../_components/doc-heading';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Protocol Integration Guide — DegenFeed',
  description:
    'How DegenFeed integrates Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, Threads, Reddit, PeerTube, YouTube, Owncast, Odysee, Rumble, Minds, Substack, Mirror, Paragraph and RSS protocols. Data sources, limitations, and rate limits.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/protocols' },
  openGraph: {
    title: 'DegenFeed Protocol Integration Guide',
    description: 'Detailed protocol integration guide for all 18 supported networks plus RSS/Atom.',
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
  {
    id: 'peertube',
    name: 'PeerTube',
    color: '#f2690d',
    endpoint: 'peertube-provider (federated instances)',
    status: 'Production',
    data: [
      'Federated video catalog from public instances',
      'Live streams (RTMP ingest relay)',
      'Creator channels and uploads',
      'Video engagement metrics',
    ],
    auth: 'Optional account for uploading. Read-only aggregation of public instances.',
    limits:
      'Instance-dependent. Aggregates 20+ public instances; per-instance API rate limits apply.',
    health:
      'Instance response time, federation lag, upload/stream relay status. Per-instance circuit breakers.',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: '#ff0000',
    endpoint: 'youtube-provider + 68 RSS channels',
    status: 'Production',
    data: [
      'Channel videos and metadata',
      'Trending and featured content',
      'Live streams via Invidious aggregation',
      'Video engagement metrics',
    ],
    auth: 'No authentication for read-only RSS-based aggregation.',
    limits: 'Invidious instance rate limits; RSS channel polling (default 15-60min).',
    health:
      'Invidious instance availability, RSS freshness, video parse success rate. Degraded when Invidious instances are blocked.',
  },
  {
    id: 'owncast',
    name: 'Owncast',
    color: '#8e30eb',
    endpoint: 'owncast register adapter',
    status: 'Beta',
    data: [
      'Live streams from Owncast instances',
      'Stream metadata and chat',
      'Federated discovery of self-hosted broadcasters',
    ],
    auth: 'Instance URL + admin key required for stream registration. Read-only for viewers.',
    limits: 'Per-instance. Self-hosted instances define their own limits.',
    health: 'Instance reachability, stream liveness, registration success rate.',
  },
  {
    id: 'odysee',
    name: 'Odysee',
    color: '#ef1970',
    endpoint: 'Odysee API + RSS',
    status: 'Beta',
    data: [
      'Channel videos and livestreams',
      'Comments and engagement',
      'Content claims (LBRY protocol)',
    ],
    auth: 'No authentication for read-only aggregation.',
    limits: 'Odysee API rate limits; RSS polling fallback.',
    health: 'API response time, claim resolution success rate, data freshness.',
  },
  {
    id: 'rumble',
    name: 'Rumble',
    color: '#85c742',
    endpoint: 'Rumble RSS + public pages',
    status: 'Read-only',
    data: ['Channel videos and livestreams', 'Public engagement metrics', 'RSS feed aggregation'],
    auth: 'No authentication. Public HTML/RSS only.',
    limits: 'RSS polling interval (15-60min). No formal public API.',
    health: 'Feed parse success rate, page fetch reliability, data freshness.',
  },
  {
    id: 'minds',
    name: 'Minds',
    color: '#25d366',
    endpoint: 'Minds API (public feeds)',
    status: 'Beta',
    data: [
      'Public posts from curated channels',
      'Token-gated community content',
      'Engagement metrics',
    ],
    auth: 'No authentication for public read-only feeds.',
    limits: 'Minds API rate limits. Curated channel list.',
    health: 'API response time, feed parse success rate, token-gate resolution.',
  },
  {
    id: 'substack',
    name: 'Substack',
    color: '#ff6719',
    endpoint: 'Substack RSS feeds',
    status: 'Production',
    data: [
      'Newsletter posts from 30+ crypto/tech publications',
      'Full-text articles via RSS',
      'Author metadata and publication info',
    ],
    auth: 'No authentication. Public RSS feeds only.',
    limits: 'Per-publication RSS refresh interval (default 15-60min).',
    health: 'Feed parse success rate, staleness tracking, publication availability.',
  },
  {
    id: 'mirror',
    name: 'Mirror',
    color: '#7c3aed',
    endpoint: 'Mirror.xyz /feed/atom',
    status: 'Production',
    data: [
      'On-chain publishing articles (Arweave-backed)',
      'Token-gated entries and editions',
      'Author collections via RSS/Atom',
    ],
    auth: 'No authentication. Public RSS/Atom feeds only.',
    limits: 'Per-publication RSS refresh interval.',
    health: 'Feed parse success rate, Arweave gateway reachability, entry freshness.',
  },
  {
    id: 'paragraph',
    name: 'Paragraph',
    color: '#00bfff',
    endpoint: 'paragraph.xyz /feed',
    status: 'Production',
    data: [
      'On-chain newsletter posts',
      'Token-gated content collections',
      'Author publications via RSS',
    ],
    auth: 'No authentication. Public RSS feeds only.',
    limits: 'Per-publication RSS refresh interval.',
    health: 'Feed parse success rate, publication availability, token-gate resolution.',
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
      <DocBreadcrumbs items={[{ label: 'Docs', href: '/docs' }, { label: 'Protocols' }]} />
      <div className="mb-2 flex items-center gap-2">
        <Badge>Protocols</Badge>
        <Badge color="purple">18 Protocols</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
        Protocol Integration Guide
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        DegenFeed aggregates content from 18 decentralized, federated, and publishing protocols plus
        RSS/Atom. Each protocol has a dedicated provider adapter that handles authentication,
        content normalization, and health monitoring.
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
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
                        Data Fetched
                      </div>
                      <ul className="space-y-1">
                        {p.data.map((d) => (
                          <li
                            key={d}
                            className="flex items-start gap-1.5 text-xs text-[var(--color-muted)]"
                          >
                            <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-degen-500/50" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
                        Authentication
                      </div>
                      <p className="text-xs text-[var(--color-muted)]">{p.auth}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3">
                      <div className="text-xs font-semibold text-[var(--color-fg)]">
                        Rate Limits
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">{p.limits}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3">
                      <div className="text-xs font-semibold text-[var(--color-fg)]">
                        Health Monitoring
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">{p.health}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How to use each protocol through DegenFeed */}
      <H2 id="using-each-protocol">Using Each Protocol Through DegenFeed</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Here&rsquo;s how to connect, read, and post to each supported network from the DegenFeed
        interface. For posting to multiple networks at once, see the{' '}
        <Link href="/docs/cross-posting" className="text-degen-400 underline">
          Cross-Posting Guide
        </Link>
        .
      </p>

      <div className="mt-6 space-y-3">
        {[
          {
            name: 'Nostr',
            connect:
              'Install a NIP-07 browser extension (Alby, nos2x) or paste your nsec/npub. Keys never leave your device — all signing is client-side with Schnorr signatures.',
            use: 'Read kind-1 notes, kind-6 reposts, kind-7 reactions, and kind-30023 long-form articles. Tip creators with Lightning zaps (LNURL).',
          },
          {
            name: 'Farcaster',
            connect:
              'Sign in with the wallet that owns your Farcaster ID. The Hub API confirms your identity via Ed25519 signatures.',
            use: 'Read casts, replies, reactions, and channels. Post up to 320 characters with embeds. Open interactive Frames directly from the feed.',
          },
          {
            name: 'Lens',
            connect:
              'Authenticate with your Lens profile on Polygon via challenge-response signing with your connected wallet.',
            use: 'Read publications, mirrors, and comments. Collect posts as NFTs and use Open Actions. Post up to 5,000 characters.',
          },
          {
            name: 'Bluesky',
            connect:
              'Enter your handle and an app password (create one in Bluesky Settings → App Passwords).',
            use: 'Read the AT Protocol firehose with rich text facets. Post up to 300 characters with images and video via XRPC.',
          },
          {
            name: 'Mastodon / ActivityPub',
            connect:
              'Authorize via OAuth on your instance (including social.degenfeed.xyz, a GotoSocial instance).',
            use: 'Read home, local, and federated timelines plus trending tags. Post up to 500 characters with content-warning support.',
          },
          {
            name: 'Threads',
            connect: 'Read-only for now — no account connection required.',
            use: 'Follow curated crypto/tech handles aggregated from public Threads pages.',
          },
          {
            name: 'Reddit',
            connect: 'Read-only via RSS/JSON — no account connection required.',
            use: 'Browse 91 default subreddits with real engagement data and comments.',
          },
          {
            name: 'Minds',
            connect: 'Read-only for public feeds — no account connection required.',
            use: 'Follow curated Minds channels with token-gated community content.',
          },
          {
            name: 'RSS / Atom',
            connect: 'No authentication — public feeds only.',
            use: 'Read 353+ sources including Substack, Mirror, Paragraph, and YouTube channels normalized into one feed.',
          },
          {
            name: 'PeerTube',
            connect:
              'Optional account for uploading. Read-only aggregation of 20+ public instances.',
            use: 'Watch federated video and live streams. Stream via RTMP ingest relay.',
          },
          {
            name: 'YouTube',
            connect: 'No authentication for read-only aggregation.',
            use: 'Watch channel videos, trending content, and live streams via Invidious (no tracking).',
          },
          {
            name: 'Owncast',
            connect: 'Self-hosted instance URL + admin key to register streams.',
            use: 'Watch live streams from independent Owncast broadcasters alongside other video sources.',
          },
          {
            name: 'Odysee',
            connect: 'No authentication for read-only aggregation.',
            use: 'Watch LBRY-protocol content claims, channel videos, and livestreams.',
          },
          {
            name: 'Rumble',
            connect: 'No authentication. Public HTML/RSS only.',
            use: 'Watch channel videos and livestreams aggregated from public pages.',
          },
          {
            name: 'Substack',
            connect: 'No authentication. Public RSS feeds.',
            use: 'Read full newsletter posts from 30+ crypto and tech publications.',
          },
          {
            name: 'Mirror',
            connect: 'No authentication. Public RSS/Atom feeds.',
            use: 'Read on-chain publishing articles backed by Arweave, including token-gated editions.',
          },
          {
            name: 'Paragraph',
            connect: 'No authentication. Public RSS feeds.',
            use: 'Read on-chain newsletter posts and token-gated content collections.',
          },
        ].map((p) => (
          <div
            key={p.name}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4"
          >
            <div className="text-sm font-semibold text-[var(--color-fg)]">{p.name}</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                  Connect
                </div>
                <p className="text-xs text-[var(--color-muted)]">{p.connect}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                  Use
                </div>
                <p className="text-xs text-[var(--color-muted)]">{p.use}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Adding a New Protocol */}
      <H2 id="adding-new-protocols">Adding a New Protocol</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
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
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-[var(--color-muted)]">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
              {i + 1}
            </span>
            <div>
              <strong className="text-[var(--color-muted)]">{step}</strong>
              <p className="mt-0.5 text-[var(--color-muted)]">{desc}</p>
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
        <p className="text-xs text-[var(--color-muted)]">
          Want to contribute a new protocol?{' '}
          <Link href="/docs/contributing" className="text-degen-400 underline">
            Check the contributing guide
          </Link>
        </p>
      </div>
    </div>
  );
}
