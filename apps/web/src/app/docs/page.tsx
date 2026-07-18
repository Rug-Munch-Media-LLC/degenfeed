import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from './_components/doc-badge';
import { DocSearchClient } from './_components/doc-search-client';

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

const quickStartCards = [
  {
    title: '5-Minute Quickstart',
    desc: 'Connect your wallet, link a protocol, and start posting in minutes.',
    href: '/docs/quickstart',
    icon: '▶',
    color: 'from-degen-500/20 to-transparent',
  },
  {
    title: 'API Reference',
    desc: 'Complete API docs with code examples in JS, Python, and curl.',
    href: '/docs/api',
    icon: '◎',
    color: 'from-blue-500/20 to-transparent',
  },
  {
    title: 'User Guide',
    desc: 'Everything from wallet setup to advanced features.',
    href: '/docs/user-guide',
    icon: '📖',
    color: 'from-purple-500/20 to-transparent',
  },
  {
    title: 'Protocol Integration',
    desc: 'How each protocol is integrated, data sources, and limitations.',
    href: '/docs/protocols',
    icon: '◇',
    color: 'from-orange-500/20 to-transparent',
  },
];

const popularTopics = [
  {
    title: 'Connecting Your Wallet',
    href: '/docs/quickstart#connect-wallet',
    desc: 'Solana & EVM wallet setup',
  },
  {
    title: 'Cross-Protocol Posting',
    href: '/docs/user-guide#cross-protocol-posting',
    desc: 'Post to multiple networks at once',
  },
  { title: 'Ranking Algorithm', href: '/docs#ranking', desc: 'How posts are scored and ranked' },
  {
    title: 'Nostr Integration',
    href: '/docs/protocols#nostr',
    desc: 'Relay connection, events, signing',
  },
  {
    title: 'Authentication',
    href: '/docs/api#authentication',
    desc: 'API keys, rate limits, session auth',
  },
  {
    title: 'Farcaster Frames',
    href: '/docs/user-guide#posting-engagement',
    desc: 'Interactive frame support',
  },
  {
    title: 'Tipping Creators',
    href: '/docs/quickstart#tip-creator',
    desc: 'ETH, SOL, USDC, Lightning',
  },
  { title: 'Self-Hosting', href: '/docs#self-hosting', desc: 'Run your own DegenFeed instance' },
];

const changelogItems = [
  {
    version: 'v0.2.0',
    date: 'July 2026',
    label: 'Cross-protocol posting, tipping, Frames, Spaces',
    color: 'green' as const,
  },
  {
    version: 'v0.1.0',
    date: 'May 2026',
    label: 'Initial release: multi-protocol feed, 6 protocols',
    color: 'blue' as const,
  },
  {
    version: 'v0.0.1',
    date: 'April 2026',
    label: 'Alpha: Nostr-only prototype',
    color: 'gray' as const,
  },
];

export default function DocsLandingPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      {/* Hero */}
      <section className="mb-12">
        <div className="mb-3 flex items-center gap-2">
          <Badge color="green">v0.2.0</Badge>
          <Badge>MIT Licensed</Badge>
          <Badge color="purple">10 Protocols</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-fg)] lg:text-5xl">
          DegenFeed Documentation
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-400">
          DegenFeed is an open-source multi-protocol social aggregator for web3. It pulls public
          posts from 10 decentralized and federated networks into one unified, ranked timeline.
        </p>
        {/* Search */}
        <div className="mt-6 max-w-xl">
          <DocSearchClient />
        </div>
      </section>

      {/* Quick-start cards */}
      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-fg)]">Get Started</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickStartCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-5 transition-all hover:border-degen-500/30 hover:bg-degen-500/[0.03]"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-50`} />
              <div className="relative">
                <span className="mb-2 block text-2xl">{card.icon}</span>
                <h3 className="font-semibold text-[var(--color-fg)]">{card.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular topics */}
      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-fg)]">Popular Topics</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {popularTopics.map((topic) => (
            <Link
              key={topic.href}
              href={topic.href}
              className="rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-3 transition-all hover:border-degen-500/20 hover:bg-degen-500/[0.03]"
            >
              <div className="text-sm font-medium text-[var(--color-fg)]">{topic.title}</div>
              <p className="mt-0.5 text-xs text-gray-500">{topic.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* What's New */}
      <section className="mb-12 rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-fg)]">What&rsquo;s New</h2>
          <Link href="/docs/changelog" className="text-xs text-degen-400 hover:underline">
            View full changelog →
          </Link>
        </div>
        <div className="space-y-3">
          {changelogItems.map((item) => (
            <div key={item.version} className="flex items-center gap-3">
              <Badge color={item.color}>{item.version}</Badge>
              <span className="text-xs text-gray-500">{item.date}</span>
              <span className="text-sm text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Documentation sections overview */}
      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-fg)]">All Documentation</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: 'Quickstart',
              href: '/docs/quickstart',
              desc: '5-minute getting started guide',
              color: 'border-l-degen-500',
            },
            {
              title: 'User Guide',
              href: '/docs/user-guide',
              desc: 'Wallet, posting, tipping, communities, settings',
              color: 'border-l-blue-500',
            },
            {
              title: 'API Reference',
              href: '/docs/api',
              desc: 'All endpoints with code examples',
              color: 'border-l-purple-500',
            },
            {
              title: 'Protocol Integration',
              href: '/docs/protocols',
              desc: 'Provider architecture and data sources',
              color: 'border-l-orange-500',
            },
            {
              title: 'System Architecture',
              href: '/docs/architecture',
              desc: 'Data flow, KV schema, deployment',
              color: 'border-l-green-500',
            },
            {
              title: 'Contributing Guide',
              href: '/docs/contributing',
              desc: 'Dev setup, code style, PR process',
              color: 'border-l-yellow-500',
            },
            {
              title: 'Changelog',
              href: '/docs/changelog',
              desc: 'Release history and version notes',
              color: 'border-l-gray-500',
            },
            {
              title: 'Troubleshooting',
              href: '/docs/troubleshooting',
              desc: 'Common issues and solutions',
              color: 'border-l-red-500',
            },
            {
              title: 'Platform Comparison',
              href: '/docs/comparison',
              desc: 'DegenFeed vs X, Farcaster, Lens, Bluesky',
              color: 'border-l-indigo-500',
            },
          ].map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className={`rounded-lg border border-[var(--color-glass-border)] border-l-2 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04] ${doc.color}`}
            >
              <h3 className="font-medium text-[var(--color-fg)] text-sm">{doc.title}</h3>
              <p className="mt-0.5 text-xs text-gray-500">{doc.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="mt-12 border-t border-[var(--color-glass-border)] pt-6 text-center">
        <p className="text-xs text-gray-600">
          DegenFeed is a product of <strong className="text-gray-500">Rug Munch Media LLC</strong>.
          MIT Licensed. Built on open protocols. 10 networks. One window.
        </p>
      </div>
    </div>
  );
}
