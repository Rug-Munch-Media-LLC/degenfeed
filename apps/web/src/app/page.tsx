import type { Metadata } from 'next';
import Link from 'next/link';

/* ─── SEO ────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'DegenFeed — All Your Feeds. One Platform.',
  description:
    'DegenFeed aggregates 20+ decentralized protocols into one feed: Mastodon, Bluesky, Nostr, Farcaster, Lens, Lemmy, Reddit, YouTube and more. No switching accounts. Own your network.',
  alternates: {
    canonical: 'https://degenfeed.xyz',
  },
  openGraph: {
    title: 'DegenFeed — All Your Feeds. One Platform.',
    description: '20+ decentralized protocols. One feed. No switching accounts. Own your network.',
    url: 'https://degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — All Your Feeds. One Platform.',
    description: '20+ decentralized protocols. One feed. No switching accounts. Own your network.',
    creator: '@degenfeed',
  },
};

/* ─── PROTOCOLS (static grid) ───────────────────────────────────────── */

interface Protocol {
  name: string;
  color: string;
  description: string;
}

const PROTOCOLS: Protocol[] = [
  { name: 'Mastodon', color: '#6364ff', description: 'The largest decentralized social network.' },
  { name: 'Bluesky', color: '#1185fe', description: 'AT Protocol microblogging at scale.' },
  { name: 'Nostr', color: '#8e30eb', description: 'Censorship-resistant, key-based social.' },
  { name: 'Farcaster', color: '#8a63d2', description: 'Sufficiently decentralized casts.' },
  { name: 'Lens', color: '#abfe2c', description: 'Composable, on-chain social graph.' },
  { name: 'Lemmy', color: '#d4d4d4', description: 'Federated link aggregators & communities.' },
  { name: 'Threads', color: '#888888', description: 'Meta’s text conversations, via fediverse.' },
  { name: 'Reddit', color: '#ff4500', description: 'Communities, discussions and AMAs.' },
  { name: 'RSS', color: '#ffa500', description: 'The open web’s original firehose.' },
  { name: 'YouTube', color: '#ff0000', description: 'Video channels, straight to your feed.' },
  { name: 'PeerTube', color: '#f1680d', description: 'Federated video, no platform lock-in.' },
  { name: 'Pixelfed', color: '#ff4c6a', description: 'Decentralized photo sharing.' },
  { name: 'Zora', color: '#00e5c0', description: 'On-chain media and creator coins.' },
];

/* ─── FEATURES (static grid) ────────────────────────────────────────── */

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ICON_ATTRS = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const FEATURES: Feature[] = [
  {
    title: 'Unified Feed',
    description:
      'Mastodon, Bluesky, Nostr, Farcaster, Lens, Lemmy, RSS and more — merged into one chronological stream. No switching accounts, no missed posts.',
    icon: (
      <svg {...ICON_ATTRS} aria-hidden="true">
        <path d="M12 3l9 5-9 5-9-5 9-5z" />
        <path d="M3 13l9 5 9-5" />
        <path d="M3 17l9 5 9-5" />
      </svg>
    ),
  },
  {
    title: 'Cross-Protocol Composer',
    description:
      'Write once, publish everywhere. Compose a post and fan it out to every connected network in a single click — replies, media and all.',
    icon: (
      <svg {...ICON_ATTRS} aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
      </svg>
    ),
  },
  {
    title: 'Network Ownership',
    description:
      'Your follows, your graph, your data — yours. Exportable, portable and self-hostable. No algorithm farm harvesting your attention.',
    icon: (
      <svg {...ICON_ATTRS} aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
        <path d="M17 3l1.5 3 3 .5-2 2 .5 3-3-1.5-3 1.5.5-3-2-2 3-.5z" />
      </svg>
    ),
  },
  {
    title: 'Bias-Rated News',
    description:
      'Crypto news with media-bias ratings on every story — see the slant before you read. Better than Ground News, purpose-built for degens.',
    icon: (
      <svg {...ICON_ATTRS} aria-hidden="true">
        <path d="M12 3l2.7 5.6 6.3.9-4.5 4.4 1 6.1L12 17.8l-5.5 3 1-6.1L3 9.5l6.3-.9z" />
      </svg>
    ),
  },
  {
    title: 'Tipping & Creator Coins',
    description:
      'Send sats, tips and creator coins straight to the people you follow — peer-to-peer, on-chain, with zero platform cut. Fund the feeds you love.',
    icon: (
      <svg {...ICON_ATTRS} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2.2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5" />
      </svg>
    ),
  },
  {
    title: 'Algorithm Controls',
    description:
      'You decide what ranks. Weight recency, boost trusted sources, mute the noise — transparent, tunable ranking you can inspect and reset.',
    icon: (
      <svg {...ICON_ATTRS} aria-hidden="true">
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    ),
  },
];

/* ─── DOCS & LINKS (static) ─────────────────────────────────────────── */

interface DocLink {
  label: string;
  href: string;
  description: string;
}

const DOC_LINKS: DocLink[] = [
  {
    label: 'Documentation',
    href: '/docs',
    description: 'Everything you need to get started with DegenFeed.',
  },
  {
    label: 'Quickstart',
    href: '/docs/quickstart',
    description: 'Spin up your first unified feed in minutes.',
  },
  {
    label: 'Architecture',
    href: '/docs/architecture',
    description: 'How the federated protocol layer fits together.',
  },
  {
    label: 'API Reference',
    href: '/docs/api',
    description: 'Endpoints, schemas and rate limits for developers.',
  },
  {
    label: 'Interactive API',
    href: '/api-docs',
    description: 'Try the live API directly in your browser.',
  },
  {
    label: 'FAQ',
    href: '/faq',
    description: 'Answers to the most common questions.',
  },
  {
    label: 'About',
    href: '/about',
    description: 'The mission behind the platform.',
  },
];

const SOURCE_LINKS = [
  { label: 'Forgejo', href: 'https://git.rugmunch.io/RugMunchMedia/degenfeed' },
  { label: 'GitLab', href: 'https://gitlab.com/cryptorugmuncher/degenfeed' },
  { label: 'Codeberg', href: 'https://codeberg.org/cryptorugmunch/degenfeed' },
  { label: 'Radicle', href: 'https://app.radicle.network/rad:git:z3VcKdsb7Wt4EU8oUnz5NsLWjwCyt' },
];

const PRODUCT_LINKS = [
  { label: 'Launch App', href: '/feed' },
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'User Guide', href: '/docs/user-guide' },
];

const RESOURCE_LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'Quickstart', href: '/docs/quickstart' },
  { label: 'API Reference', href: '/docs/api' },
  { label: 'Interactive API', href: '/api-docs' },
  { label: 'FAQ', href: '/faq' },
];

const COMPANY_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Developers', href: '/developers' },
  { label: 'Architecture', href: '/docs/architecture' },
];

/* ─── STATIC STYLES ─────────────────────────────────────────────────── */
/* Inline styles are allowed by the CSP (style-src 'unsafe-inline').
   No nonce needed — this is a fully static page. */

const STYLES = `
  :root {
    --bg: #000000;
    --surface: #050505;
    --surface-raised: #0a0a0a;
    --card: rgba(255, 255, 255, 0.03);
    --border: rgba(255, 255, 255, 0.08);
    --border-soft: rgba(255, 255, 255, 0.06);
    --fg: #e7e9ea;
    --fg-secondary: #9ca3af;
    --fg-tertiary: #6b7280;
    --accent: #00ff41;
    --accent-2: #00e5c0;
    --gradient: linear-gradient(100deg, #00ff41 0%, #00e5c0 100%);
    --radius-sm: 10px;
    --radius-md: 16px;
    --radius-lg: 24px;
    --font-heading: 'Space Grotesk', system-ui, sans-serif;
    --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    background:
      radial-gradient(1100px 520px at 50% -8%, rgba(0, 229, 192, 0.06), transparent 62%),
      linear-gradient(180deg, #000 0%, #040404 40%, #000 100%);
    background-attachment: fixed;
    color: var(--fg);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    line-height: 1.65;
    overflow-x: hidden;
  }
  a { color: inherit; text-decoration: none; }

  .landing { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── Keyframes ── */
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes gradient-pan {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  @keyframes glow-breathe {
    0%, 100% { opacity: 0.75; transform: translateX(-50%) scale(1); }
    50% { opacity: 1; transform: translateX(-50%) scale(1.06); }
  }
  .fade-up { animation: fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .fade-up-1 { animation-delay: 0.05s; }
  .fade-up-2 { animation-delay: 0.12s; }
  .fade-up-3 { animation-delay: 0.2s; }
  .fade-up-4 { animation-delay: 0.28s; }
  .fade-up-5 { animation-delay: 0.36s; }
  @media (prefers-reduced-motion: reduce) {
    .fade-up, .hero-glow, .hero h1 .gradient-text { animation: none; }
  }

  /* ── Header ── */
  .header {
    border-bottom: 1px solid var(--border-soft);
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    position: sticky; top: 0; z-index: 50;
  }
  .header-inner {
    max-width: 1120px; margin: 0 auto; padding: 0 24px;
    height: 68px; display: flex; align-items: center; justify-content: space-between;
  }
  .header-brand {
    display: flex; align-items: center; gap: 10px;
    font-weight: 700; font-size: 18px; letter-spacing: -0.02em;
    font-family: var(--font-heading);
  }
  .header-brand img { width: 34px; height: auto; }
  .header-cta {
    border: 1px solid var(--border); border-radius: 9999px;
    padding: 9px 20px; font-size: 14px; font-weight: 600;
    background: var(--card); backdrop-filter: blur(8px);
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .header-cta:hover {
    border-color: rgba(0, 255, 65, 0.4);
    background: rgba(0, 255, 65, 0.06);
    transform: translateY(-1px);
  }

  /* ── Hero ── */
  .hero {
    position: relative;
    padding: 96px 24px 48px; text-align: center;
    isolation: isolate;
  }
  .hero-glow {
    position: absolute; top: -260px; left: 50%;
    width: 760px; height: 680px; pointer-events: none; z-index: -1;
    background:
      radial-gradient(circle at 42% 40%, rgba(0, 255, 65, 0.09) 0%, transparent 55%),
      radial-gradient(circle at 60% 45%, rgba(0, 229, 192, 0.08) 0%, transparent 55%);
    animation: glow-breathe 9s ease-in-out infinite;
  }
  .hero-grid-overlay {
    position: absolute; inset: 0; pointer-events: none; z-index: -1; opacity: 0.5;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(680px 380px at 50% 0%, #000 0%, transparent 75%);
    -webkit-mask-image: radial-gradient(680px 380px at 50% 0%, #000 0%, transparent 75%);
  }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    border: 1px solid rgba(0, 229, 192, 0.28); border-radius: 9999px;
    background: rgba(0, 229, 192, 0.05);
    backdrop-filter: blur(8px);
    padding: 7px 16px; font-size: 12px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-2);
    margin-bottom: 32px;
  }
  .hero-badge-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--gradient); box-shadow: 0 0 10px rgba(0, 229, 192, 0.8);
  }
  .hero-lockup {
    display: flex; align-items: center; justify-content: center; gap: 14px;
    margin-bottom: 28px;
  }
  .hero-lockup img { width: 52px; height: auto; }
  .hero-lockup-word {
    font-family: var(--font-heading);
    font-size: 34px; font-weight: 700; letter-spacing: -0.03em; color: var(--fg);
  }
  .hero h1 {
    font-family: var(--font-heading);
    font-size: clamp(2.6rem, 6.4vw, 4.6rem);
    font-weight: 700; letter-spacing: -0.04em; line-height: 1.05;
    margin-bottom: 24px;
  }
  .hero h1 .gradient-text {
    background: var(--gradient);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: gradient-pan 7s ease-in-out infinite;
  }
  .hero-sub {
    font-size: clamp(1.05rem, 2.4vw, 1.25rem);
    line-height: 1.7;
    color: var(--fg-secondary); margin-bottom: 40px;
    max-width: 660px; margin-left: auto; margin-right: auto;
  }
  .hero-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 10px; min-height: 50px; padding: 0 30px;
    border-radius: 9999px; font-weight: 600; font-size: 15px;
    letter-spacing: -0.01em;
    transition: transform 0.15s, background 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .btn:hover { transform: translateY(-2px); }
  .btn-primary {
    background: var(--gradient); color: #001a0d;
    box-shadow: 0 0 0 1px rgba(0, 255, 65, 0.25), 0 8px 36px rgba(0, 229, 192, 0.22);
  }
  .btn-primary:hover {
    box-shadow: 0 0 0 1px rgba(0, 255, 65, 0.4), 0 12px 44px rgba(0, 229, 192, 0.32);
  }
  .btn-secondary {
    border: 1px solid var(--border); color: var(--fg);
    background: var(--card); backdrop-filter: blur(8px);
  }
  .btn-secondary:hover { border-color: rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.06); }

  /* ── Stat strip ── */
  .stat-strip {
    display: flex; flex-wrap: wrap; justify-content: center;
    gap: 12px 0; padding: 40px 24px 8px;
  }
  .stat {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 0 44px;
    border-left: 1px solid var(--border-soft);
  }
  .stat:first-child { border-left: none; }
  .stat-value {
    font-family: var(--font-heading);
    font-size: 26px; font-weight: 700; letter-spacing: -0.03em;
    background: var(--gradient);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
  }
  .stat-label { font-size: 13px; color: var(--fg-tertiary); letter-spacing: 0.02em; }

  /* ── Section shell ── */
  .section { padding: 88px 24px; }
  .section-inner { max-width: 1120px; margin: 0 auto; }
  .section-label {
    font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--accent-2); text-align: center; margin-bottom: 14px;
  }
  .section-title {
    font-family: var(--font-heading);
    font-size: clamp(1.7rem, 3.8vw, 2.5rem);
    font-weight: 700; letter-spacing: -0.03em; text-align: center;
    margin-bottom: 14px;
  }
  .section-sub {
    font-size: 16px; line-height: 1.7; color: var(--fg-secondary); text-align: center;
    max-width: 600px; margin: 0 auto 48px;
  }

  /* ── Protocol grid ── */
  .protocols { padding-top: 40px; }
  .protocol-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
  }
  .protocol-tile {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 18px 20px;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: var(--card);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .protocol-tile:hover {
    border-color: rgba(0, 229, 192, 0.35);
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-2px);
  }
  .protocol-dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
    box-shadow: 0 0 8px currentColor;
  }
  .protocol-tile-name {
    font-family: var(--font-heading);
    font-size: 14px; font-weight: 700; letter-spacing: -0.01em;
  }
  .protocol-tile-desc { font-size: 12.5px; color: var(--fg-tertiary); line-height: 1.5; margin-top: 2px; }

  /* ── Features ── */
  .features-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
  }
  .feature-card {
    display: flex; flex-direction: column; gap: 16px;
    padding: 30px;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: var(--card);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .feature-card:hover {
    border-color: rgba(0, 229, 192, 0.35);
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-2px);
  }
  .feature-icon {
    display: flex; align-items: center; justify-content: center;
    width: 48px; height: 48px; border-radius: 12px; color: var(--accent-2);
    background: rgba(0, 229, 192, 0.07); border: 1px solid rgba(0, 229, 192, 0.16);
  }
  .feature-card h3 {
    font-family: var(--font-heading);
    font-size: 18px; font-weight: 700; letter-spacing: -0.02em;
  }
  .feature-card p { font-size: 14px; line-height: 1.65; color: var(--fg-secondary); }

  /* ── Docs ── */
  .docs-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
    margin-bottom: 56px;
  }
  .docs-card {
    display: flex; flex-direction: column; gap: 8px;
    padding: 24px;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: var(--card);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .docs-card:hover {
    border-color: rgba(0, 229, 192, 0.35);
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-2px);
  }
  .docs-card-title {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    font-family: var(--font-heading);
    font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: var(--fg);
  }
  .docs-card-title svg { color: var(--fg-tertiary); transition: color 0.2s, transform 0.2s; }
  .docs-card:hover .docs-card-title { color: var(--accent-2); }
  .docs-card:hover .docs-card-title svg { color: var(--accent-2); transform: translateX(2px); }
  .docs-card-desc { font-size: 13px; color: var(--fg-secondary); line-height: 1.55; }

  /* ── CTA band ── */
  .cta-band {
    border: 1px solid rgba(0, 229, 192, 0.2);
    border-radius: var(--radius-lg); padding: 64px 32px; text-align: center;
    background:
      radial-gradient(560px 240px at 50% 0%, rgba(0, 229, 192, 0.09), transparent 70%),
      var(--card);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .cta-band h2 {
    font-family: var(--font-heading);
    font-size: clamp(1.6rem, 3.4vw, 2.3rem); font-weight: 700; letter-spacing: -0.03em;
    margin-bottom: 14px;
  }
  .cta-band p { font-size: 15px; line-height: 1.7; color: var(--fg-secondary); max-width: 520px; margin: 0 auto 36px; }
  .cta-band .hero-cta { margin: 0; }

  /* ── Footer ── */
  .footer { border-top: 1px solid var(--border-soft); padding: 56px 24px 32px; background: rgba(0, 0, 0, 0.6); }
  .footer-inner { max-width: 1120px; margin: 0 auto; }
  .footer-grid {
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 40px;
  }
  .footer-brand { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
  .footer-brand img { width: 32px; height: auto; }
  .footer-tagline { font-size: 14px; line-height: 1.6; color: var(--fg-secondary); max-width: 260px; }
  .footer-heading {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em;
    color: var(--fg-tertiary); margin-bottom: 14px;
  }
  .footer-col { display: flex; flex-direction: column; gap: 10px; }
  .footer-col a { font-size: 14px; color: var(--fg-secondary); transition: color 0.2s; width: fit-content; }
  .footer-col a:hover { color: var(--accent-2); }
  .footer-bottom {
    border-top: 1px solid var(--border-soft); padding-top: 24px;
    display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px;
  }
  .footer-bottom p { font-size: 12px; color: var(--fg-tertiary); }

  @media (max-width: 1024px) {
    .protocol-grid { grid-template-columns: repeat(2, 1fr); }
    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .docs-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .hero { padding: 64px 20px 32px; }
    .stat { padding: 0 24px; }
    .features-grid { grid-template-columns: 1fr; }
    .docs-grid { grid-template-columns: 1fr; }
    .footer-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 480px) {
    .protocol-grid { grid-template-columns: 1fr; }
    .stat-strip { flex-direction: column; gap: 20px; }
    .stat { border-left: none; }
    .footer-grid { grid-template-columns: 1fr; }
    .footer-bottom { flex-direction: column; align-items: flex-start; }
  }
`;

/* ─── PAGE (fully static, zero API calls) ───────────────────────────── */

export default function LandingPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
      />
      <style>{STYLES}</style>

      <div className="landing">
        {/* ── Header ── */}
        <header className="header">
          <div className="header-inner">
            <Link href="/" className="header-brand" aria-label="DegenFeed home">
              <img src="/degenfeedlogo-nav.png" alt="DegenFeed" width={34} height={34} />
              <span>DegenFeed</span>
            </Link>
            <Link href="/feed" className="header-cta">
              Launch App
            </Link>
          </div>
        </header>

        <main id="main-content">
          {/* ── Hero ── */}
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-glow" aria-hidden="true" />
            <div className="hero-grid-overlay" aria-hidden="true" />

            <div className="hero-badge fade-up">
              <span className="hero-badge-dot" aria-hidden="true" />
              20+ protocols · one feed · yours
            </div>

            <div className="hero-lockup fade-up fade-up-1">
              <img src="/degenfeedlogo-nav.png" alt="DegenFeed logo" width={52} height={52} />
              <span className="hero-lockup-word">DegenFeed</span>
            </div>

            <h1 id="hero-title" className="fade-up fade-up-2">
              All Your Feeds. <span className="gradient-text">One Platform.</span>
            </h1>

            <p className="hero-sub fade-up fade-up-3">
              DegenFeed pulls Mastodon, Bluesky, Nostr, Farcaster, Lens, Lemmy and 20+ more
              protocols into a single chronological stream — with a cross-protocol composer,
              portable identity and bias-rated crypto news. No switching accounts. No algorithm. No
              lock-in. Own your network.
            </p>

            <div className="hero-cta fade-up fade-up-4">
              <Link href="/feed" className="btn btn-primary">
                Launch App
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M4 10h12M10 4l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link href="/docs" className="btn btn-secondary">
                Read the docs
              </Link>
            </div>
          </section>

          {/* ── Stat strip ── */}
          <section className="stat-strip fade-up fade-up-5" aria-label="DegenFeed at a glance">
            <div className="stat">
              <span className="stat-value">20+</span>
              <span className="stat-label">Protocols connected</span>
            </div>
            <div className="stat">
              <span className="stat-value">1M+</span>
              <span className="stat-label">Sources indexed</span>
            </div>
            <div className="stat">
              <span className="stat-value">500K+</span>
              <span className="stat-label">Posts per day</span>
            </div>
            <div className="stat">
              <span className="stat-value">0</span>
              <span className="stat-label">Algorithms deciding for you</span>
            </div>
          </section>

          {/* ── Protocol showcase ── */}
          <section className="section protocols" aria-labelledby="protocols-title">
            <div className="section-inner">
              <p className="section-label">Supported Protocols</p>
              <h2 id="protocols-title" className="section-title">
                One feed, every network
              </h2>
              <p className="section-sub">
                Content from across the decentralized web — social graphs, blogs, video and news —
                unified in one chronological stream.
              </p>
              <div className="protocol-grid">
                {PROTOCOLS.map((p) => (
                  <div key={p.name} className="protocol-tile">
                    <span
                      className="protocol-dot"
                      style={{ background: p.color, color: p.color }}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="protocol-tile-name">{p.name}</div>
                      <div className="protocol-tile-desc">{p.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Features ── */}
          <section className="section" aria-labelledby="features-title">
            <div className="section-inner">
              <p className="section-label">What we do</p>
              <h2 id="features-title" className="section-title">
                Built different. On purpose.
              </h2>
              <p className="section-sub">
                Not another walled garden. DegenFeed is an open layer over the protocols you already
                use.
              </p>
              <div className="features-grid">
                {FEATURES.map((f) => (
                  <div key={f.title} className="feature-card">
                    <span className="feature-icon" aria-hidden="true">
                      {f.icon}
                    </span>
                    <h3>{f.title}</h3>
                    <p>{f.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Documentation ── */}
          <section className="section" aria-labelledby="docs-title">
            <div className="section-inner">
              <p className="section-label">Documentation</p>
              <h2 id="docs-title" className="section-title">
                Read the docs, ship the feed
              </h2>
              <p className="section-sub">
                Everything from the five-minute quickstart to the full API reference.
              </p>
              <div className="docs-grid">
                {DOC_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="docs-card">
                    <span className="docs-card-title">
                      {link.label}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M7 5l5 5-5 5M12 5l5 5-5 5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="docs-card-desc">{link.description}</span>
                  </Link>
                ))}
              </div>

              {/* ── CTA band ── */}
              <div className="cta-band">
                <h2>Ready to own your feed?</h2>
                <p>
                  Stop switching apps. DegenFeed brings the decentralized web to one place — free to
                  start, open source, and self-hostable.
                </p>
                <div className="hero-cta">
                  <Link href="/feed" className="btn btn-primary">
                    Launch App
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M4 10h12M10 4l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                  <Link href="/docs" className="btn btn-secondary">
                    Read the docs
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-grid">
              <div className="footer-brand">
                <img src="/degenfeedlogo-nav.png" alt="DegenFeed" width={32} height={32} />
                <p className="footer-tagline">Built on open protocols. Owned by you.</p>
              </div>
              <nav className="footer-col" aria-label="Product">
                <span className="footer-heading">Product</span>
                {PRODUCT_LINKS.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
              <nav className="footer-col" aria-label="Resources">
                <span className="footer-heading">Resources</span>
                {RESOURCE_LINKS.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
              <nav className="footer-col" aria-label="Company">
                <span className="footer-heading">Company</span>
                {COMPANY_LINKS.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
                <span className="footer-heading" style={{ marginTop: 16 }}>
                  Source Code
                </span>
                {SOURCE_LINKS.map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="footer-bottom">
              <p>&copy; 2026 Rug Munch Media LLC</p>
              <p>Open source. AGPL-3.0.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
