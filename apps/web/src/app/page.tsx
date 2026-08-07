import type { Metadata } from 'next';
import Link from 'next/link';

/* ─── SEO ────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'DegenFeed — All Your Feeds. One Platform.',
  description:
    'DegenFeed aggregates 20+ protocols into one feed: Mastodon, Bluesky, Nostr, Farcaster, Lens, Lemmy, Reddit, YouTube and more. No switching accounts.',
  alternates: {
    canonical: 'https://degenfeed.xyz',
  },
  openGraph: {
    title: 'DegenFeed — All Your Feeds. One Platform.',
    description: '20+ protocols. One feed. No switching accounts.',
    url: 'https://degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — All Your Feeds. One Platform.',
    description: '20+ protocols. One feed. No switching accounts.',
    creator: '@degenfeed',
  },
};

/* ─── PROTOCOLS (static grid) ───────────────────────────────────────── */

interface Protocol {
  name: string;
  color: string;
  tag: string;
  icon: React.ReactNode;
}

const PROTOCOLS: Protocol[] = [
  {
    name: 'Mastodon',
    color: '#6364ff',
    tag: 'ActivityPub',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C7.6 2 4 3.6 4 7.5v8.3c0 1.8.8 3.1 2.4 4 .8.5 2.6 1 4.8 1.1l.2-2.2c-1.4-.2-2.3-.6-2.9-1 .6.6 1.5 1.1 2.7 1.3l.4.1c2.3.3 5.4-.1 7.4-2 1.6-.9 2.4-2.2 2.4-4V7.5C20 3.6 16.4 2 12 2zm5.3 12.2l-2.6-.4c-.2 0-.4.2-.4.4l.1 1.7c0 .2-.2.4-.4.3-2.4-.7-4.4-2.6-4.6-6.1-.1-1.5.9-2.5 2.2-2.5 1.2 0 2.3.8 2.5 2 .2 1.2.2 2.8.2 2.8h3.3s0-1.6.2-2.8c.2-1.2 1.3-2 2.5-2 1.3 0 2.3 1 2.2 2.5-.2 3.5-2.2 5.4-4.6 6.1-.2.1-.4-.1-.4-.3l.1-1.7c.1-.2 0-.4-.3-.4z" />
      </svg>
    ),
  },
  {
    name: 'Bluesky',
    color: '#1185fe',
    tag: 'AT Protocol',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 10.5c-1.5-3-4.5-5-7-4.5-2.5.5-3.5 3-3 5 .5 2 2 3 3.5 3.5-1.5.5-3 1.5-3.5 3.5-.5 2 .5 4.5 3 5 2.5.5 5.5-1.5 7-4.5 1.5 3 4.5 5 7 4.5 2.5-.5 3.5-3 3-5-.5-2-2-3-3.5-3.5 1.5-.5 3-1.5 3.5-3.5.5-2-.5-4.5-3-5-2.5-.5-5.5 1.5-7 4.5z" />
      </svg>
    ),
  },
  {
    name: 'Nostr',
    color: '#8e30eb',
    tag: 'Protocol',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    ),
  },
  {
    name: 'Farcaster',
    color: '#8a63d2',
    tag: 'Protocol',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c2 0 3 1 3 3v5h4l2 12h-4l-1-6h-1v6h-6v-6H7l-1 6H2L4 10h4V5c0-2 1-3 3-3z" />
      </svg>
    ),
  },
  {
    name: 'Lens',
    color: '#abfe2c',
    tag: 'Protocol',
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
    tag: 'Community',
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
    tag: 'Read-only',
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
    tag: 'Video',
    icon: (
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23 12s0-3.8-.5-5.6c-.3-1-1-1.7-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.4c-1 .3-1.7 1-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6c.3 1 1 1.7 2 2 1.8.4 8.5.4 8.5.4s6.7 0 8.5-.4c-1 .3-1.7 1-2 2z" />
        <path d="M10 15.5v-7l6 3.5-6 3.5z" fill="#0d0d0d" />
      </svg>
    ),
  },
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
    background: var(--bg);
    color: var(--fg);
    font-family: 'Plus Jakarta Sans', Inter, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    line-height: 1.5;
    overflow-x: hidden;
  }
  a { color: inherit; text-decoration: none; }

  .landing { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── Header ── */
  .header {
    border-bottom: 1px solid var(--border-soft);
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(16px);
    position: sticky; top: 0; z-index: 50;
  }
  .header-inner {
    max-width: 1100px; margin: 0 auto; padding: 0 20px;
    height: 64px; display: flex; align-items: center; justify-content: space-between;
  }
  .header-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; }
  .header-brand img { width: 36px; height: auto; }
  .header-cta {
    border: 1px solid var(--border); border-radius: 9999px;
    padding: 8px 18px; font-size: 14px; font-weight: 700;
    transition: border-color 0.2s, background 0.2s;
  }
  .header-cta:hover { border-color: var(--accent); background: var(--accent-subtle, rgba(0,255,65,0.06)); }

  /* ── Hero ── */
  .hero {
    position: relative; overflow: hidden;
    padding: 96px 20px 72px; text-align: center;
  }
  .hero-glow {
    position: absolute; top: -30%; left: 50%; transform: translateX(-50%);
    width: 800px; height: 800px; pointer-events: none;
    background: radial-gradient(circle, var(--accent-glow) 0%, transparent 65%);
  }
  .hero-logo { margin-bottom: 32px; }
  .hero-logo img { max-width: min(400px, 80vw); height: auto; }
  .hero h1 {
    font-size: clamp(2.4rem, 6vw, 4.2rem);
    font-weight: 800; letter-spacing: -0.03em; line-height: 1.1;
    margin-bottom: 20px;
  }
  .hero h1 .accent { color: var(--accent); }
  .hero-sub {
    font-size: clamp(1.05rem, 2.4vw, 1.35rem);
    color: var(--fg-secondary); margin-bottom: 40px;
  }
  .hero-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-bottom: 72px; }
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

  /* ── Protocol grid ── */
  .protocols { padding: 0 20px 96px; }
  .protocols-inner { max-width: 880px; margin: 0 auto; }
  .protocols-label {
    font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--fg-tertiary); text-align: center; margin-bottom: 24px;
  }
  .protocol-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  }
  .protocol-tile {
    display: flex; align-items: center; gap: 12px;
    padding: 16px; border: 1px solid var(--border); border-radius: 12px;
    background: var(--card); transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }
  .protocol-tile:hover { border-color: var(--fg-tertiary); background: var(--surface-raised); transform: translateY(-1px); }
  .protocol-tile-icon {
    display: flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  }
  .protocol-tile-name { font-size: 14px; font-weight: 700; }
  .protocol-tile-tag { font-size: 11px; color: var(--fg-tertiary); }
  .protocols-more { text-align: center; margin-top: 24px; font-size: 13px; color: var(--fg-tertiary); }

  /* ── Footer ── */
  .footer { border-top: 1px solid var(--border-soft); padding: 32px 20px; }
  .footer-inner { max-width: 1100px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
  .footer p { font-size: 12px; color: var(--fg-tertiary); }
  .footer a { font-size: 13px; color: var(--fg-tertiary); transition: color 0.2s; }
  .footer a:hover { color: var(--accent); }

  @media (max-width: 768px) {
    .protocol-grid { grid-template-columns: repeat(2, 1fr); }
    .hero { padding: 72px 20px 56px; }
  }
  @media (max-width: 480px) {
    .protocol-grid { grid-template-columns: 1fr; }
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

            <p className="hero-sub">20+ protocols. One feed. No switching accounts.</p>

            <div className="hero-cta">
              <Link href="/feed" className="btn btn-primary">
                Get Started
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
              <Link href="/feed" className="btn btn-secondary">
                Explore
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
            </div>
          </section>

          {/* ── Protocol grid ── */}
          <section className="protocols" aria-labelledby="protocols-title">
            <div className="protocols-inner">
              <p id="protocols-title" className="protocols-label">
                One feed for every protocol
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
                    <div>
                      <div className="protocol-tile-name">{p.name}</div>
                      <div className="protocol-tile-tag">{p.tag}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="protocols-more">
                20+ protocols and growing — every feed is live, browsable, and free.
              </p>
            </div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="footer">
          <div className="footer-inner">
            <p>
              &copy; {new Date().getFullYear()} DegenFeed &mdash; a Rug Munch Media LLC product.
              Open source (AGPL-3.0).
            </p>
            <Link href="/feed">Explore Feeds</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
