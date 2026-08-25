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
    color: '#f2690d',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M7 10c1.5-2 4-3 5-3s3.5 1 5 3c-1.5 1-3 1.5-5 1.5S8.5 11 7 10z" fill="#0d0d0d" />
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
    title: 'One Feed, All Protocols',
    description: 'Browse content from every major decentralized protocol',
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
    title: 'Network Ownership',
    description: 'Your identity belongs to you on every protocol',
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
    title: 'Open Source',
    description: 'Fully open source. Self-hostable. No vendor lock-in.',
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
        <path d="M8 8l-4 4 4 4" />
        <path d="M16 8l4 4-4 4" />
        <path d="M13.5 5l-3 14" />
      </svg>
    ),
  },
  {
    title: 'No Algorithms',
    description: 'Chronological feeds. No engagement optimization. Just content.',
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
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
];

/* ─── FOOTER LINKS (static) ─────────────────────────────────────────── */

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
      radial-gradient(800px 500px at 85% 12%, rgba(0, 255, 65, 0.04), transparent 55%),
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
    position: relative; overflow: hidden;
    padding: 88px 20px 64px; text-align: center;
  }
  .hero-glow {
    position: absolute; top: -30%; left: 50%; transform: translateX(-50%);
    width: 820px; height: 820px; pointer-events: none;
    background: radial-gradient(circle, var(--accent-glow) 0%, transparent 65%);
  }
  .hero-logo { margin-bottom: 32px; position: relative; }
  .hero-logo img { max-width: min(400px, 80vw); height: auto; }
  .hero h1 {
    font-family: var(--font-heading, Syne, sans-serif);
    font-size: clamp(2.4rem, 6vw, 4.2rem);
    font-weight: 800; letter-spacing: -0.03em; line-height: 1.1;
    margin-bottom: 20px;
  }
  .hero h1 .accent { color: var(--accent); }
  .hero-sub {
    font-size: clamp(1.05rem, 2.4vw, 1.35rem);
    color: var(--fg-secondary); margin-bottom: 40px;
    max-width: 640px; margin-left: auto; margin-right: auto;
  }
  .hero-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 10px; min-height: 48px; padding: 0 28px;
    border-radius: 9999px; font-weight: 700; font-size: 15px;
    transition: transform 0.15s, background 0.2s, border-color 0.2s;
  }
  .btn:hover { transform: translateY(-1px); }
  .btn-primary { background: var(--accent); color: #000; }
  .btn-primary:hover { background: var(--accent-dim); }
  .btn-secondary { border: 1px solid var(--border); color: var(--fg); }
  .btn-secondary:hover { border-color: var(--fg-secondary); background: var(--surface-raised); }

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
    max-width: 560px; margin: 0 auto 40px;
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
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
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
  .feature-card p { font-size: 15px; color: var(--fg-secondary); }

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
  }
  @media (max-width: 768px) {
    .hero { padding: 64px 20px 48px; }
    .protocol-grid { grid-template-columns: repeat(3, 1fr); }
    .features-grid { grid-template-columns: 1fr; }
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

            <div className="hero-logo">
              <img src="/degenfeedlogo.png" alt="DegenFeed" width={400} height={251} />
            </div>

            <h1 id="hero-title">
              All Your Feeds. <span className="accent">One Platform.</span>
            </h1>

            <p className="hero-sub">
              20+ decentralized protocols. One feed. No switching accounts. Own your network.
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
                Learn More
              </Link>
            </div>
          </section>

          {/* ── Protocol showcase ── */}
          <section className="section protocols" aria-labelledby="protocols-title">
            <div className="section-inner">
              <p className="section-label">Supported Protocols</p>
              <h2 id="protocols-title" className="section-title">
                One feed, every network
              </h2>
              <p className="section-sub">Content from across the decentralized web</p>
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
              <p className="section-label">Why DegenFeed</p>
              <h2 id="features-title" className="section-title">
                Built different. On purpose.
              </h2>
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
