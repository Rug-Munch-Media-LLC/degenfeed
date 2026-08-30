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
  icon: React.ReactNode;
}

const PROTOCOLS: Protocol[] = [
  {
    name: 'Mastodon',
    color: '#6364ff',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C7.6 2 4 3.6 4 7.5v8.3c0 1.8.8 3.1 2.4 4 .8.5 2.6 1 4.8 1.1l.2-2.2c-1.4-.2-2.3-.6-2.9-1 .6.6 1.5 1.1 2.7 1.3l.4.1c2.3.3 5.4-.1 7.4-2 1.6-.9 2.4-2.2 2.4-4V7.5C20 3.6 16.4 2 12 2zm5.3 12.2l-2.6-.4c-.2 0-.4.2-.4.4l.1 1.7c0 .2-.2.4-.4.3-2.4-.7-4.4-2.6-4.6-6.1-.1-1.5.9-2.5 2.2-2.5 1.2 0 2.3.8 2.5 2 .2 1.2.2 2.8.2 2.8h3.3s0-1.6.2-2.8c.2-1.2 1.3-2 2.5-2 1.3 0 2.3 1 2.2 2.5-.2 3.5-2.2 5.4-4.6 6.1-.2.1-.4-.1-.4-.3l.1-1.7c.1-.2 0-.4-.3-.4z" />
      </svg>
    ),
  },
  {
    name: 'Bluesky',
    color: '#1185fe',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 10.5c-1.5-3-4.5-5-7-4.5-2.5.5-3.5 3-3 5 .5 2 2 3 3.5 3.5-1.5.5-3 1.5-3.5 3.5-.5 2 .5 4.5 3 5 2.5.5 5.5-1.5 7-4.5 1.5 3 4.5 5 7 4.5 2.5-.5 3.5-3 3-5-.5-2-2-3-3.5-3.5 1.5-.5 3-1.5 3.5-3.5.5-2-.5-4.5-3-5-2.5-.5-5.5 1.5-7 4.5z" />
      </svg>
    ),
  },
  {
    name: 'Nostr',
    color: '#8e30eb',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    ),
  },
  {
    name: 'Farcaster',
    color: '#8a63d2',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c2 0 3 1 3 3v5h4l2 12h-4l-1-6h-1v6h-6v-6H7l-1 6H2L4 10h4V5c0-2 1-3 3-3z" />
      </svg>
    ),
  },
  {
    name: 'Lens',
    color: '#abfe2c',
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    name: 'Lemmy',
    color: '#d4d4d4',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M7 10c1.5-2 4-3 5-3s3.5 1 5 3c-1.5 1-3 1.5-5 1.5S8.5 11 7 10z" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'Threads',
    color: '#888888',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 11.5c-1.5-1-2.6-2-2.6-3.6C9.4 6.4 10.5 5.5 12 5.5c1.3 0 2.2.6 2.6 1.8l2-.6C15.9 4.9 14.2 3.5 12 3.5c-3 0-4.9 1.9-4.9 4.5 0 2.8 1.9 4.3 5.1 6.2l-.5-.3c-1.4-1-2.3-1.9-2.7-3.1.4.2.9.4 1.6.5.4.1.9.1 1.4.2z" />
        <path d="M18.5 8.5c-.2-.1-.4-.2-.6-.3.1 1-.2 1.8-.8 2.6-.6.8-1.5 1.4-2.6 1.9 2.6.5 4.4 1.9 4.4 4.2 0 2.5-2 4.1-5.2 4.1-2.8 0-4.9-1.3-5.3-3.8l2-.3c.3 1.4 1.5 2.1 3.3 2.1 1.9 0 3.2-1 3.2-2.2 0-1.4-1.5-2.3-4.3-2.7l.3-2c1.5.1 2.5-.4 3-1.2.5-.8.6-1.9.6-2.4z" />
      </svg>
    ),
  },
  {
    name: 'Reddit',
    color: '#ff4500',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="13" r="9" />
        <circle cx="9" cy="12" r="1.6" fill="#0d0d0d" />
        <circle cx="15" cy="12" r="1.6" fill="#0d0d0d" />
        <path d="M12 15c1.8 0 3.2.8 4 2h-8c.8-1.2 2.2-2 4-2z" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'RSS',
    color: '#ffa500',
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    color: '#ff0000',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23 12s0-3.8-.5-5.6c-.3-1-1-1.7-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.4c-1 .3-1.7 1-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6c.3 1 1 1.7 2 2 1.8.4 8.5.4 8.5.4s6.7 0 8.5-.4c-1 .3-1.7 1-2 2z" />
        <path d="M10 15.5v-7l6 3.5-6 3.5z" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'PeerTube',
    color: '#f1680d',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2.5" y="4" width="19" height="16" rx="4.5" />
        <path d="M10 9l5.5 3-5.5 3V9z" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'Pixelfed',
    color: '#ff4c6a',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2.5" y="4" width="19" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="9.6" cy="10" r="1.2" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'SoundCloud',
    color: '#ff5500',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.5 10.5a4.5 4.5 0 0 0-8.66-1.6A3.75 3.75 0 0 0 9 15.5h8.5a3 3 0 0 0 0-6z" />
        <path
          d="M6.5 12.5v2M4.5 13v1M8.5 12v2.5M10.5 11.5v3"
          stroke="#0d0d0d"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: 'Substack',
    color: '#ff6719',
    icon: <span className="protocol-mono">S</span>,
  },
  {
    name: 'Medium',
    color: '#d6d6d6',
    icon: <span className="protocol-mono">M</span>,
  },
  {
    name: 'Mirror',
    color: '#a3a3a3',
    icon: <span className="protocol-mono">M</span>,
  },
  {
    name: 'WriteFreely',
    color: '#e5e5e5',
    icon: <span className="protocol-mono">W</span>,
  },
  {
    name: 'WordPress',
    color: '#21759b',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path
          d="M6.2 12.9l2.6-6.7c.4-1 .7-1.7 1.2-2.4A8 8 0 0 0 5.4 12c0 1.3.3 2.5.8 3.6v-.7zm7-5.7c.4.1.9.3 1.4.6-.6.1-1.2.3-2 .5l-1.4-.4c-.6-.2-.5-1 .1-1zm6.1 5.3c0-1.6-.6-2.8-1.1-3.8-.7-1.1-1.3-2.1-1.3-3.3 0-1.3 1-2.5 2.4-2.5a8 8 0 0 0-5.9-2.6c-3 0-5.6 1.6-7 4l.5-.1c.9-.1 1.5.6 1.5 1.5 0 .1 0 .1 0 .2-.3.8-.6 1.7-.8 2.9-.2 1.4.3 3.3 1.4 5.3.8 1.3 1.4 2.2 1.3 3.1 0 .4-.3 1.1-.6 1.6 1.3.6 2.8.9 4.3.9 3 0 5.7-1.3 7.5-3.4l-1.1-.3c-.4-.1-.5-.7-.1-.9.5-.3 1.5-.4 2.3-.5-.4-.2-.7-.4-.9-.7zM12.3 12l2.2 6.1c.1.4-.2.7-.6.7h-.3c.9 1.6 2.4 2.8 4.2 3.3a7.8 7.8 0 0 0 3.5-5.4 8 8 0 0 0 .5-2.6c-1.9 1-3.6 1.5-5.2 1.5-2.4 0-3.9-.9-4.3-3.6zm-2.3 5.6l-1.5-4.5c-.5-1.6-.5-2.5-.5-2.5l-2.9 7.5c.5.9 1.2 1.7 2 2.4.4-.7.9-1.5 1.4-2.4.3-.5.7-.8 1.5-.5z"
          fill="#0d0d0d"
        />
      </svg>
    ),
  },
  {
    name: 'BookWyrm',
    color: '#2bb673',
    icon: (
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 6.5C10 4.8 7.2 4 4.5 4v13c2.7 0 5.5.8 7.5 2.5 2-1.7 4.8-2.5 7.5-2.5V4c-2.7 0-5.5.8-7.5 2.5z" />
        <path d="M12 6.5v13" />
      </svg>
    ),
  },
  {
    name: 'Polymarket',
    color: '#2172e5',
    icon: <span className="protocol-mono">P</span>,
  },
  {
    name: 'Snapshot',
    color: '#7c3aed',
    icon: <span className="protocol-mono">S</span>,
  },
];

/* ─── FEATURES (static grid) ────────────────────────────────────────── */

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FEATURES: Feature[] = [
  {
    title: 'Unified Feed',
    description:
      'Mastodon, Bluesky, Nostr, Farcaster, Lens, Lemmy, RSS and more — merged into one chronological stream. No switching accounts, no missed posts.',
    icon: (
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
      </svg>
    ),
  },
  {
    title: 'Decentralized Identity',
    description:
      'One portable identity that lives on the open protocols — not in a corporate database. Your handle, your keys, your reputation. Everywhere.',
    icon: (
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
  {
    title: 'Network Ownership',
    description:
      'Your follows, your graph, your data — yours. Exportable, portable and self-hostable. No algorithm farm harvesting your attention.',
    icon: (
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l2.7 5.6 6.3.9-4.5 4.4 1 6.1L12 17.8l-5.5 3 1-6.1L3 9.5l6.3-.9z" />
      </svg>
    ),
  },
  {
    title: 'Tipping & Creator Coins',
    description:
      'Send sats, tips and creator coins straight to the people you follow — peer-to-peer, on-chain, with zero platform cut. Fund the feeds you love.',
    icon: (
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2.2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5" />
      </svg>
    ),
  },
];

/* ─── DOCS & LINKS (static) ─────────────────────────────────────────── */

interface DocLink {
  label: string;
  href: string;
  description: string;
  group: string;
}

const DOC_LINKS: DocLink[] = [
  {
    label: 'Docs Home',
    href: '/docs',
    description: 'Everything you need to get started with DegenFeed.',
    group: 'Get Started',
  },
  {
    label: 'Quickstart',
    href: '/docs/quickstart',
    description: 'Spin up your first unified feed in minutes.',
    group: 'Get Started',
  },
  {
    label: 'Architecture',
    href: '/docs/architecture',
    description: 'How the federated protocol layer fits together.',
    group: 'Get Started',
  },
  {
    label: 'API Reference',
    href: '/docs/api',
    description: 'Endpoints, schemas and rate limits for developers.',
    group: 'Developers',
  },
  {
    label: 'Interactive API',
    href: '/api-docs',
    description: 'Try the live API directly in your browser.',
    group: 'Developers',
  },
  {
    label: 'User Guide',
    href: '/docs/user-guide',
    description: 'Feeds, composer, identity and tipping in depth.',
    group: 'Learn',
  },
  {
    label: 'Features',
    href: '/features',
    description: 'A tour of everything DegenFeed can do.',
    group: 'Learn',
  },
  {
    label: 'Pricing',
    href: '/pricing',
    description: 'Free by default. Self-hostable. No lock-in.',
    group: 'Learn',
  },
  {
    label: 'FAQ',
    href: '/faq',
    description: 'Answers to the most common questions.',
    group: 'Learn',
  },
  {
    label: 'About',
    href: '/about',
    description: 'The mission behind the platform.',
    group: 'Learn',
  },
  {
    label: 'Developers',
    href: '/developers',
    description: 'Build on DegenFeed with our open APIs.',
    group: 'Developers',
  },
];

const DOC_GROUPS = ['Get Started', 'Developers', 'Learn'] as const;

const SOURCE_LINKS = [
  { label: 'Forgejo', href: 'https://git.rugmunch.io/RugMunchMedia/degenfeed' },
  { label: 'GitLab', href: 'https://gitlab.com/cryptorugmuncher/degenfeed' },
  { label: 'Codeberg', href: 'https://codeberg.org/cryptorugmunch/degenfeed' },
  { label: 'Radicle', href: 'https://app.radicle.network/rad:git:z3VcKdsb7Wt4EU8oUnz5NsLWjwCyt' },
];

const PAGE_LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'FAQ', href: '/faq' },
  { label: 'About', href: '/about' },
  { label: 'Pricing', href: '/pricing' },
];

/* ─── STATIC STYLES ─────────────────────────────────────────────────── */
/* Inline styles are allowed by the CSP (style-src 'unsafe-inline').
   No nonce needed — this is a fully static page. */

const STYLES = `
  :root {
    --bg: #000000;
    --surface: #050505;
    --surface-raised: #0a0a0a;
    --card: #0d0d0d;
    --border: #1c1c1c;
    --border-soft: #141414;
    --fg: #e7e9ea;
    --fg-secondary: #9ca3af;
    --fg-tertiary: #6b7280;
    --accent: #00ff41;
    --accent-dim: #00cc34;
    --accent-glow: rgba(0, 255, 65, 0.12);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    background:
      radial-gradient(1100px 520px at 50% -8%, rgba(0, 255, 65, 0.07), transparent 62%),
      linear-gradient(180deg, #000 0%, #040404 40%, #000 100%);
    background-attachment: fixed;
    color: var(--fg);
    font-family: var(--font-body, 'Plus Jakarta Sans', Inter, system-ui, -apple-system, sans-serif);
    -webkit-font-smoothing: antialiased;
    line-height: 1.5;
    overflow-x: hidden;
  }
  a { color: inherit; text-decoration: none; }

  .landing { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── Header ── */
  .header {
    border-bottom: 1px solid var(--border-soft);
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(16px);
    position: sticky; top: 0; z-index: 50;
  }
  .header-inner {
    max-width: 1100px; margin: 0 auto; padding: 0 20px;
    height: 64px; display: flex; align-items: center; justify-content: space-between;
  }
  .header-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; font-family: var(--font-heading, Syne, sans-serif); }
  .header-brand img { width: 36px; height: auto; }
  .header-cta {
    border: 1px solid var(--border); border-radius: 9999px;
    padding: 8px 18px; font-size: 14px; font-weight: 700;
    transition: border-color 0.2s, background 0.2s;
  }
  .header-cta:hover { border-color: var(--accent); background: rgba(0, 255, 65, 0.06); }

  /* ── Hero ── */
  .hero {
    position: relative;
    padding: 72px 20px 40px; text-align: center;
    isolation: isolate;
  }
  .hero-glow {
    position: absolute; top: -220px; left: 50%; transform: translateX(-50%);
    width: 640px; height: 640px; pointer-events: none; z-index: -1;
    background: radial-gradient(circle, rgba(0, 255, 65, 0.08) 0%, transparent 62%);
  }
  .hero-grid-overlay {
    position: absolute; inset: 0; pointer-events: none; z-index: -1; opacity: 0.5;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(640px 360px at 50% 0%, #000 0%, transparent 75%);
    -webkit-mask-image: radial-gradient(640px 360px at 50% 0%, #000 0%, transparent 75%);
  }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    border: 1px solid rgba(0, 255, 65, 0.25); border-radius: 9999px;
    background: rgba(0, 255, 65, 0.06);
    padding: 6px 14px; font-size: 12px; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent);
    margin-bottom: 28px;
  }
  .hero-badge-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--accent); box-shadow: 0 0 10px var(--accent);
  }
  .hero-lockup {
    display: flex; align-items: center; justify-content: center; gap: 14px;
    margin-bottom: 24px;
  }
  .hero-lockup img { width: 52px; height: auto; }
  .hero-lockup-word {
    font-family: var(--font-heading, Syne, sans-serif);
    font-size: 34px; font-weight: 800; letter-spacing: -0.02em; color: var(--fg);
  }
  .hero h1 {
    font-family: var(--font-heading, Syne, sans-serif);
    font-size: clamp(2.4rem, 6vw, 4.2rem);
    font-weight: 800; letter-spacing: -0.03em; line-height: 1.08;
    margin-bottom: 20px;
  }
  .hero h1 .accent { color: var(--accent); }
  .hero-sub {
    font-size: clamp(1.05rem, 2.4vw, 1.3rem);
    color: var(--fg-secondary); margin-bottom: 36px;
    max-width: 680px; margin-left: auto; margin-right: auto;
  }
  .hero-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 10px; min-height: 48px; padding: 0 28px;
    border-radius: 9999px; font-weight: 700; font-size: 15px;
    transition: transform 0.15s, background 0.2s, border-color 0.2s;
  }
  .btn:hover { transform: translateY(-1px); }
  .btn-primary { background: var(--accent); color: #000; box-shadow: 0 0 0 1px rgba(0, 255, 65, 0.3), 0 8px 32px rgba(0, 255, 65, 0.18); }
  .btn-primary:hover { background: var(--accent-dim); }
  .btn-secondary { border: 1px solid var(--border); color: var(--fg); }
  .btn-secondary:hover { border-color: var(--fg-secondary); background: var(--surface-raised); }

  /* ── Stat strip ── */
  .stat-strip {
    display: flex; flex-wrap: wrap; justify-content: center;
    gap: 10px 44px; padding: 28px 20px 8px;
    font-size: 13px; color: var(--fg-tertiary);
  }
  .stat-strip strong { color: var(--fg); font-family: var(--font-heading, Syne, sans-serif); font-size: 15px; }

  /* ── Section shell ── */
  .section { padding: 72px 20px; }
  .section-inner { max-width: 1080px; margin: 0 auto; }
  .section-label {
    font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--accent); text-align: center; margin-bottom: 12px;
  }
  .section-title {
    font-family: var(--font-heading, Syne, sans-serif);
    font-size: clamp(1.6rem, 3.6vw, 2.4rem);
    font-weight: 800; letter-spacing: -0.02em; text-align: center;
    margin-bottom: 12px;
  }
  .section-sub {
    font-size: 16px; color: var(--fg-secondary); text-align: center;
    max-width: 600px; margin: 0 auto 40px;
  }

  /* ── Protocol grid ── */
  .protocols { padding-top: 32px; }
  .protocol-grid {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  }
  .protocol-tile {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 18px 10px 16px; border: 1px solid var(--border); border-radius: 14px;
    background: var(--card); transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .protocol-tile:hover { border-color: rgba(0, 255, 65, 0.35); background: var(--surface-raised); transform: translateY(-1px); }
  .protocol-tile-icon {
    display: flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
  }
  .protocol-mono {
    font-family: var(--font-heading, Syne, sans-serif);
    font-size: 18px; font-weight: 800; line-height: 1; letter-spacing: -0.02em;
  }
  .protocol-tile-name { font-size: 13px; font-weight: 700; text-align: center; }

  /* ── Features ── */
  .features-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
  }
  .feature-card {
    display: flex; flex-direction: column; gap: 14px;
    padding: 28px; border: 1px solid var(--border); border-radius: 16px;
    background: var(--card); transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .feature-card:hover { border-color: rgba(0, 255, 65, 0.35); background: var(--surface-raised); transform: translateY(-1px); }
  .feature-icon {
    display: flex; align-items: center; justify-content: center;
    width: 48px; height: 48px; border-radius: 12px; color: var(--accent);
    background: rgba(0, 255, 65, 0.08); border: 1px solid rgba(0, 255, 65, 0.18);
  }
  .feature-card h3 {
    font-family: var(--font-heading, Syne, sans-serif);
    font-size: 18px; font-weight: 800; letter-spacing: -0.01em;
  }
  .feature-card p { font-size: 14px; color: var(--fg-secondary); }

  /* ── Docs ── */
  .docs-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
    margin-bottom: 48px;
  }
  .docs-group-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--fg-tertiary); margin: 0 2px 10px;
  }
  .docs-card {
    display: flex; flex-direction: column; gap: 6px;
    padding: 20px; border: 1px solid var(--border); border-radius: 14px;
    background: var(--card); transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .docs-card:hover { border-color: rgba(0, 255, 65, 0.35); background: var(--surface-raised); transform: translateY(-1px); }
  .docs-card-title {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    font-family: var(--font-heading, Syne, sans-serif);
    font-size: 15px; font-weight: 800; letter-spacing: -0.01em; color: var(--fg);
  }
  .docs-card:hover .docs-card-title { color: var(--accent); }
  .docs-card-desc { font-size: 13px; color: var(--fg-secondary); line-height: 1.45; }

  /* ── CTA band ── */
  .cta-band {
    border: 1px solid rgba(0, 255, 65, 0.22);
    border-radius: 24px; padding: 56px 28px; text-align: center;
    background:
      radial-gradient(560px 240px at 50% 0%, rgba(0, 255, 65, 0.1), transparent 70%),
      var(--card);
  }
  .cta-band h2 {
    font-family: var(--font-heading, Syne, sans-serif);
    font-size: clamp(1.5rem, 3.2vw, 2.2rem); font-weight: 800; letter-spacing: -0.02em;
    margin-bottom: 12px;
  }
  .cta-band p { font-size: 15px; color: var(--fg-secondary); max-width: 520px; margin: 0 auto 32px; }
  .cta-band .hero-cta { margin: 0; }

  /* ── Footer ── */
  .footer { border-top: 1px solid var(--border-soft); padding: 40px 20px 28px; background: rgba(0, 0, 0, 0.6); }
  .footer-inner { max-width: 1080px; margin: 0 auto; }
  .footer-grid {
    display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 32px; margin-bottom: 28px;
  }
  .footer-brand { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
  .footer-brand img { width: 32px; height: auto; }
  .footer-tagline { font-size: 14px; color: var(--fg-secondary); max-width: 260px; }
  .footer-heading {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--fg-tertiary); margin-bottom: 12px;
  }
  .footer-col { display: flex; flex-direction: column; gap: 8px; }
  .footer-col a { font-size: 14px; color: var(--fg-secondary); transition: color 0.2s; width: fit-content; }
  .footer-col a:hover { color: var(--accent); }
  .footer-bottom {
    border-top: 1px solid var(--border-soft); padding-top: 20px;
    display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px;
  }
  .footer-bottom p { font-size: 12px; color: var(--fg-tertiary); }

  @media (max-width: 1024px) {
    .protocol-grid { grid-template-columns: repeat(4, 1fr); }
    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .docs-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .hero { padding: 56px 20px 32px; }
    .protocol-grid { grid-template-columns: repeat(3, 1fr); }
    .features-grid { grid-template-columns: 1fr; }
    .docs-grid { grid-template-columns: 1fr; }
    .footer-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 480px) {
    .protocol-grid { grid-template-columns: repeat(2, 1fr); }
    .footer-grid { grid-template-columns: 1fr; }
    .footer-bottom { flex-direction: column; align-items: flex-start; }
  }
`;

/* ─── PAGE (fully static, zero API calls) ───────────────────────────── */

export default function LandingPage() {
  return (
    <>
      <style>{STYLES}</style>

      <div className="landing">
        {/* ── Header ── */}
        <header className="header">
          <div className="header-inner">
            <Link href="/" className="header-brand" aria-label="DegenFeed home">
              <img src="/degenfeedlogo-nav.png" alt="DegenFeed" width={36} height={36} />
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

            <div className="hero-badge">
              <span className="hero-badge-dot" aria-hidden="true" />
              20+ protocols · one feed · yours
            </div>

            <div className="hero-lockup">
              <img src="/degenfeedlogo-nav.png" alt="DegenFeed logo" width={52} height={52} />
              <span className="hero-lockup-word">DegenFeed</span>
            </div>

            <h1 id="hero-title">
              All Your Feeds. <span className="accent">One Platform.</span>
            </h1>

            <p className="hero-sub">
              DegenFeed pulls Mastodon, Bluesky, Nostr, Farcaster, Lens, Lemmy and 20+ more
              protocols into a single chronological stream — with a cross-protocol composer,
              portable identity and bias-rated crypto news. No switching accounts. No algorithm. No
              lock-in. Own your network.
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
          </section>

          {/* ── Stat strip ── */}
          <section className="stat-strip" aria-label="DegenFeed at a glance">
            <span>
              <strong>20+</strong> protocols
            </span>
            <span>
              <strong>0</strong> algorithms
            </span>
            <span>
              <strong>100%</strong> your network
            </span>
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
                      className="protocol-tile-icon"
                      style={{ background: `${p.color}1f`, color: p.color }}
                    >
                      {p.icon}
                    </span>
                    <div className="protocol-tile-name">{p.name}</div>
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
                {DOC_GROUPS.map((group) => (
                  <div key={group} className="docs-group">
                    <h3 className="docs-group-title">{group}</h3>
                    {DOC_LINKS.filter((link) => link.group === group).map((link) => (
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
              <nav className="footer-col" aria-label="Source code">
                <span className="footer-heading">Source Code</span>
                {SOURCE_LINKS.map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                ))}
              </nav>
              <nav className="footer-col" aria-label="Resources">
                <span className="footer-heading">Resources</span>
                {PAGE_LINKS.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
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
