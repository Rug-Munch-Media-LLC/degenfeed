import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Why DegenFeed — Bridging Web2 & Web3 Social',
  description:
    'DegenFeed unifies the fragmented decentralized social web. One app, every protocol — read, post, and interact across Nostr, Farcaster, Lens, Bluesky, Mastodon and more, simultaneously. Open source, self-hostable, protocol-agnostic. Built by Rug Munch Media LLC.',
  keywords: [
    'why degenfeed',
    'web2 web3 bridge',
    'web3 social media mission',
    'decentralized social network',
    'cross protocol social platform',
    'data independence',
    'creator ownership',
    'network sovereignty',
    'open source social aggregator',
    'nostr farcaster lens bluesky mastodon',
    'rug munch media',
  ],
  openGraph: {
    title: 'Why DegenFeed — One App for Every Protocol',
    description:
      'Web2 social is siloed. Web3 social is fragmented. DegenFeed bridges them: one app, every protocol, your data.',
    url: 'https://app.degenfeed.xyz/about',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Why DegenFeed — bridging web2 and web3 social',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Why DegenFeed — One App for Every Protocol',
    description:
      'Web2 social is siloed. Web3 social is fragmented. DegenFeed bridges them — your data, never sold.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/about' },
};

/* === Mission data ============================================= */

const protocolGuide = [
  {
    name: 'Nostr',
    icon: '⚡',
    color: '#8e30eb',
    route: '/feed/nostr',
    blurb: 'Notes relayed by anyone. Bitcoin-native, censorship-resistant, no server required.',
  },
  {
    name: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    route: '/feed/farcaster',
    blurb: 'Sufficiently decentralized social for the Ethereum crowd, with channels and frames.',
  },
  {
    name: 'Lens',
    icon: '🌿',
    color: '#abfe2c',
    route: '/feed/lens',
    blurb: 'User-owned social graph on Polygon — profiles, collects, and open actions.',
  },
  {
    name: 'Bluesky',
    icon: '🦋',
    color: '#1185fe',
    route: '/feed/bluesky',
    blurb: 'The AT Protocol: portable identity, custom feeds, and algorithmic choice.',
  },
  {
    name: 'Mastodon',
    icon: '🐘',
    color: '#6364ff',
    route: '/feed/mastodon',
    blurb: 'The fediverse flagship — federated microblogging across thousands of instances.',
  },
  {
    name: 'Lemmy',
    icon: '🗣️',
    color: '#2d9cdb',
    route: '/feed/lemmy',
    blurb: 'Reddit, but federated — link aggregators and communities with real discussion.',
  },
  {
    name: 'PeerTube',
    icon: '🎬',
    color: '#f1680d',
    route: '/feed/peertube',
    blurb: 'Decentralized video hosting on ActivityPub — no single platform controls the feed.',
  },
  {
    name: 'Pixelfed',
    icon: '📷',
    color: '#f9a825',
    route: '/feed/pixelfed',
    blurb: 'Federated image sharing — an Instagram that no corporation owns.',
  },
  {
    name: 'Zora',
    icon: '🎨',
    color: '#6b21a8',
    route: '/feed/zora',
    blurb: 'On-chain minting and creator coins — art, culture, and ownership together.',
  },
];

const web2Bridge = [
  {
    icon: '📰',
    title: 'RSS / News',
    body: '350+ crypto news sources normalized into one stream — Substack, Medium, Mirror, Ghost, Hacker News, arXiv. The oldest open web protocol, still the backbone of publishing.',
  },
  {
    icon: '▶️',
    title: 'YouTube',
    body: 'Top crypto, tech & AI channels aggregated into a unified video feed — the same videos you watch on the biggest web2 platform, ranked alongside decentralized video.',
  },
  {
    icon: '🔴',
    title: 'Reddit',
    body: 'Crypto subreddits and community discussions pulled in via RSS and JSON — the largest community platform on the web, readable right next to Nostr notes.',
  },
  {
    icon: '🌐',
    title: 'WordPress & more',
    body: '43% of the web runs WordPress, and much of it now federates via ActivityPub. Plus newsletters, podcasts, Twitch, Vimeo, SoundCloud — web2 content, web3 ownership.',
  },
];

const openSourceRepos = [
  {
    href: 'https://git.rugmunch.io/RugMunchMedia/degenfeed',
    name: 'degenfeed',
    desc: 'This monorepo — Next.js frontend, protocol SDKs, feed engines, and docs.',
  },
  {
    href: 'https://git.rugmunch.io/RugMunchMedia/rmi-backend',
    name: 'rmi-backend',
    desc: 'FastAPI crypto intelligence backend — scanners, risk scoring, DataBus providers.',
  },
  {
    href: 'https://git.rugmunch.io/RugMunchMedia/pryscraper',
    name: 'pryscraper',
    desc: 'Open source web scraping framework powering RSS and source aggregation.',
  },
  {
    href: 'https://git.rugmunch.io/RugMunchMedia/rmi-rag',
    name: 'rmi-rag',
    desc: 'Retrieval-augmented generation for the DegenFeed knowledge layer.',
  },
];

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
      <Script id="about-structured-data" type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About DegenFeed',
          url: 'https://app.degenfeed.xyz/about',
          description:
            'DegenFeed is an open-source, multi-protocol social aggregator that unifies 18+ decentralized and federated social networks into one ranked feed, plus 248 bias-rated news sources.',
          mainEntity: {
            '@type': 'Organization',
            name: 'Rug Munch Media LLC',
            url: 'https://app.degenfeed.xyz',
            logo: 'https://app.degenfeed.xyz/icon-512.png',
          },
        })}
      </Script>
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
          Why DegenFeed
        </span>
        <h1
          className="text-3xl md:text-5xl font-black mb-4"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          One App. Every Protocol. <span className="gradient-text">Your Data.</span>
        </h1>
        <p
          className="text-base md:text-lg leading-relaxed"
          style={{ color: 'var(--color-fg-secondary)' }}
        >
          Web2 social is siloed. Web3 social is fragmented.
          <br />
          DegenFeed bridges both — so you never have to choose again.
        </p>
      </div>

      {/* The Problem */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">The Problem</h2>
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
        >
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-muted)' }}>
            Web2 social is a set of walled gardens. Elon&apos;s Twitter, Zuck&apos;s Threads,
            Google&apos;s YouTube — each one owns your feed, your audience, and your attention. The
            algorithm decides what you see. The corporation decides who can speak. Your data is the
            product, and your followers are rented, not owned.
          </p>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-muted)' }}>
            Web3 social fixed the ownership problem — but created a fragmentation problem. Nostr is
            for Bitcoiners. Farcaster is for the ETH degens. Lens is for the on-chain social crowd.
            Bluesky for the AT Protocol enthusiasts. Mastodon for the fediverse purists. Each
            protocol is a different app, a different identity, a different community. None of them
            talk to each other.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
            So the person who wants to stay in the loop has to run five apps, maintain five
            identities, and miss most of the conversation anyway. The open web we were promised
            turned into a thousand disconnected islands.
          </p>
        </div>
      </section>

      {/* The Solution */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">The Solution</h2>
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
        >
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-muted)' }}>
            <strong className="text-[var(--color-fg)]">One app, every protocol.</strong> DegenFeed
            is a single interface for the entire decentralized social web — plus the web2 sources
            that still matter. Read, post, and interact across Nostr, Farcaster, Lens, Bluesky,
            Mastodon, PeerTube, Lemmy, Pixelfed, Zora, RSS, YouTube, Reddit and more —{' '}
            <em>simultaneously</em>.
          </p>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-muted)' }}>
            Post once, publish everywhere. Every protocol gets its native treatment — a signed Nostr
            event, a Farcaster cast, a Lens publication, an AT Protocol post, an ActivityPub status
            — all from one composer. Engagement flows back into one unified feed.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
            DegenFeed treats protocols as interchangeable backends, not silos to bridge. That means
            your feed isn&apos;t a patched-together mess of iframes — it&apos;s a single ranked
            stream where a Nostr note, a Farcaster cast, a YouTube video, and a Reddit thread sit
            side by side.
          </p>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">Why It Matters</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: 'You own your content',
              body: 'Your posts live on open protocols, signed with keys you control. No platform can delete, shadowban, or quietly copyright-strike your own words.',
            },
            {
              title: 'No algorithm controls your feed',
              body: 'DegenFeed ranks with a transparent, open-source scoring model — and you can flip to chronological any time. The feed is yours, not an ad auction.',
            },
            {
              title: 'Cross-post once, reach everyone',
              body: 'One post fans out to every protocol you belong to. Your words land with Bitcoiners on Nostr, degens on Farcaster, and the fediverse on Mastodon.',
            },
            {
              title: 'Never lose your followers to a platform decision',
              body: 'When a platform changes its API, bans a topic, or shuts down, your audience follows you — because it was never the platform&apos;s audience.',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border p-5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <h3 className="mb-2 text-sm font-bold text-[var(--color-fg)]">{card.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">How It Works</h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          DegenFeed is a bridge, not a platform. Your identity stays on the protocols; we provide
          the connectors and the unified view.
        </p>
        <div
          className="rounded-2xl border p-5 md:p-6"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
        >
          <div className="flex flex-col md:flex-row items-stretch gap-3 md:gap-4">
            {/* Source protocols */}
            <div
              className="flex-1 rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div
                className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-accent)' }}
              >
                Your Protocols
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {[
                  '⚡ Nostr',
                  '◈ Farcaster',
                  '🌿 Lens',
                  '🦋 Bluesky',
                  '🐘 Mastodon',
                  '🗣️ Lemmy',
                  '🎬 PeerTube',
                  '📷 Pixelfed',
                ].map((p) => (
                  <span
                    key={p}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Arrows */}
            <div
              className="flex items-center justify-center text-xl"
              style={{ color: 'var(--color-accent)' }}
            >
              <span className="md:rotate-0 -rotate-90">→</span>
            </div>

            {/* Bridge */}
            <div
              className="flex-1 rounded-xl border p-4"
              style={{ borderColor: 'var(--color-accent)', background: 'var(--color-accent-soft)' }}
            >
              <div
                className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-accent)' }}
              >
                DegenFeed Bridge
              </div>
              <div
                className="space-y-1.5 text-center text-[11px] leading-relaxed"
                style={{ color: 'var(--color-fg)' }}
              >
                <div>One adapter per protocol (30+ SDKs)</div>
                <div>Edge cache + live relay pools</div>
                <div>Client-side key signing — keys never leave your browser</div>
                <div>Cross-post composer &amp; df:// resolver</div>
              </div>
            </div>

            {/* Arrows */}
            <div
              className="flex items-center justify-center text-xl"
              style={{ color: 'var(--color-accent)' }}
            >
              <span className="md:rotate-0 -rotate-90">→</span>
            </div>

            {/* Unified feed */}
            <div
              className="flex-1 rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div
                className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-accent)' }}
              >
                Unified Feed
              </div>
              <div
                className="space-y-1.5 text-center text-[11px] leading-relaxed"
                style={{ color: 'var(--color-fg)' }}
              >
                <div>One ranked, merged stream</div>
                <div>Cross-protocol engagement (likes, tips, replies)</div>
                <div>One identity, many handles</div>
                <div>Unified notifications &amp; analytics</div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
          Want the deep dive?{' '}
          <Link href="/docs/protocols" className="underline hover:text-[var(--color-fg)]">
            Read the protocol integration guide
          </Link>
          .
        </p>
      </section>

      {/* Protocol Guide */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">Protocol Guide</h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          Every protocol is a first-class citizen. Here&apos;s what each one is and why it matters —
          with the full explainer on the{' '}
          <Link href="/protocols" className="underline hover:text-[var(--color-fg)]">
            Protocol Guide page
          </Link>
          .
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {protocolGuide.map((p) => (
            <Link
              key={p.name}
              href={p.route}
              className="rounded-xl border p-4 transition-colors hover:bg-[var(--color-overlay)]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                  style={{ backgroundColor: `${p.color}1a`, color: p.color }}
                  aria-hidden="true"
                >
                  {p.icon}
                </span>
                <span className="text-sm font-bold text-[var(--color-fg)]">{p.name}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                {p.blurb}
              </p>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link href="/protocols" className="btn-secondary px-6 py-2.5 text-sm gap-2">
            Explore the full Protocol Guide
          </Link>
        </div>
      </section>

      {/* Web2 ↔ Web3 Bridge */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">The Web2 ↔ Web3 Bridge</h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          Most people don&apos;t live only on open protocols — yet. DegenFeed meets them where they
          are, bringing web2 sources into the same ranked feed as web3 posts, so the bridge is
          seamless in both directions.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {web2Bridge.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border p-5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
            >
              <div
                className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
              >
                {item.icon}
              </div>
              <h3 className="mb-2 text-sm font-bold text-[var(--color-fg)]">{item.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          The bridge goes both ways. Web2 content is readable in your unified feed today — and when
          you post from DegenFeed, your content is written to open protocols with keys you control.
          You can start on the closed web and migrate to the open web without losing your audience,
          your content, or your workflow.
        </p>
      </section>

      {/* Open Source */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-fg)]">Open Source</h2>
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
        >
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-muted)' }}>
            DegenFeed is <strong className="text-[var(--color-fg)]">AGPL-3.0 licensed</strong> and
            self-hostable by design. Every line of code is inspectable, forkable, and improvable.
            The ranking algorithm is transparent — every post shows its score breakdown. No
            closed-source modules, no obfuscated logic, no hidden data collection.
          </p>
          <div className="space-y-2 mb-4">
            {openSourceRepos.map((repo) => (
              <a
                key={repo.name}
                href={repo.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border p-4 transition-colors hover:bg-[var(--color-overlay)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="text-sm font-bold text-[var(--color-fg)]">{repo.name}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                  {repo.desc}
                </div>
              </a>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://git.rugmunch.io/RugMunchMedia/degenfeed"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-6 py-2.5 text-sm gap-2"
            >
              Contribute on Forgejo
            </a>
            <Link href="/docs/contributing" className="btn-secondary px-6 py-2.5 text-sm gap-2">
              Contribution Guide
            </Link>
            <Link href="/docs" className="btn-secondary px-6 py-2.5 text-sm gap-2">
              Self-Host Docs
            </Link>
          </div>
        </div>
      </section>

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
          <Link href="/protocols" className="btn-secondary px-6 py-2.5 text-sm gap-2">
            Meet the Protocols
          </Link>
          <a
            href="https://git.rugmunch.io/RugMunchMedia/degenfeed"
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
