import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { FAQItem } from '../components/landing/FAQItem';
import { WaitlistSection } from '../components/landing/WaitlistSection';
import './landing.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'DegenFeed — Web3 Social Media Platform | Cross-Protocol Aggregator & Creator Coins',
  description:
    'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon & more into one feed. Cross-post across 15+ protocols, launch creator coins on Base & Solana, tip in ETH/SOL/USDC/Lightning, and livestream everywhere — all without platform fees or deplatforming risk.',
  keywords: [
    'web3 social media',
    'decentralized social network',
    'cross-protocol posting',
    'creator coin platform',
    'nostr farcaster lens bluesky aggregator',
    'multi protocol social feed',
    'crypto tipping app',
    'decentralized content creator',
    'fediverse cross-post',
    'web3 publishing platform',
    'self-hosted social media',
    'cross-chain tipping',
    'decentralized video platform',
    'audio spaces crypto',
  ],
  alternates: { canonical: 'https://app.degenfeed.xyz' },
  openGraph: {
    title: 'DegenFeed — Own Your Social Network | Web3 Cross-Protocol Aggregator',
    description:
      'Post once to 15+ protocols. Launch your own creator coin. Stream everywhere. Tip in any currency. No platform fees. No deplatforming. Own your social network.',
    siteName: 'DegenFeed',
    type: 'website',
    url: 'https://app.degenfeed.xyz',
    locale: 'en_US',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — Web3 social media aggregator connecting Nostr, Farcaster, Lens, Bluesky, Mastodon',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — Web3 Social Media Platform & Cross-Protocol Aggregator',
    description:
      'Aggregate 15+ social protocols. Cross-post everywhere. Launch creator coins. Tip in crypto. Stream live. Zero platform fees. Own your network.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
};

/* ─── Feature data ───────────────────────────────────────── */

interface Feature {
  title: string;
  desc: string;
  icon: string;
  bg: string;
}

const features: Feature[] = [
  {
    title: 'Universal Cross-Posting',
    desc: 'Write once, publish to 15+ protocols simultaneously — Nostr, Farcaster, Bluesky, Lens, Mastodon, and more. Replies from any network show up in one thread.',
    icon: '\u2726',
    bg: 'rgba(0,255,65,0.12)',
  },
  {
    title: 'Creator Coins',
    desc: 'Deploy your own token on Base and Solana in one click. Anti-bot, anti-whale, anti-rug. Your community, your economy, your rules.',
    icon: '\u25CB',
    bg: 'rgba(168,85,247,0.12)',
  },
  {
    title: 'Live Everywhere',
    desc: 'Stream to 7 protocols at once — solo streams, Spaces-style audio, collaborative broadcasts, and coin-launch events with live minting.',
    icon: '\u25B6',
    bg: 'rgba(0,255,65,0.10)',
  },
  {
    title: 'Cross-Platform Tipping',
    desc: 'Tip creators in ETH, SOL, USDC, or Lightning. 0% platform fees. Unified leaderboard across every protocol.',
    icon: '\u26A1',
    bg: 'rgba(250,204,21,0.12)',
  },
  {
    title: 'Self-Hosted Infrastructure',
    desc: 'Your accounts, your data, your rules. Self-host relays, indexers, and frontends. No one can deplatform you \u2014 ever.',
    icon: '\u25C8',
    bg: 'rgba(59,130,246,0.12)',
  },
  {
    title: 'Content Aggregation',
    desc: '25+ sources fill your unified feed \u2014 Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, RSS, YouTube, PeerTube, and more. All in one timeline.',
    icon: '\u229E',
    bg: 'rgba(0,255,65,0.12)',
  },
];

/* ─── Protocol badge data ─────────────────────────────────── */

interface ProtocolBadge {
  name: string;
  color: string;
}

const protocols: ProtocolBadge[] = [
  { name: 'Mastodon', color: '#6364ff' },
  { name: 'Bluesky', color: '#1185fe' },
  { name: 'Nostr', color: '#8b5cf6' },
  { name: 'Farcaster', color: '#8a63d2' },
  { name: 'Lens', color: '#abfe2c' },
  { name: 'Mirror', color: '#f97316' },
  { name: 'Paragraph', color: '#ec4899' },
  { name: 'PeerTube', color: '#e74c3c' },
  { name: 'YouTube', color: '#ff0000' },
  { name: 'Twitch', color: '#9146ff' },
  { name: 'Lemmy', color: '#00b868' },
  { name: 'Ghost', color: '#15171a' },
  { name: 'Forem', color: '#1a1a2e' },
  { name: 'Zora', color: '#0038ff' },
  { name: 'Reddit', color: '#ff4500' },
];

/* ─── Coming Soon data ────────────────────────────────────── */

interface ComingSoonItem {
  label: string;
  labelClass: string;
  title: string;
  desc: string;
}

const comingSoon: ComingSoonItem[] = [
  {
    label: 'Q3 2026',
    labelClass: 'q2',
    title: 'Mobile Apps',
    desc: 'Native iOS and Android apps with full cross-posting, tipping, and live streaming capabilities.',
  },
  {
    label: 'Q3 2026',
    labelClass: 'q2',
    title: 'Creator Coin Launchpad',
    desc: 'One-click token deployment on Base and Solana with built-in anti-bot and liquidity bootstrapping.',
  },
  {
    label: 'Q4 2026',
    labelClass: 'q3',
    title: 'AI Content Assistant',
    desc: 'Smart compose adapts your tone for each protocol. Auto-tagging, translation, and scheduling.',
  },
  {
    label: 'Q4 2026',
    labelClass: 'q3',
    title: 'Federated Communities',
    desc: 'Cross-protocol communities with token-gating, mod tools, and on-chain governance.',
  },
  {
    label: 'Q1 2027',
    labelClass: 'q1',
    title: 'Analytics Dashboard',
    desc: 'Unified metrics across all protocols. Track reach, engagement, tips, and fan growth.',
  },
  {
    label: 'Q1 2027',
    labelClass: 'q1',
    title: 'Self-Hosted DegenFeed',
    desc: 'One-command deploy of the entire stack \u2014 relays, indexers, frontend, and storage.',
  },
];

/* ─── FAQ data ────────────────────────────────────────────── */

interface FAQEntry {
  q: string;
  a: string;
}

const faqs: FAQEntry[] = [
  {
    q: 'What is DegenFeed?',
    a: 'DegenFeed is the universal layer for decentralized social media. It aggregates content from 15+ protocols into one feed, lets you cross-post across all of them, and gives you tools to earn \u2014 tips, creator coins, and subscriptions \u2014 without platform fees.',
  },
  {
    q: 'Do I need an account?',
    a: 'No account required to browse. To post, tip, or create, you connect your wallet (EVM or Solana). No email, no password, no phone number.',
  },
  {
    q: 'Which protocols are supported?',
    a: 'Currently: Nostr, Farcaster, Lens, Bluesky, Mastodon, Reddit, RSS, YouTube, PeerTube, Threads. Coming: Mirror, Paragraph, Ghost, Forem, Twitch, Zora, Lemmy, and more.',
  },
  {
    q: 'How do Creator Coins work?',
    a: 'Creator Coins are tokens deployed on Base or Solana that represent your brand. Fans buy, hold, and trade them. You set the rules \u2014 anti-bot filters, supply caps, and revenue splits. No rugging, no exploits.',
  },
  {
    q: 'Is DegenFeed open source?',
    a: 'Yes. The entire platform is open source under the MIT license. You can inspect, fork, and self-host every line of code.',
  },
  {
    q: 'Can I self-host?',
    a: 'Yes. DegenFeed is designed to be self-hosted from day one. Run your own relays, indexers, and frontend. Your accounts are yours \u2014 always.',
  },
  {
    q: 'How does tipping work?',
    a: 'Tipping is peer-to-peer and cross-chain. Send ETH, SOL, USDC, or Lightning payments directly to creators. Zero platform fees. We never touch the money.',
  },
];

/* ══════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <div className="landing-page">
      {/* JSON-LD Structured Data for rich search results */}
      <Script
        id="landing-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebApplication',
                '@id': 'https://app.degenfeed.xyz/#webapp',
                name: 'DegenFeed',
                url: 'https://app.degenfeed.xyz',
                description:
                  'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon & more into one feed. Cross-post across 15+ protocols, launch creator coins, tip in crypto, and livestream everywhere.',
                applicationCategory: 'SocialNetworkingApplication',
                operatingSystem: 'All',
                browserRequirements: 'Requires modern browser with JavaScript enabled',
                offers: [
                  { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
                  { '@type': 'Offer', name: 'Premium', price: '10', priceCurrency: 'USD' },
                  { '@type': 'Offer', name: 'Creator', price: '25', priceCurrency: 'USD' },
                ],
                author: {
                  '@type': 'Organization',
                  name: 'Rug Munch Media LLC',
                  url: 'https://app.degenfeed.xyz',
                },
                featureList: [
                  'Multi-protocol feed aggregation of 15+ decentralized social networks',
                  'Cross-protocol posting to Nostr, Farcaster, Lens, Bluesky, Mastodon simultaneously',
                  'Creator coin deployment on Base (ERC-20) and Solana (SPL)',
                  'Cross-chain tipping in ETH, SOL, USDC, and Lightning Network',
                  'Multi-protocol livestreaming and audio spaces',
                  'Self-hosted infrastructure with full data portability',
                  'Cross-protocol search and content discovery',
                  'Real-time notifications and unified messaging',
                ],
                screenshot: {
                  '@type': 'ImageObject',
                  url: 'https://app.degenfeed.xyz/og-image.png',
                },
              },
              {
                '@type': 'SoftwareSourceCode',
                '@id': 'https://git.rugmunch.io/RugMunchMedia/degenfeed-web',
                name: 'DegenFeed',
                description:
                  'Open-source multi-protocol social aggregator for web3. Aggregates Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS.',
                codeRepository: 'https://git.rugmunch.io/RugMunchMedia/degenfeed-web',
                programmingLanguage: 'TypeScript',
                license: 'https://www.gnu.org/licenses/agpl-3.0.html',
                applicationCategory: 'SocialNetworkingApplication',
                operatingSystem: 'POSIX, macOS, Windows',
              },
              {
                '@type': 'BreadcrumbList',
                '@id': 'https://app.degenfeed.xyz/#breadcrumb',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: 'https://app.degenfeed.xyz',
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Features',
                    item: 'https://app.degenfeed.xyz/features',
                  },
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: 'FAQ',
                    item: 'https://app.degenfeed.xyz/faq',
                  },
                ],
              },
              {
                '@type': 'Organization',
                '@id': 'https://app.degenfeed.xyz/#organization',
                name: 'Rug Munch Media LLC',
                url: 'https://app.degenfeed.xyz',
                logo: 'https://app.degenfeed.xyz/icon-512.png',
                sameAs: ['https://git.rugmunch.io/RugMunchMedia', 'https://codeberg.org/degenfeed'],
              },
            ],
          }),
        }}
      />
      {/* Background glows */}
      <div className="hero-bg-glow" aria-hidden="true" />
      <div className="hero-glow-secondary" aria-hidden="true" />

      {/* ── Skip to app ── */}
      <a href="/feed" className="skip-to-app">
        <span className="skip-dot" />
        Browse Feed
        <span className="skip-arrow" aria-hidden="true">
          &rarr;
        </span>
      </a>

      <div className="mx-auto max-w-[1200px]">
        {/* ══════════════ HERO ══════════════ */}
        <section className="hero-section" aria-label="Hero">
          <div className="hero-content">
            {/* Logo */}
            <div className="hero-logo">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <rect width="48" height="48" rx="12" fill="var(--color-accent)" />
                <text
                  x="24"
                  y="32"
                  textAnchor="middle"
                  fill="#000000"
                  fontSize="26"
                  fontWeight="800"
                  fontFamily="system-ui"
                >
                  D
                </text>
              </svg>
            </div>

            <h1 className="hero-headline">
              <span className="hero-headline-line">Own Your</span>
              <span className="hero-headline-line gradient-text">Social Network</span>
            </h1>

            <p className="hero-sub">
              <span className="hero-highlight">Post once.</span> Reach 15+ protocols.{' '}
              <span className="hero-highlight">Earn from anywhere.</span> No one can deplatform you.
            </p>

            <div className="hero-ctas">
              <Link href="/waitlist" className="cta-primary cta-primary-lg">
                Join the Waitlist
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link href="/feed" className="cta-secondary">
                Explore the Feed
              </Link>
            </div>

            <div className="hero-proof">
              <span className="hero-proof-dot" />
              <span>
                <strong>1,247</strong> creators on the waitlist
              </span>
              <span aria-hidden="true">&middot;</span>
              <span>No account needed</span>
            </div>
          </div>
        </section>

        {/* ══════════════ PROTOCOL MARQUEE ══════════════ */}
        <section className="protocol-marquee-section" aria-label="Supported protocols">
          <div className="protocol-marquee-fade" aria-hidden="true" />
          <ul className="protocol-marquee" aria-label="Supported protocols scroll">
            {[...protocols, ...protocols].map((p, i) => (
              <li key={`${p.name}-${i}`} className="protocol-badge">
                <span className="protocol-badge-dot" style={{ backgroundColor: p.color }} />
                {p.name}
              </li>
            ))}
          </ul>
        </section>

        {/* ══════════════ FEATURES ══════════════ */}
        <section className="features-section" id="features" aria-labelledby="features-heading">
          <h2 id="features-heading" className="section-heading">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="section-sub">
            DegenFeed is the first platform that truly puts you in control \u2014 of your content,
            your economy, and your infrastructure.
          </p>

          <div className="features-grid">
            {features.map((f) => (
              <article key={f.title} className="feature-card">
                <div
                  className="feature-icon"
                  style={{ backgroundColor: f.bg, color: 'var(--color-accent)' }}
                >
                  {f.icon}
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ══════════════ COMING SOON ══════════════ */}
        <section className="coming-soon-section" id="coming-soon" aria-labelledby="coming-heading">
          <h2 id="coming-heading" className="section-heading">
            What&apos;s next
          </h2>
          <p className="section-sub">
            We&apos;re building the future of decentralized social. Here&apos;s what&apos;s coming.
          </p>

          <div className="coming-soon-grid">
            {comingSoon.map((item) => (
              <article key={item.title} className="coming-soon-item">
                <span className={`coming-soon-label ${item.labelClass}`}>{item.label}</span>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ══════════════ WAITLIST ══════════════ */}
        <WaitlistSection />

        {/* ══════════════ FAQ ══════════════ */}
        <section className="faq-section" id="faq" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="section-heading">
            Frequently asked questions
          </h2>

          <div className="faq-list">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </section>

        {/* ══════════════ FINAL CTA ══════════════ */}
        <section className="cta-section" aria-labelledby="cta-heading">
          <div className="cta-inner">
            <h2 id="cta-heading" className="cta-heading">
              Ready to own your network?
            </h2>
            <p className="cta-sub">
              No account needed. No platform fees. No one can deplatform you.
            </p>
            <div className="hero-ctas">
              <Link href="/waitlist" className="cta-primary cta-primary-lg">
                Join the Waitlist
              </Link>
              <Link href="/feed" className="cta-secondary">
                Browse the Feed
              </Link>
            </div>

            <nav className="cta-footer-nav" aria-label="Footer">
              <Link href="/about" className="footer-link">
                About
              </Link>
              <Link href="/features" className="footer-link">
                Features
              </Link>
              <Link href="/docs" className="footer-link">
                Docs
              </Link>
              <Link href="/api-docs" className="footer-link">
                API
              </Link>
              <Link href="/faq" className="footer-link">
                FAQ
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
              <a
                href="https://github.com/rugmunchmedia/degenfeed"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                GitHub
              </a>
            </nav>

            <p className="cta-copyright">
              &copy; {new Date().getFullYear()} DegenFeed &mdash; a Rug Munch Media LLC product.
              Open source. Free forever. No account required.
            </p>
          </div>
        </section>
      </div>
      {/* end max-w-[1200px] */}
    </div>
  );
}
