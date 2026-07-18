import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import Link from 'next/link';
import './landing.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'DegenFeed — Every Network. One Feed.',
  description:
    'The web3 social super app. Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, PeerTube — all in one place. Open source, wallet-native, cross-protocol.',
  alternates: { canonical: 'https://app.degenfeed.xyz' },
  openGraph: {
    title: 'DegenFeed — Every Network. One Feed.',
    description:
      'The web3 social super app. Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, PeerTube — all in one place. Cross-protocol, wallet-native, open source.',
    siteName: 'DegenFeed',
    type: 'website',
    url: 'https://app.degenfeed.xyz',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — Every Network. One Feed.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — Every Network. One Feed.',
    description:
      'The web3 social super app. Nostr, Farcaster, Lens, Bluesky, Mastodon — all in one place.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
};

const sora = Sora({ subsets: ['latin'], display: 'swap', variable: '--font-sora' });

/* ─── Data ─────────────────────────────────────────────────────────── */

interface ProtocolIcon {
  icon: string;
  label: string;
  x: string;
  y: string;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
}

const protocolIcons: ProtocolIcon[] = [
  { icon: '☰', label: 'Nostr', x: '8%', y: '15%', duration: 22, delay: 0, size: 28, opacity: 0.35 },
  {
    icon: '◈',
    label: 'Farcaster',
    x: '85%',
    y: '20%',
    duration: 26,
    delay: 1.2,
    size: 32,
    opacity: 0.3,
  },
  {
    icon: '◎',
    label: 'Lens',
    x: '15%',
    y: '60%',
    duration: 20,
    delay: 0.6,
    size: 26,
    opacity: 0.3,
  },
  {
    icon: '☁',
    label: 'Bluesky',
    x: '75%',
    y: '55%',
    duration: 24,
    delay: 2.1,
    size: 30,
    opacity: 0.35,
  },
  {
    icon: 'M',
    label: 'Mastodon',
    x: '5%',
    y: '38%',
    duration: 28,
    delay: 0.3,
    size: 22,
    opacity: 0.25,
  },
  {
    icon: 'L',
    label: 'Lemmy',
    x: '90%',
    y: '70%',
    duration: 18,
    delay: 1.8,
    size: 24,
    opacity: 0.25,
  },
  {
    icon: 'R',
    label: 'Reddit',
    x: '12%',
    y: '80%',
    duration: 30,
    delay: 0.9,
    size: 26,
    opacity: 0.2,
  },
  {
    icon: '▶',
    label: 'PeerTube',
    x: '82%',
    y: '8%',
    duration: 21,
    delay: 2.5,
    size: 20,
    opacity: 0.2,
  },
  {
    icon: '♯',
    label: 'Threads',
    x: '92%',
    y: '40%',
    duration: 25,
    delay: 1.5,
    size: 22,
    opacity: 0.2,
  },
  { icon: 'A', label: 'RSS', x: '20%', y: '5%', duration: 19, delay: 3.0, size: 18, opacity: 0.2 },
  {
    icon: '📡',
    label: 'Bluesky',
    x: '60%',
    y: '78%',
    duration: 27,
    delay: 0.4,
    size: 24,
    opacity: 0.2,
  },
  {
    icon: '📻',
    label: 'Nostr',
    x: '45%',
    y: '88%',
    duration: 23,
    delay: 1.1,
    size: 20,
    opacity: 0.15,
  },
];

interface Feature {
  emoji: string;
  title: string;
  desc: string;
  gradient: string;
}

const features: Feature[] = [
  {
    emoji: '🌐',
    title: 'Cross-Protocol',
    desc: 'Post once, publish everywhere. Bridge replies across Nostr, Farcaster, Lens, Bluesky, and Mastodon — all from one composer.',
    gradient: 'from-emerald-400 via-green-400 to-teal-400',
  },
  {
    emoji: '🤖',
    title: 'AI-Powered Feed',
    desc: 'Personalized content from 10+ networks. Smart curation learns what you care about, cuts through the noise.',
    gradient: 'from-violet-400 via-purple-400 to-fuchsia-400',
  },
  {
    emoji: '⚡',
    title: 'Multi-Currency Tips',
    desc: 'Tip in ETH, SOL, USDC, or Lightning. Unified leaderboard shows top creators across every protocol.',
    gradient: 'from-amber-400 via-yellow-400 to-orange-400',
  },
  {
    emoji: '🍋',
    title: 'Own Your Communities',
    desc: 'Lemmy, PeerTube, Mastodon. Self-host or join federated instances. You control the infrastructure.',
    gradient: 'from-lime-400 via-green-400 to-emerald-400',
  },
  {
    emoji: '📊',
    title: 'Creator Analytics',
    desc: 'Cross-protocol stats that actually make sense. Know your reach, engagement, and growth everywhere at once.',
    gradient: 'from-sky-400 via-blue-400 to-indigo-400',
  },
  {
    emoji: '🔒',
    title: 'Web3 Native',
    desc: 'Wallet auth. Token-gated content. On-chain permanence. No email, no password, no surveillance.',
    gradient: 'from-rose-400 via-pink-400 to-fuchsia-400',
  },
  {
    emoji: '💬',
    title: 'Unified DMs',
    desc: 'Message across Nostr, Farcaster, Lens, and Mastodon from one inbox. Encrypted where available.',
    gradient: 'from-cyan-400 via-teal-400 to-emerald-400',
  },
  {
    emoji: '🎙️',
    title: 'Audio Spaces',
    desc: 'Live rooms with real-time reactions. Cross-protocol broadcast to all your networks simultaneously.',
    gradient: 'from-orange-400 via-amber-400 to-yellow-400',
  },
  {
    emoji: '📰',
    title: 'Daily Digest',
    desc: 'Personalized newsletter of what you missed. Curated from every protocol, delivered to your inbox or feed.',
    gradient: 'from-red-400 via-rose-400 to-pink-400',
  },
];

interface Step {
  num: string;
  title: string;
  desc: string;
  icon: string;
}

const steps: Step[] = [
  {
    num: '01',
    title: 'Connect Your Wallet',
    desc: 'One wallet, all networks. Sign in with your existing Ethereum, Solana, or Nostr key.',
    icon: '🔑',
  },
  {
    num: '02',
    title: 'Choose Your Protocols',
    desc: 'Toggle the networks you care about. Nostr, Farcaster, Lens, Bluesky — pick any combo.',
    icon: '🎛️',
  },
  {
    num: '03',
    title: 'Enjoy Your Feed',
    desc: 'Everything in one place. Cross-protocol replies, unified DMs, and AI curation.',
    icon: '✨',
  },
];

interface Testimonial {
  quote: string;
  author: string;
  role: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      'Finally, one app for all my web3 social. No more tab juggling between Farcaster and Lens.',
    author: '@degen_trader',
    role: 'Crypto Twitter User',
  },
  {
    quote:
      'The cross-protocol replies are magic. I post on Nostr and the replies from Farcaster show up in the same thread.',
    author: '@farcaster_builder',
    role: 'Farcaster Builder',
  },
  {
    quote: 'I can see my Lemmy community alongside my Nostr feed. It just works.',
    author: '@community_creator',
    role: 'Community Creator',
  },
];

const statRows: Array<{ value: string; label: string }[]> = [
  [
    { value: '10+', label: 'Protocols' },
    { value: '242', label: 'RSS Sources' },
    { value: '55', label: 'Reddit Communities' },
    { value: '46', label: 'YouTube Channels' },
    { value: '35', label: 'Newsletters' },
  ],
  [
    { value: '2M+', label: 'PeerTube Videos' },
    { value: '80+', label: 'Lemmy Communities' },
    { value: '15', label: 'Fediverse Instances' },
  ],
];

const footerLinks: { href: string; label: string }[] = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/docs', label: 'Docs' },
  { href: '/api-docs', label: 'API' },
  { href: '/status', label: 'Status' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/developers', label: 'Developers' },
];

/* ─── Component ────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className={`${sora.variable} landing-page`}>
      {/* ── Skip to app ── */}
      <a href="/feed" className="skip-to-app">
        <span className="skip-dot" />
        Skip to App
        <span className="skip-arrow" aria-hidden="true">
          →
        </span>
      </a>

      {/* ── Floating background mesh ── */}
      <div className="hero-mesh" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />

      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <section className="hero-section" id="hero" aria-label="Hero">
        {/* Floating protocol icons */}
        <div className="float-icons-container" aria-hidden="true">
          {protocolIcons.map((p) => (
            <span
              key={p.label + p.x + p.y}
              className="float-icon"
              style={{
                left: p.x,
                top: p.y,
                fontSize: `${p.size}px`,
                opacity: p.opacity,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
              aria-hidden="true"
            >
              {p.icon}
            </span>
          ))}
        </div>

        <div className="hero-content">
          {/* Eyebrow */}
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            The web3 social super app
          </div>

          {/* Headline */}
          <h1 className="hero-headline">
            <span className="hero-headline-line">Every Network.</span>{' '}
            <span className="hero-headline-accent">One Feed.</span>
          </h1>

          {/* Subheadline */}
          <p className="hero-sub">
            Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, PeerTube — all in one place.
            <br className="hidden sm:inline" /> Cross-protocol replies. Wallet-native. Open source.
            Free forever.
          </p>

          {/* CTAs */}
          <div className="hero-ctas">
            <Link href="/onboarding" className="cta-primary">
              Get Started
              <svg
                className="cta-arrow"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="/discover" className="cta-secondary">
              Explore
              <svg
                className="cta-arrow"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          {/* Protocol quick badges */}
          <div className="hero-badges">
            {[
              'Nostr',
              'Farcaster',
              'Lens',
              'Bluesky',
              'Mastodon',
              'Lemmy',
              'PeerTube',
              'Reddit',
              'RSS',
            ].map((p) => (
              <span key={p} className="proto-badge">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════════ */}
      <section className="stats-section" aria-label="Stats">
        <div className="stats-container">
          {statRows[0]?.map((stat) => (
            <div key={stat.label} className="stat-item">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
        <div className="stats-container stats-secondary">
          {statRows[1]?.map((stat) => (
            <div key={stat.label} className="stat-item">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
          <div className="stat-item">
            <span className="stat-value text-degen-400">0%</span>
            <span className="stat-label">Platform Fees on Tips</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="stat-label">Open Source</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14M12 5l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="stat-label">Self-Hostable</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FEATURES GRID 3x3
      ══════════════════════════════════════════════════════════ */}
      <section className="features-section" id="features" aria-labelledby="features-heading">
        <div className="section-label">
          <span className="label-dot" />
          Features
        </div>
        <h2 id="features-heading" className="section-heading">
          Everything you need.
          <br />
          <span className="text-degen-400">Nothing you don&apos;t.</span>
        </h2>

        <div className="features-grid">
          {features.map((f, i) => (
            <article
              key={f.title}
              className="feature-card"
              style={{ '--i': i } as React.CSSProperties}
            >
              <div className={`feature-icon-wrap bg-gradient-to-br ${f.gradient}`}>
                <span className="feature-emoji" aria-hidden="true">
                  {f.emoji}
                </span>
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
              <div className="feature-shimmer" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS — 3 steps
      ══════════════════════════════════════════════════════════ */}
      <section className="steps-section" id="how-it-works" aria-labelledby="steps-heading">
        <div className="section-label">
          <span className="label-dot" />
          How It Works
        </div>
        <h2 id="steps-heading" className="section-heading">
          Three steps to <span className="text-degen-400">everything.</span>
        </h2>

        <div className="steps-container">
          {/* Connecting line (desktop) */}
          <div className="steps-line" aria-hidden="true" />

          {steps.map((step, i) => (
            <div key={step.num} className="step-card" style={{ '--i': i } as React.CSSProperties}>
              <div className="step-number-wrap">
                <span className="step-number">{step.num}</span>
                <div className="step-icon-wrap">
                  <span className="step-icon" aria-hidden="true">
                    {step.icon}
                  </span>
                </div>
              </div>
              <div className="step-content">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════ */}
      <section
        className="testimonials-section"
        id="testimonials"
        aria-labelledby="testimonials-heading"
      >
        <div className="section-label">
          <span className="label-dot" />
          Community Love
        </div>
        <h2 id="testimonials-heading" className="section-heading">
          What people <span className="text-degen-400">are saying</span>
        </h2>

        <div className="testimonials-grid">
          {testimonials.map((t, i) => (
            <figure
              key={t.author}
              className="testimonial-card"
              style={{ '--i': i } as React.CSSProperties}
            >
              {/* Floating quote mark */}
              <div className="testimonial-quote-mark" aria-hidden="true">
                <svg width="40" height="32" viewBox="0 0 40 32" fill="none" aria-hidden="true">
                  <path
                    d="M12 16c-2.2 0-4-.8-5.4-2.4C5.2 12 4.4 10 4.4 7.6c0-2.4.8-4.4 2.4-6C8.4 0 10.4-.8 12.8-.8c2.4 0 4.4.8 6 2.4 1.6 1.6 2.4 3.6 2.4 6 0 2.8-.8 5.2-2.4 7.2L12 16zm-8 16l5.6-10.4H12L6.4 32H4zm20-16c-2.2 0-4-.8-5.4-2.4-1.4-1.6-2.2-3.6-2.2-6 0-2.4.8-4.4 2.4-6C20 0 22-.8 24.4-.8c2.4 0 4.4.8 6 2.4 1.6 1.6 2.4 3.6 2.4 6 0 2.8-.8 5.2-2.4 7.2L24 16zm-8 16l5.6-10.4H24L18.4 32H16z"
                    fill="currentColor"
                    opacity="0.15"
                  />
                </svg>
              </div>
              <blockquote className="testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="testimonial-author">
                <div className="testimonial-avatar" aria-hidden="true">
                  {t.author.charAt(1).toUpperCase()}
                </div>
                <div>
                  <div className="testimonial-name">{t.author}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════ */}
      <section className="cta-section" aria-labelledby="cta-heading">
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-inner">
          <h2 id="cta-heading" className="cta-heading">
            Ready to experience the
            <br />
            <span className="text-degen-400">future of social media?</span>
          </h2>
          <p className="cta-sub">
            Join thousands of users already browsing every network from one place.
            <br className="hidden sm:inline" /> No account needed. No surveillance. Free forever.
          </p>
          <div className="hero-ctas">
            <Link href="/onboarding" className="cta-primary cta-primary-lg">
              Get Started
              <svg
                className="cta-arrow"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="/feed" className="cta-secondary">
              Browse Feed
              <svg
                className="cta-arrow"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          {/* Footer links */}
          <nav className="cta-footer-nav" aria-label="Footer">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="footer-link">
                {link.label}
              </Link>
            ))}
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
            © {new Date().getFullYear()} DegenFeed — a Rug Munch Media LLC product. No account
            required. Open source. MIT license.
          </p>
        </div>
      </section>
    </div>
  );
}
