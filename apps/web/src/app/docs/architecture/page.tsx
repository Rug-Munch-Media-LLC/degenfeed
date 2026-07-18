import type { Metadata } from 'next';
import { Badge } from '../_components/doc-badge';
import { Callout } from '../_components/doc-callout';
import { CodeBlock } from '../_components/doc-code-block';
import { H2, H3 } from '../_components/doc-heading';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'System Architecture — DegenFeed',
  description:
    'DegenFeed system architecture: Next.js frontend, Cloudflare Workers, KV caching, provider architecture, data flow, and deployment.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/architecture' },
  openGraph: {
    title: 'DegenFeed System Architecture',
    description: 'Complete system architecture documentation for DegenFeed.',
  },
};

const packages = [
  ['apps/web', 'Next.js 15 App Router frontend (Cloudflare Pages)'],
  ['workers/api', 'Cloudflare Worker with 65+ endpoints'],
  ['packages/types', 'UnifiedPost, UnifiedIdentity, Protocol types'],
  ['packages/feed-core', 'Normalization, 11-layer dedup, spam, niches, language detection'],
  ['packages/feed-providers', '10 protocol adapter implementations'],
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
];

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-2 flex items-center gap-2">
        <Badge>Architecture</Badge>
        <Badge color="blue">System Design</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">
        System Architecture
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        DegenFeed is built on a modern edge computing stack. The frontend runs on Next.js
        (Cloudflare Pages), the API on Cloudflare Workers, and caching on Cloudflare KV. This
        architecture provides global low-latency access with zero server management.
      </p>

      {/* Overview Diagram */}
      <H2 id="overview">Architecture Overview</H2>
      <div className="my-6 overflow-x-auto rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6">
        <pre className="font-mono text-xs leading-relaxed text-[var(--color-muted)]">
          {`┌──────────────────────────────────────────────────────────────────────────┐
│                              Users                                       │
│                 Browser (Desktop/PWA) / API Clients                       │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Pages (Edge)                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     Next.js 15 / React 19                          │  │
│  │  Shell Layout │ Feed Pages │ Docs │ Settings │ Auth │ News         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │ /api/*
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Worker (65 endpoints)                  │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Feed Router  │  │ Auth Service │  │ Search       │  │ KV Cache   │  │
│  │ (ranking,    │  │ (SIWE,       │  │ (cross-      │  │ (feed,     │  │
│  │  dedup,      │  │  OAuth,      │  │  protocol)   │  │  rate      │  │
│  │  filtering)  │  │  session)    │  │              │  │  limiting) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────────┘  │
│         │                 │                  │                          │
│         ▼                 ▼                  ▼                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Provider Layer                                 │   │
│  │  Nostr │ Farcaster │ Lens │ Bluesky │ Mastodon │ Lemmy           │   │
│  │  Threads │ Reddit │ RSS │ GotoSocial                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
  │  Nostr       │   │  Farcaster   │   │  External APIs   │
  │  Relay Pool  │   │  Hub (gRPC)  │   │  Lens / Bluesky  │
  │  (10 relays) │   │  + REST      │   │  / Mastodon      │
  └──────────────┘   └──────────────┘   └──────────────────┘
`}
        </pre>
      </div>

      {/* Request Lifecycle */}
      <H2 id="request-lifecycle">Request Lifecycle</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Every feed request goes through a carefully orchestrated pipeline that balances speed,
        freshness, and reliability.
      </p>

      <div className="mt-4 rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
        <ol className="space-y-2 text-sm text-[var(--color-muted)]">
          {[
            'Worker receives GET /api/feed/home',
            'KV feed cache check (30s TTL) → return if cache hit',
            'Per-protocol KV cache check (60s TTL) → skip provider if cache fresh',
            'Circuit breaker check → skip failing providers',
            'Parallel provider fetches across all active protocols',
            'Spam filter → niche detection → content type detection',
            '11-layer cross-protocol deduplication (Jaccard similarity)',
            'Post KV store write (1h TTL) for O(1) single-post lookups',
            'Load user context: follows, mutes, preferences',
            'Language filter: Accept-Language → English default',
            'Nostr zap count enrichment (fire-and-forget)',
            '7-factor scoring with freshness + media + quality boosts',
            'Diversity ranker with per-protocol minimums',
            'Cursor pagination + sort mode + content type filters',
            'Feed cache write → JSON response',
          ].map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex-shrink-0 font-mono text-xs text-degen-500">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Data Flow */}
      <H2 id="data-flow">Data Flow: Protocol → Feed → User</H2>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: '1. Collection',
            desc: 'Provider adapters fetch posts from each protocol in parallel. Nostr uses WebSocket relay subscriptions, Farcaster uses gRPC Hub connections, and others use REST APIs. Each provider caches raw data in KV for 60 seconds.',
          },
          {
            title: '2. Processing',
            desc: 'Raw posts are normalized into UnifiedPost objects. The pipeline applies spam filtering, niche classification, content type detection, and 11-layer deduplication. Ranked posts are cached in KV with a 30-second TTL.',
          },
          {
            title: '3. Delivery',
            desc: 'The frontend receives ranked posts via JSON responses. Client-side IndexedDB caches feed data for offline support. SSE (Server-Sent Events) enables real-time updates for the stream endpoint.',
          },
        ].map((phase) => (
          <div
            key={phase.title}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4"
          >
            <div className="text-sm font-semibold text-[var(--color-fg)]">{phase.title}</div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">{phase.desc}</p>
          </div>
        ))}
      </div>

      {/* Monorepo */}
      <H2 id="monorepo-structure">Monorepo Structure</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        DegenFeed uses a Turborepo monorepo managed with pnpm. The structure separates concerns
        cleanly into application, worker, and package layers.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
          <h3 className="mb-3 font-semibold text-[var(--color-fg)]">Packages</h3>
          <div className="space-y-1.5 text-xs">
            {packages.map(([pkg, desc]) => (
              <div key={pkg} className="flex items-baseline gap-2">
                <code className="flex-shrink-0 font-mono text-degen-400">{pkg}</code>
                <span className="text-[var(--color-muted)]">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5">
            <h3 className="mb-3 font-semibold text-[var(--color-fg)]">Tech Stack</h3>
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
                  className="rounded-md bg-[var(--color-muted)]/30 px-2 py-1 text-[11px] text-[var(--color-muted)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KV Storage */}
      <H2 id="kv-storage">KV Storage Schema</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Cloudflare KV is used for distributed caching, session storage, and rate limiting. Two KV
        namespaces provide global consistency across all worker isolates.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-glass-border)]">
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">Key Pattern</th>
              <th className="py-2 pr-4 font-medium text-[var(--color-muted)]">TTL</th>
              <th className="py-2 font-medium text-[var(--color-muted)]">Purpose</th>
            </tr>
          </thead>
          <tbody className="text-[var(--color-muted)]">
            {[
              ['feed_cache:{key}', '30s', 'Aggregated feed response cache'],
              ['provider_cache:{p}:{key}', '60s', 'Per-protocol raw data cache'],
              ['post:{protocol}:{id}', '1h', 'Individual post O(1) lookup'],
              ['ratelimit:{ip}:{window}', '5s', 'Rate limit tracking window'],
              ['session:{id}', '24h', 'User session data'],
              ['prefs:{userId}', '1h', 'User preferences (ranking weights, filters)'],
              ['circuit:{provider}', '2min', 'Circuit breaker state per provider'],
            ].map(([key, ttl, purpose]) => (
              <tr key={key} className="border-b border-white/[0.02]">
                <td className="py-2 pr-4 font-mono text-degen-400 text-xs">{key}</td>
                <td className="py-2 pr-4 font-mono text-xs">{ttl}</td>
                <td className="py-2 text-xs">{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout type="info">
        KV reads average 5-15ms globally. Writes are eventually consistent (typically &lt;1s). The
        circuit breaker pattern ensures transient KV failures don&rsquo;t block feed delivery.
      </Callout>

      {/* Deduplication */}
      <H2 id="deduplication">Deduplication Pipeline</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        11 layers prevent the same content from appearing multiple times in your feed, even when
        cross-posted across multiple protocols.
      </p>

      <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {[
          'Canonical ID — exact protocol:nativeId match',
          'Content fingerprint — 12-word normalized shingle',
          'Normalized full-text hash — URL-stripped comparison',
          'Primary URL dedup — same first link across protocols',
          'Text prefix — first 120 chars match',
          'Short exact text — <80 char posts',
          'Same-author cross-post window',
          'Repost/quote chain dedup — RT/@via patterns',
          'Ticker + first-sentence snapshot',
          'Embed-only dedup — same media URLs',
          'Image URL fingerprint — normalized CDN URLs',
        ].map((l) => (
          <div
            key={l}
            className="rounded-lg border border-white/[0.03] bg-white/[0.01] px-3 py-1.5 text-[11px] text-[var(--color-muted)]"
          >
            {l}
          </div>
        ))}
      </div>

      {/* Deployment */}
      <H2 id="deployment">Deployment Architecture</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        DegenFeed deploys to Cloudflare&rsquo;s edge network. The frontend uses Cloudflare Pages
        (via{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">
          @cloudflare/next-on-pages
        </code>
        ) and the API runs as a Cloudflare Worker.
      </p>

      <CodeBlock lang="bash">{`# Build and deploy frontend
pnpm build
npx wrangler pages deploy apps/web --project-name degenfeed-web

# Deploy API worker
npx wrangler deploy workers/api/src/index.ts --name degenfeed-api

# Deploy both (from root)
pnpm run deploy`}</CodeBlock>

      <H3 id="ci-cd">CI/CD Pipeline</H3>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-[var(--color-muted)]">
        <li>
          <strong className="text-[var(--color-muted)]">Push to main:</strong> TypeScript check →
          Biome lint → Vitest unit tests → Playwright E2E tests → build → deploy
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">PR preview:</strong> Automatic Cloudflare
          Pages preview deployment for every PR
        </li>
        <li>
          <strong className="text-[var(--color-muted)]">Rollback:</strong> Cloudflare Pages supports
          instant rollback to any previous deployment
        </li>
      </ul>

      <Callout type="tip">
        The free tier handles 100K requests/day across Pages and Workers. DegenFeed uses roughly 5ms
        CPU per cached request and ~50ms for a full cache-miss, well within the 10M CPU-ms free tier
        limit at moderate scale.
      </Callout>

      {/* Ranking */}
      <H2 id="ranking">Ranking Algorithm</H2>
      <p className="text-sm leading-relaxed text-[var(--color-muted)]">
        Every post is scored by a transparent 7-factor model. Each component is exposed in the API
        response so users can see exactly why a post appears where it does.
      </p>

      <div className="mt-4 rounded-2xl border border-degen-500/10 bg-degen-500/[0.02] p-5">
        <div className="font-mono text-sm leading-relaxed text-[var(--color-muted)]">
          score = (recency x 2.4 + engagement x 3.5 + relevance x 1.8 + quality x 1.4 + diversity x
          1.0 + source x 0.8 + velocity x 1.2) x freshnessBoost x mediaBoost x contentQuality
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          {
            factor: 'Recency (2.4)',
            desc: '12-hour half-life exponential decay. Posts decay to 50% score after 12 hours.',
          },
          {
            factor: 'Engagement (3.5)',
            desc: 'log(1 + likes + 2x reposts + 3x replies + 4x quotes). Log scaling prevents viral domination.',
          },
          {
            factor: 'Relevance (1.8)',
            desc: 'keywordRelevance x nicheRelevance x platformRelevance. 200+ crypto terms + 60 tech/AI terms.',
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
          <div
            key={r.factor}
            className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3"
          >
            <div className="text-sm font-semibold text-[var(--color-fg)]">{r.factor}</div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{r.desc}</p>
          </div>
        ))}
      </div>

      <Callout type="tip">
        Users can customize ranking weights via persistent preferences (KV storage) or anonymous
        cookie preferences. Set{' '}
        <code className="rounded bg-[var(--color-muted)]/30 px-1 font-mono text-xs">?sort=new</code>{' '}
        to bypass ranking entirely and see chronological order.
      </Callout>

      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          Architecture questions?{' '}
          <a href="mailto:admin@rugmunch.io" className="text-degen-400 underline">
            admin@rugmunch.io
          </a>
        </p>
      </div>
    </div>
  );
}
