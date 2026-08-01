import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'About — DegenFeed: Our Story, Mission & Technology',
  description:
    'DegenFeed unifies the fragmented decentralized social web. We fight for data independence, creator ownership, and network sovereignty. Open source, self-hostable, protocol-agnostic. Built by Rug Munch Media LLC.',
  keywords: [
    'about degenfeed',
    'web3 social media mission',
    'decentralized social network story',
    'data independence',
    'creator ownership',
    'network sovereignty',
    'open source social aggregator',
    'rug munch media',
    'cross protocol social platform',
  ],
  openGraph: {
    title: 'About DegenFeed — The Web3 Social Universe',
    description:
      '25 protocols, one app, your data. We exist to unify the fragmented decentralized social web. Open source. Self-hostable. Never sell your data.',
    url: 'https://app.degenfeed.xyz/about',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'About DegenFeed — the Web3 social universe',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About DegenFeed — The Web3 Social Universe',
    description:
      '25 protocols, one app, your data. Fighting for data independence and creator ownership.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/about' },
};

const values = [
  {
    title: 'Data Independence',
    body: 'Your social graph, your identity, your content — they belong to you. Not to a corporation. Not to a government. Not to us. DegenFeed never sells, rents, or monetizes your data. There are no ads, no trackers, no data brokers. Your credentials are encrypted in your browser and never touch our servers. You can export everything, anytime.',
    icon: '✦',
  },
  {
    title: 'Creator Ownership',
    body: 'Creators deserve to own their audience, their content, and their revenue. We built DegenFeed so you can post once and reach every protocol — without being locked into any single platform. Launch your own creator coin. Receive tips with zero platform fees. Livestream to 7 protocols simultaneously. No algorithm decides who sees your work — your content reaches your audience directly.',
    icon: '◆',
  },
  {
    title: 'Network Sovereignty',
    body: 'No one can deplatform you on DegenFeed because your identity lives on open protocols — Nostr, Farcaster, AT Protocol, ActivityPub. Even if our hosted instance goes dark, your accounts remain independently accessible. Self-host the entire stack with one command. Run your own relays, your own indexer, your own frontend. True network sovereignty means no single point of control or failure.',
    icon: '⬟',
  },
];

const techStack = [
  { category: 'Frontend', tech: 'Next.js 16, React 19, TypeScript, Tailwind CSS v4' },
  { category: 'Edge Runtime', tech: 'Cloudflare Pages + Workers, Hono, 19 KV namespaces' },
  { category: 'Protocol SDKs', tech: '30+ internal packages — one adapter per protocol' },
  { category: 'Smart Contracts', tech: 'Solidity (Base), Anchor/Rust (Solana), Wormhole bridge' },
  { category: 'Infrastructure', tech: 'GoToSocial, AT Protocol PDS, PeerTube, Prosody XMPP' },
  { category: 'Search', tech: 'MeiliSearch self-hosted' },
  { category: 'Monitoring', tech: 'Self-hosted Grafana, Prometheus, GlitchTip, Plausible' },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Hero */}
      <div className="mb-12 text-center">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold mb-4"
          style={{
            borderColor: 'var(--color-accent)',
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
          }}
        >
          About DegenFeed
        </span>
        <h1
          className="text-3xl md:text-5xl font-black mb-4"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          The Web3 <span className="gradient-text">Social Universe</span>
        </h1>
        <p
          className="text-base md:text-lg leading-relaxed"
          style={{ color: 'var(--color-fg-secondary)' }}
        >
          25 protocols. One app. Your data, never sold.
          <br />
          We exist to unify the fragmented decentralized social web.
        </p>
      </div>

      {/* Our Story */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">Our Story</h2>
        <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          <p>
            DegenFeed was born from a simple frustration: every crypto-native community lives on a
            different protocol. Nostr for Bitcoiners. Farcaster for the ETH degens. Lens for the
            on-chain social crowd. Bluesky for the AT Protocol enthusiasts. Mastodon for the
            fediverse purists. And that&apos;s before you get to Reddit, RSS, YouTube, PeerTube, and
            the dozen other places where meaningful conversations happen.
          </p>
          <p>We got tired of jumping between apps. So we built the one app that reads them all.</p>
          <p>
            But DegenFeed became more than a unified feed. As we talked to creators who were
            building audiences across three, four, five platforms simultaneously, we realized the
            real problem wasn&apos;t just <em>reading</em> across protocols — it was
            <em>owning</em> your presence across them. Every platform takes a cut. Every platform
            controls the algorithm. Every platform can deplatform you on a whim.
          </p>
          <p>
            We decided to build the anti-platform: a social media layer that connects the open
            protocols, gives creators the tools to own their economies, and never, ever treats your
            data as a product.
          </p>
          <p>
            DegenFeed is a product of{' '}
            <strong className="text-[var(--color-fg)]">Rug Munch Media LLC</strong>, an independent,
            self-funded Wyoming LLC. We&apos;re not VC-backed. We&apos;re not growth-hacking for an
            exit. We&apos;re builders who actually use the protocols we integrate — and we&apos;re
            building the tool we always wanted.
          </p>
        </div>
      </section>

      {/* Our Beliefs */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-6 text-[var(--color-fg)]">Our Beliefs</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-xl border p-5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
              >
                {v.icon}
              </div>
              <h3 className="mb-2 text-sm font-bold text-[var(--color-fg)]">{v.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Our Methodology */}
      <section
        className="mb-12 rounded-2xl border p-6"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
      >
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">Our Methodology</h2>
        <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          <div className="flex gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
            >
              1
            </span>
            <div>
              <strong className="text-[var(--color-fg)]">Open Source First</strong>
              <p>
                DegenFeed is AGPL-3.0 licensed. Every line of code is inspectable, forkable, and
                improvable. There are no closed-source modules, no obfuscated algorithms, no hidden
                data collection. The ranking algorithm is transparent — every post shows its score
                breakdown.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
            >
              2
            </span>
            <div>
              <strong className="text-[var(--color-fg)]">Self-Hostable by Design</strong>
              <p>
                The entire stack — frontend, API, relays, indexers — runs on a single Docker Compose
                command. No cloud dependency. No vendor lock-in. If you can run a web server, you
                can run DegenFeed. Self-hosting is not an afterthought; it is the default deployment
                model.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
            >
              3
            </span>
            <div>
              <strong className="text-[var(--color-fg)]">Protocol-Agnostic</strong>
              <p>
                We don&apos;t pick winners. Nostr, Farcaster, Lens, Bluesky, Mastodon — every open
                protocol is a first-class citizen. Each gets its own SDK package with full
                read/write capabilities. Our architecture treats protocols as interchangeable
                backends, not silos to bridge.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
            >
              4
            </span>
            <div>
              <strong className="text-[var(--color-fg)]">Privacy by Architecture</strong>
              <p>
                Your protocol credentials never leave your browser. Posts are signed client-side and
                broadcast directly to each protocol&apos;s network. DegenFeed has no backend
                database of user content — we cache at the edge for aggregation, but your data lives
                on the protocols, where it belongs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Tech */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">Our Technology</h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          DegenFeed is a full-stack monorepo with 30+ shared packages, edge-deployed on Cloudflare,
          with self-hosted infrastructure on dedicated hardware. Here&apos;s what we use:
        </p>
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {techStack.map((item, i) => (
            <div
              key={item.category}
              className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
              style={{
                borderBottom: i < techStack.length - 1 ? '1px solid var(--color-border)' : 'none',
                background: i % 2 === 0 ? 'var(--color-card)' : 'transparent',
              }}
            >
              <span className="font-semibold text-[var(--color-fg)]">{item.category}</span>
              <span style={{ color: 'var(--color-muted)' }} className="text-right">
                {item.tech}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <div
        className="text-center rounded-2xl border p-8"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
      >
        <h2 className="text-xl font-bold mb-2 text-[var(--color-fg)]">Join the revolution</h2>
        <p className="mb-5 text-sm" style={{ color: 'var(--color-muted)' }}>
          DegenFeed is free. Open source. No account required to browse.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/feed" className="btn-primary px-6 py-2.5 text-sm gap-2">
            Browse the Feed
          </Link>
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary px-6 py-2.5 text-sm gap-2"
          >
            View on Forgejo
          </a>
          <Link href="/docs" className="btn-secondary px-6 py-2.5 text-sm gap-2">
            Read the Docs
          </Link>
        </div>
      </div>

      {/* Contact */}
      <div className="mt-8 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
        <p>
          Questions? Email{' '}
          <a href="mailto:admin@rugmunch.io" className="underline hover:text-[var(--color-fg)]">
            admin@rugmunch.io
          </a>{' '}
          &middot; Legal:{' '}
          <a href="mailto:legal@rugmunch.io" className="underline hover:text-[var(--color-fg)]">
            legal@rugmunch.io
          </a>{' '}
          &middot; DMCA:{' '}
          <a href="mailto:dmca@degenfeed.xyz" className="underline hover:text-[var(--color-fg)]">
            dmca@degenfeed.xyz
          </a>
        </p>
      </div>
    </div>
  );
}
