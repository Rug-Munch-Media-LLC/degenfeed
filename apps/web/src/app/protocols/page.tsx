import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Protocol Guide — Why Each Protocol Matters | DegenFeed',
  description:
    'Explainer for every protocol DegenFeed bridges: Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, PeerTube, Pixelfed and Zora. What each one is, why it matters, what it is good for, and how DegenFeed enhances the experience.',
  keywords: [
    'protocol guide',
    'nostr explainer',
    'farcaster explainer',
    'lens protocol',
    'bluesky at protocol',
    'mastodon fediverse',
    'lemmy federated reddit',
    'peertube decentralized video',
    'pixelfed federated photos',
    'zora nft minting',
    'decentralized social protocols',
  ],
  openGraph: {
    title: 'DegenFeed Protocol Guide — Every Protocol, Explained',
    description:
      'What Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, PeerTube, Pixelfed and Zora are, why they matter, and how DegenFeed connects you to all of them.',
    url: 'https://app.degenfeed.xyz/protocols',
    siteName: 'DegenFeed',
    type: 'website',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Protocol Guide',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed Protocol Guide — Every Protocol, Explained',
    description: 'One app, every protocol. Understand the decentralized social web with DegenFeed.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/protocols' },
};

interface ProtocolExplainer {
  id: string;
  name: string;
  icon: string;
  color: string;
  route: string;
  tagline: string;
  what: string;
  why: string;
  goodFor: string[];
  degenfeed: string;
}

const protocols: ProtocolExplainer[] = [
  {
    id: 'nostr',
    name: 'Nostr',
    icon: '⚡',
    color: '#8e30eb',
    route: '/feed/nostr',
    tagline: 'Notes and Other Stuff Transmitted by Relays',
    what: 'Nostr is a simple, open protocol where posts are signed JSON events broadcast to a network of relays. There is no server you depend on — anyone can run a relay, and your identity is a cryptographic keypair that no platform controls.',
    why: 'Nostr is the most censorship-resistant social protocol in existence. Your account cannot be banned because it is literally a key. It is Bitcoin-native: zaps (Lightning tips) are built into the protocol, and many of the sharpest minds in crypto publish there first.',
    goodFor: [
      'Censorship-resistant microblogging',
      'Lightning zaps and tipping',
      'Long-form articles (NIP-23)',
      'Bitcoin and freedom-tech communities',
    ],
    degenfeed:
      'DegenFeed connects to a pool of relays for redundancy, renders kinds 1, 6, 7, 30023 and 9734 (zap requests), supports NIP-07 browser signing and NIP-46 remote signing, and lets you cross-post your Nostr notes to every other protocol — with zaps aggregated into your unified feed.',
  },
  {
    id: 'farcaster',
    name: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    route: '/feed/farcaster',
    tagline: 'Sufficiently decentralized social',
    what: 'Farcaster is a decentralized social network built on a hybrid architecture: a content-addressed hub network for posts, with identity anchored to Ethereum. It is the home of Warpcast, channels, and Farcaster Frames — interactive mini-apps embedded in posts.',
    why: 'Farcaster brought the Ethereum degens, crypto builders, and DAO communities into one place with a genuinely open protocol. Frames turned social posts into apps, and channels created some of the most engaged crypto communities on the internet.',
    goodFor: [
      'Crypto-native microblogging',
      'Farcaster Frames and interactive posts',
      'Channels and topic communities',
      'Wallet-centric identity',
    ],
    degenfeed:
      'DegenFeed reads from public hubs with automatic failover, renders cast adds, reactions, recasts and replies with thread context, supports wallet-based signing for posting, and lets your Farcaster casts reach Nostr, Lens, Bluesky and Mastodon from one composer.',
  },
  {
    id: 'lens',
    name: 'Lens',
    icon: '🌿',
    color: '#abfe2c',
    route: '/feed/lens',
    tagline: 'The user-owned social graph on Polygon',
    what: 'Lens Protocol is an on-chain social graph where profiles, follows, and posts are NFTs and smart-contract state on Polygon. Every action is a transaction — your social graph is literally an asset you own.',
    why: 'Lens pioneered the idea that your social graph can be portable and monetizable. Collects turn posts into mints, open actions let any app plug in, and the whole network is permissionless: no one can revoke your profile.',
    goodFor: [
      'Owned profiles and follows as NFTs',
      'Collects (minting posts)',
      'Creator monetization on-chain',
      'Composable social apps',
    ],
    degenfeed:
      'DegenFeed reads Lens publications, mirrors, comments and collects through the GraphQL API, supports challenge-response wallet signing for posting, and surfaces Lens collects and open actions in the same ranked feed as every other protocol.',
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    icon: '🦋',
    color: '#1185fe',
    route: '/feed/bluesky',
    tagline: 'The AT Protocol',
    what: 'Bluesky is built on the AT Protocol: a decentralized network where your identity is a portable DID, your data lives on a Personal Data Server (PDS) you can move, and the feed you see is generated by code you can choose — not a secret algorithm.',
    why: 'Bluesky solved the two things people hate most about web2 social: identity lock-in and algorithm opacity. Custom feeds (like Skylight, or the crypto feeds) let anyone curate, and portable identity means you can switch apps without losing followers.',
    goodFor: [
      'Portable identity (DID)',
      'Custom and algorithmic feeds',
      'App password-based automation',
      'The escape hatch from X',
    ],
    degenfeed:
      'DegenFeed reads Bluesky posts, reposts, likes and replies via XRPC, resolves DIDs across PDS instances, aggregates custom crypto feeds, and writes posts through app-password sessions — so your Bluesky presence lives alongside your other protocols.',
  },
  {
    id: 'mastodon',
    name: 'Mastodon',
    icon: '🐘',
    color: '#6364ff',
    route: '/feed/mastodon',
    tagline: 'The fediverse flagship',
    what: 'Mastodon is federated microblogging on ActivityPub — the protocol that powers the fediverse. Thousands of independent instances talk to each other, and your account on one instance can follow anyone on any other.',
    why: 'Mastodon is the proof that federated social works at scale. Communities self-host, moderate their own spaces, and interoperate globally. It is where journalists, academics, and a huge slice of the open-web movement actually live.',
    goodFor: [
      'Federated microblogging',
      'Community-run instances',
      'Long-form threads',
      'Interoperability via ActivityPub',
    ],
    degenfeed:
      'DegenFeed aggregates 15+ public instances for a diverse timeline, supports OAuth2 on our GoToSocial instance for posting, renders boosts, favourites and replies with content warnings, and cross-posts your toots to the web3 protocols.',
  },
  {
    id: 'lemmy',
    name: 'Lemmy',
    icon: '🗣️',
    color: '#2d9cdb',
    route: '/feed/lemmy',
    tagline: 'Reddit, but federated',
    what: 'Lemmy is a federated link aggregator — think Reddit built on ActivityPub. Communities are called &quot;communities&quot; (not subreddits), they are hosted on instances, and they federate with Mastodon and the rest of the fediverse.',
    why: 'Lemmy proved there is life after Reddit&apos;s API wars. Communities that were deplatformed or squeezed by corporate policy found a home on open infrastructure, and the discussions there are often deeper than anything the algorithm serves you.',
    goodFor: [
      'Link aggregation and discussion',
      'Community-driven moderation',
      'A Reddit alternative that is yours',
      'Integration with the fediverse',
    ],
    degenfeed:
      'DegenFeed reads Lemmy posts, comments and votes from curated crypto and tech communities across multiple instances, renders them in the unified feed, and gives you one place to follow the conversation without leaving your web3 timeline.',
  },
  {
    id: 'peertube',
    name: 'PeerTube',
    icon: '🎬',
    color: '#f1680d',
    route: '/feed/peertube',
    tagline: 'Decentralized video on ActivityPub',
    what: 'PeerTube is a decentralized video platform where every instance is its own YouTube — and instances federate so videos are shareable across the whole fediverse. Creators own their platform, their audience, and their monetization.',
    why: 'Video is the internet&apos;s most centralized medium — one company decides what you watch and what gets demonetized. PeerTube breaks that: no single platform can throttle, deplatform, or algorithmically bury a creator.',
    goodFor: [
      'Self-hosted video publishing',
      'Creators tired of YouTube policies',
      'Federated video discovery',
      'Long-form and live video',
    ],
    degenfeed:
      'DegenFeed aggregates videos from hundreds of PeerTube instances, renders them inline in the unified feed next to text posts, supports PeerTube Live, and makes decentralized video discoverable alongside YouTube and web3 content.',
  },
  {
    id: 'pixelfed',
    name: 'Pixelfed',
    icon: '📷',
    color: '#f9a825',
    route: '/feed/pixelfed',
    tagline: 'Federated image sharing',
    what: 'Pixelfed is a decentralized, ad-free image-sharing platform on ActivityPub — an Instagram that no corporation owns. Photos, stories, and profiles federate across instances, and your images are not fodder for an engagement-maximizing algorithm.',
    why: 'For photographers and visual creators, Pixelfed offers something Instagram never will: permanence. Your account cannot be algorithmically buried, your images are not trained into a model, and your followers are yours to keep.',
    goodFor: [
      'Photography and visual art',
      'Ad-free image sharing',
      'Privacy-respecting communities',
      'Federated visual discovery',
    ],
    degenfeed:
      'DegenFeed surfaces Pixelfed photos in the visual and media feeds, renders them in the unified timeline with full image support, and connects decentralized photography to the wider web3 conversation.',
  },
  {
    id: 'zora',
    name: 'Zora',
    icon: '🎨',
    color: '#6b21a8',
    route: '/feed/zora',
    tagline: 'On-chain minting and creator culture',
    what: 'Zora is a protocol for minting and trading on-chain media — NFTs, creator coins, and editions, primarily on Zora Network and Base. It is where digital art, music, and culture meet programmable ownership.',
    why: 'Zora turned minting into a social act: creators drop art, fans collect it, and the price and provenance live on-chain forever. It is a working example of creator economy without a platform taking a cut of the culture.',
    goodFor: [
      'NFT minting and drops',
      'Creator coins and editions',
      'On-chain provenance',
      'Digital art and music culture',
    ],
    degenfeed:
      'DegenFeed tracks Zora mints, editions, and creator coins in the web3 feed, lets you discover drops from the same ranked timeline as social posts, and connects on-chain culture to the broader decentralized social graph.',
  },
];

export default function ProtocolsPage() {
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
          Protocol Guide
        </span>
        <h1
          className="text-3xl md:text-5xl font-black mb-4"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Every Protocol. <span className="gradient-text">Explained.</span>
        </h1>
        <p
          className="text-base md:text-lg leading-relaxed"
          style={{ color: 'var(--color-fg-secondary)' }}
        >
          Nine protocols. One app. Here&apos;s why each one matters — and how DegenFeed makes them
          all work together.
        </p>
      </div>

      {/* Protocol explainers */}
      <div className="space-y-6">
        {protocols.map((p) => (
          <article
            key={p.id}
            id={p.id}
            className="rounded-2xl border p-6"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
          >
            <div className="flex items-start gap-3 mb-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                style={{ backgroundColor: `${p.color}1a`, color: p.color }}
                aria-hidden="true"
              >
                {p.icon}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--color-fg)]">{p.name}</h2>
                <p className="text-xs" style={{ color: p.color }}>
                  {p.tagline}
                </p>
              </div>
            </div>

            <div
              className="space-y-3 text-sm leading-relaxed"
              style={{ color: 'var(--color-muted)' }}
            >
              <div>
                <strong className="text-[var(--color-fg)]">What it is — </strong>
                {p.what}
              </div>
              <div>
                <strong className="text-[var(--color-fg)]">Why it matters — </strong>
                {p.why}
              </div>
            </div>

            <div className="mt-4">
              <div
                className="mb-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-accent)' }}
              >
                What it&apos;s good for
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.goodFor.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="mt-4 rounded-xl border p-4 text-xs leading-relaxed"
              style={{ borderColor: `${p.color}40`, background: `${p.color}0d` }}
            >
              <strong className="text-[var(--color-fg)]">How DegenFeed enhances it — </strong>
              {p.degenfeed}
            </div>

            <div className="mt-4">
              <Link
                href={p.route}
                className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-overlay)]"
                style={{ borderColor: `${p.color}66`, color: p.color }}
              >
                Open {p.name} feed
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M6 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* Technical deep-dive */}
      <div
        className="mt-10 rounded-2xl border p-6"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
      >
        <h2 className="text-lg font-bold mb-2 text-[var(--color-fg)]">
          Want the technical details?
        </h2>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-muted)' }}>
          Every protocol has an SDK package with read/write capabilities, health monitoring, and
          rate-limit handling. The integration guide documents endpoints, data fields, auth flows,
          and limits for each protocol.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/docs/protocols" className="btn-primary px-6 py-2.5 text-sm gap-2">
            Read the Integration Guide
          </Link>
          <Link href="/about" className="btn-secondary px-6 py-2.5 text-sm gap-2">
            Why DegenFeed
          </Link>
        </div>
      </div>
    </div>
  );
}
