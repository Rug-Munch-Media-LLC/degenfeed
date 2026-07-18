import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingCTAButtons } from '../components/LandingCTAButtons';
import './landing.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'DegenFeed — Every Network. One Feed.',
  description:
    "See what's happening in web3 right now. DegenFeed aggregates Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, and RSS into one unified feed. Cross-protocol, wallet-native, open source.",
  alternates: { canonical: 'https://app.degenfeed.xyz' },
  openGraph: {
    title: 'DegenFeed — Every Network. One Feed.',
    description:
      "See what's happening in web3 right now. Aggregates Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, RSS — all in one place.",
    siteName: 'DegenFeed',
    type: 'website',
    url: 'https://app.degenfeed.xyz',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — web3 social aggregator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — Every Network. One Feed.',
    description:
      "See what's happening in web3 right now. Nostr, Farcaster, Lens, Bluesky, Mastodon — all in one place.",
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
};

/* ─── Feature data ───────────────────────────────────────── */

interface Feature {
  title: string;
  desc: string;
}

const features: Feature[] = [
  {
    title: 'Every Network, One Feed',
    desc: 'See content from Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, and more in one unified timeline.',
  },
  {
    title: 'Post Once, Publish Everywhere',
    desc: 'Our cross-protocol composer sends your post to every network you choose. Replies from any network show up in one thread.',
  },
  {
    title: 'Tip Creators in Crypto',
    desc: 'Send tips in ETH, SOL, USDC, or Lightning. 0% platform fees. Unified leaderboard across every protocol.',
  },
  {
    title: 'Your Communities, Your Rules',
    desc: 'Create and govern communities with on-chain voting. Self-host or federate — you own the infrastructure.',
  },
];

/* ─── Comparison data ────────────────────────────────────── */

interface ComparisonRow {
  feature: string;
  degenfeed: string;
  twitter: string;
  farcaster: string;
  lens: string;
}

const comparisons: ComparisonRow[] = [
  { feature: 'Multi-protocol feed', degenfeed: '✓', twitter: '—', farcaster: '—', lens: '—' },
  { feature: 'Cross-protocol replies', degenfeed: '✓', twitter: '—', farcaster: '—', lens: '—' },
  { feature: 'Wallet-native auth', degenfeed: '✓', twitter: '—', farcaster: '✓', lens: '✓' },
  { feature: 'Crypto tipping', degenfeed: '✓', twitter: '—', farcaster: 'Zaps only', lens: '—' },
  { feature: 'Open source', degenfeed: '✓', twitter: '—', farcaster: 'Partial', lens: 'Partial' },
  { feature: 'Self-hostable', degenfeed: '✓', twitter: '—', farcaster: '—', lens: '—' },
  { feature: 'No account required', degenfeed: '✓', twitter: '—', farcaster: '—', lens: '—' },
  { feature: '0% platform fees', degenfeed: '✓', twitter: '—', farcaster: '—', lens: '—' },
];

/* ─── Mock posts for preview ─────────────────────────────── */

interface MockPost {
  protocol: string;
  protocolColor: string;
  icon: string;
  author: string;
  handle: string;
  time: string;
  content: string;
  likes: string;
  replies: string;
}

const mockPosts: MockPost[] = [
  {
    protocol: 'Farcaster',
    protocolColor: '#8a63d2',
    icon: '◈',
    author: 'dwr.eth',
    handle: '@dwr',
    time: '12m',
    content:
      "The on-chain economy is moving faster than ever. We're seeing more daily active users on Farcaster than last month, and the quality of conversation keeps getting better. LFG.",
    likes: '142',
    replies: '23',
  },
  {
    protocol: 'Nostr',
    protocolColor: '#8b5cf6',
    icon: '☰',
    author: 'PabloF7z',
    handle: 'npub1...4x7p',
    time: '34m',
    content:
      'Nostr relays are now processing over 1M events per day. The decentralized relay landscape is diversifying — new relays launching weekly with different fee models and moderation policies.',
    likes: '89',
    replies: '15',
  },
  {
    protocol: 'Bluesky',
    protocolColor: '#1185fe',
    icon: '☁',
    author: 'alice.bsky.social',
    handle: '@alice.bsky',
    time: '1h',
    content:
      "Just published a deep dive on the AT Protocol's new federation model. TL;DR: much simpler than people think. The repo is open — come build with us.",
    likes: '234',
    replies: '41',
  },
  {
    protocol: 'Lens',
    protocolColor: '#abfe2c',
    icon: '◎',
    author: 'stani.lens',
    handle: '@stani',
    time: '2h',
    content:
      'Lens Protocol v2 is live on Polygon. Key upgrades: gasless profiles, community moderation tools, and improved creator monetization. Thanks to everyone who tested on testnet.',
    likes: '567',
    replies: '78',
  },
];

/* ─── ══════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <div className="landing-page">
      <div className="mx-auto max-w-[1200px]">
        {/* ── Skip to app ── */}
        <a href="/feed" className="skip-to-app">
          <span className="skip-dot" />
          Browse Feed
          <span className="skip-arrow" aria-hidden="true">
            →
          </span>
        </a>

        {/* ══════════════ HERO ══════════════ */}
        <section className="hero-section" aria-label="Hero">
          <div className="hero-content">
            {/* Logo */}
            <div className="hero-logo">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect width="40" height="40" rx="10" fill="#00ff41" />
                <text
                  x="20"
                  y="27"
                  textAnchor="middle"
                  fill="#000000"
                  fontSize="22"
                  fontWeight="800"
                  fontFamily="system-ui"
                >
                  D
                </text>
              </svg>
            </div>

            <h1 className="hero-headline">
              See what&apos;s happening
              <br />
              in web3 right now.
            </h1>

            <p className="hero-sub">
              DegenFeed brings every network together. Nostr, Farcaster, Lens, Bluesky, Mastodon —
              all in one place. No account needed. Free forever.
            </p>

            <LandingCTAButtons />

            <p className="hero-stats">
              10 protocols &middot; 353 RSS sources &middot; 137 Reddit communities &middot; 68
              YouTube channels &middot; 55K PeerTube videos
            </p>
          </div>
        </section>

        {/* ══════════════ FEATURES ══════════════ */}
        <section className="features-section" id="features" aria-labelledby="features-heading">
          <h2 id="features-heading" className="section-heading">
            Everything in one place.
          </h2>

          <div className="features-grid">
            {features.map((f) => (
              <article key={f.title} className="feature-card">
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ══════════════ PREVIEW ══════════════ */}
        <section className="preview-section" id="preview" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="section-heading">
            What you&apos;ll see.
          </h2>
          <p className="preview-sub">
            Posts from Nostr, Farcaster, Lens, Bluesky, Mastodon in one timeline.
          </p>

          <div className="preview-feed">
            {mockPosts.map((post) => (
              <article key={post.handle + post.time} className="preview-post">
                <div className="preview-post-header">
                  <div
                    className="preview-post-avatar"
                    style={{
                      backgroundColor: `${post.protocolColor}22`,
                      color: post.protocolColor,
                    }}
                  >
                    {post.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="preview-post-meta">
                    <span className="preview-post-author">{post.author}</span>
                    <span className="preview-post-handle">
                      {post.handle} &middot; {post.time}
                    </span>
                  </div>
                  <span
                    className="preview-post-badge"
                    style={{
                      backgroundColor: `${post.protocolColor}18`,
                      color: post.protocolColor,
                      borderColor: `${post.protocolColor}30`,
                    }}
                  >
                    {post.icon} {post.protocol}
                  </span>
                </div>
                <p className="preview-post-content">{post.content}</p>
                <div className="preview-post-actions">
                  <span className="preview-post-action">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {post.replies}
                  </span>
                  <span className="preview-post-action">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    {post.likes}
                  </span>
                  <span className="preview-post-action">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ══════════════ COMPARISON ══════════════ */}
        <section className="comparison-section" id="compare" aria-labelledby="compare-heading">
          <h2 id="compare-heading" className="section-heading">
            What makes DegenFeed different.
          </h2>

          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="col-degen">DegenFeed</th>
                  <th>Twitter/X</th>
                  <th>Farcaster</th>
                  <th>Lens</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr key={row.feature}>
                    <td className="comp-feature">{row.feature}</td>
                    <td className="comp-value col-degen">{row.degenfeed}</td>
                    <td className="comp-value">{row.twitter}</td>
                    <td className="comp-value">{row.farcaster}</td>
                    <td className="comp-value">{row.lens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ══════════════ FINAL CTA ══════════════ */}
        <section className="cta-section" aria-labelledby="cta-heading">
          <div className="cta-inner">
            <h2 id="cta-heading" className="cta-heading">
              Ready to join?
            </h2>
            <p className="cta-sub">No account needed. No surveillance. No platform fees.</p>
            <LandingCTAButtons />

            <nav className="cta-footer-nav" aria-label="Footer">
              <Link href="/about" className="footer-link">
                About
              </Link>
              <Link href="/faq" className="footer-link">
                FAQ
              </Link>
              <Link href="/docs" className="footer-link">
                Docs
              </Link>
              <Link href="/api-docs" className="footer-link">
                API
              </Link>
              <Link href="/status" className="footer-link">
                Status
              </Link>
              <Link href="/privacy" className="footer-link">
                Privacy
              </Link>
              <Link href="/terms" className="footer-link">
                Terms
              </Link>
              <Link href="/developers" className="footer-link">
                Developers
              </Link>
              <a
                href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                Source
              </a>
            </nav>

            <p className="cta-copyright">
              &copy; {new Date().getFullYear()} DegenFeed &mdash; a Rug Munch Media LLC product. No
              account required. Open source. Free forever.
            </p>
          </div>
        </section>
      </div>
      {/* end max-w-[1200px] */}
    </div>
  );
}
