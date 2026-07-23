import type { Metadata } from 'next';
import { Badge } from '../_components/doc-badge';
import { Callout } from '../_components/doc-callout';
import { H2 } from '../_components/doc-heading';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Changelog — DegenFeed',
  description:
    'Release history and changelog for DegenFeed. Track new features, fixes, and breaking changes across versions.',
  alternates: { canonical: 'https://app.degenfeed.xyz/docs/changelog' },
  openGraph: {
    title: 'DegenFeed Changelog',
    description:
      'Complete release history for the open-source multi-protocol web3 social aggregator.',
  },
};

interface VersionEntry {
  version: string;
  date: string;
  title: string;
  badge: 'green' | 'blue' | 'yellow' | 'gray';
  changes: { type: string; items: string[]; icon: string }[];
  breaking?: string[];
}

const versions: VersionEntry[] = [
  {
    version: 'v0.2.0',
    date: 'July 2026',
    title: 'Cross-Protocol',
    badge: 'green',
    changes: [
      {
        type: 'New Features',
        icon: '✨',
        items: [
          'Cross-protocol posting: publish to Nostr, Farcaster, Lens, Bluesky, and Mastodon simultaneously',
          'Crypto tipping: send ETH, SOL, USDC, and Lightning Network zaps directly to creators',
          'Farcaster Frames support: resolve frame metadata and submit frame actions',
          'Audio Spaces: live discussion rooms with speaker management and recording',
          'Communities with DAO governance: create, moderate, and vote on community decisions',
          'Post scheduling (Creator tier): schedule posts across protocols with calendar view',
          'Analytics dashboard (Creator tier): cross-protocol reach, engagement, and tip tracking',
          'Cross-protocol DMs: unified inbox for Nostr NIP-04 encrypted DMs and Mastodon private mentions',
          'Push notifications: PWA Web Push for replies, mentions, tips, and followers',
          'Custom feeds (Premium tier): save filter combinations as named, shareable feeds',
          'Scheduled digest emails: daily and weekly digests with customizable content mix',
          'Newsletter archive: browse past digests with full-text search',
        ],
      },
      {
        type: 'Changes',
        icon: '🔧',
        items: [
          'Switched from AGPL to MIT license for broader adoption',
          'Upgraded Next.js 14 to 15 with full App Router migration',
          'Upgraded React 18 to 19 with concurrent features',
          'Replaced ESLint + Prettier with Biome for 10x faster linting',
          'Upgraded Turborepo 1 to 2 for faster caching and remote caching',
          'Upgraded pnpm 8 to 11 for better monorepo performance',
          'Redesigned feed ranking algorithm with velocity scoring',
          'Improved provider circuit breaker with graduated backoff',
          'Enhanced KV caching strategy reduced P95 latency by 40%',
          'Replaced custom WebSocket with Nostr SDK RelayPool',
        ],
      },
      {
        type: 'Bug Fixes',
        icon: '🐛',
        items: [
          'Fixed Nostr relay reconnection backoff causing rapid reconnect loops',
          'Fixed Farcaster Hub timeout handling for slow gRPC responses',
          'Fixed Lens GraphQL pagination cursor encoding',
          'Fixed Bluesky rate limit retry logic for PDS rate limits',
          'Fixed RSS feed parser handling of malformed XML feeds',
          'Fixed wallet auth nonce expiry race condition',
          'Fixed IndexedDB cache corruption on storage quota exceeded',
          'Fixed PWA install prompt firing on unsupported browsers',
        ],
      },
    ],
  },
  {
    version: 'v0.1.0',
    date: 'May 2026',
    title: 'First Feed',
    badge: 'blue',
    changes: [
      {
        type: 'New Features',
        icon: '✨',
        items: [
          'Multi-protocol aggregated feed with unified timeline',
          '7-factor transparent ranking algorithm with per-post score breakdown',
          '11-layer cross-protocol deduplication pipeline',
          'Per-protocol feeds: Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy',
          'RSS/Atom reader with 50+ sources and 6 source adapters',
          'Wallet authentication: SIWE (EIP-4361) and Solana wallet auth',
          'GotoSocial Mastodon-compatible instance at social.degenfeed.xyz',
          'Nostr relay pool with automatic reconnection and 10 relay redundancy',
          'Farcaster Hub client with protobuf message encoding',
          'Lens GraphQL API v2 integration with ML explore feed',
          'Bluesky AT Protocol XRPC client with DID resolution',
          'Cloudflare KV caching layer with 30s feed cache and 60s provider cache',
          'Circuit breaker pattern for provider resilience',
          'Spam filtering with multi-strategy detection (regex, content, pattern)',
          'Content niche classification: 200+ crypto terms and 60 tech/AI terms',
          'Responsive PWA with offline support via IndexedDB',
          'Newsletter service with daily digest curation',
          'Cross-protocol identity resolution and profile aggregation',
          'RSS feed and Atom feed output for DegenFeed content',
          'Threads.net read-only integration with HTML scraping',
          'Reddit integration with triple-strategy (RSS, JSON, frontends)',
          'Lemmy integration with 15 curated crypto/tech communities',
        ],
      },
      {
        type: 'Infrastructure',
        icon: '🏗',
        items: [
          'Turborepo monorepo with pnpm workspaces',
          'Cloudflare Pages deployment for frontend',
          'Cloudflare Workers deployment for API (65+ endpoints)',
          'Cloudflare KV for distributed caching and rate limiting',
          'TypeScript strict mode across all packages',
          'Biome for consistent code formatting',
          'Vitest for unit testing with 85%+ coverage',
          'Playwright for E2E testing',
          'CI/CD pipeline with automated testing and deployment',
          'Sentry error tracking integration',
        ],
      },
    ],
  },
  {
    version: 'v0.0.1',
    date: 'April 2026',
    title: 'Alpha',
    badge: 'gray',
    changes: [
      {
        type: 'Initial Prototype',
        icon: '🚀',
        items: [
          'Nostr-only support with basic relay connection',
          'Simple chronological feed rendering',
          'Proof-of-concept wallet auth',
          'Local development environment',
        ],
      },
    ],
  },
];

export default function ChangelogPage() {
  const latest = versions[0]!;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-2 flex items-center gap-2">
        <Badge color="green">{latest.version}</Badge>
        <Badge>Changelog</Badge>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)]">Changelog</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
        Track every release of DegenFeed. From the initial alpha to the latest cross-protocol
        features, here&rsquo;s what changed and when.
      </p>

      <Callout type="info">
        DegenFeed follows semantic versioning. Breaking changes are noted in each release. Subscribe
        to the newsletter to get release announcements delivered to your inbox.
      </Callout>

      <div className="mt-10 space-y-10">
        {versions.map((version) => (
          <section
            key={version.version}
            id={version.version.replace(/\./g, '')}
            className="scroll-mt-24"
          >
            {/* Version header */}
            <div className="mb-6 flex items-baseline gap-3">
              <Badge color={version.badge}>{version.version}</Badge>
              <span className="text-sm text-[var(--color-muted)]">{version.date}</span>
              <span className="text-sm font-medium text-[var(--color-fg)]">{version.title}</span>
            </div>

            {/* Changes */}
            <div className="space-y-6">
              {version.changes.map((category) => (
                <div key={category.type}>
                  <h3 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
                    {category.icon} {category.type}
                  </h3>
                  <ul className="space-y-2">
                    {category.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-[var(--color-muted)]">
                        <span className="mt-1 flex-shrink-0">{category.icon}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Breaking changes */}
            {version.breaking && version.breaking.length > 0 && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-400">
                  Breaking Changes
                </div>
                <ul className="space-y-1">
                  {version.breaking.map((b) => (
                    <li key={b} className="text-sm text-red-300">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Divider */}
            <div className="mt-6 border-t border-[var(--color-glass-border)]" />
          </section>
        ))}
      </div>

      {/* What's Next */}
      <section className="mt-10">
        <H2 id="whats-next">What&rsquo;s Next</H2>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6">
          <p className="text-sm text-[var(--color-muted)]">
            We&rsquo;re actively developing the next major release. Here&rsquo;s what&rsquo;s on the
            roadmap:
          </p>
          <ul className="mt-4 space-y-2">
            {[
              'Cross-protocol search improvements with full-text indexing',
              'Mobile native apps (iOS/Android via Capacitor)',
              'Decentralized identity with DIDs and VCs',
              'End-to-end encryption for cross-protocol DMs',
              'Protocol-agnostic NFT minting and showcases',
              'Advanced analytics with exportable reports',
              'Multi-language support for the interface',
              'Custom notification rules and webhook integrations',
            ].map((item) => (
              <li key={item} className="flex gap-2 text-sm text-[var(--color-muted)]">
                <span className="text-degen-400">○</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          Want to contribute to a future release?{' '}
          <a href="/docs/contributing" className="text-degen-400 underline">
            Check the contributing guide
          </a>
        </p>
      </div>
    </div>
  );
}
