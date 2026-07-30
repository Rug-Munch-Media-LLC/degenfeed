import Link from 'next/link';
import type { ReactNode } from 'react';

/* ─── LOGO (inlined from public/icon.svg) ─────────────────────────────── */

const LOGO_SVG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width="36"
    height="36"
    role="img"
    aria-label="DegenFeed logo"
  >
    <defs>
      <linearGradient id="lgb" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0d0d0d" />
        <stop offset="100%" stopColor="#000000" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#lgb)" rx={96} />
    <g stroke="#00ff41" strokeWidth={52} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1={160} y1={92} x2={160} y2={420} />
      <path d="M 160 92 A 148 164 0 0 1 160 420" />
    </g>
    <rect x={350} y={352} width={28} height={28} fill="#00ff41" rx={4}>
      <animate attributeName="opacity" values="1;0.08;1" dur="1s" repeatCount="indefinite" />
    </rect>
    <circle cx={230} cy={256} r={100} fill="#00ff41" opacity={0.06} />
  </svg>
);

/* ─── THEME INLINE STYLES ─────────────────────────────────────────────── */

const THEME_STYLES = `
  :root {
    --bg: #000000;
    --surface: #070707;
    --surface-raised: #0a0a0a;
    --card: #0d0d0d;
    --border: #1a1a1a;
    --border-soft: #141414;
    --fg: #e7e9ea;
    --fg-secondary: #a0a0a0;
    --fg-tertiary: #606060;
    --accent: #00ff41;
    --accent-dim: #00cc34;
    --accent-subtle: rgba(0, 255, 65, 0.06);
    --accent-glow: rgba(0, 255, 65, 0.12);
    --accent-soft: rgba(0, 255, 65, 0.04);
    --gradient-text: linear-gradient(135deg, #00ff41, #00ccff);
    --font-body: 'Plus Jakarta Sans', Inter, system-ui, -apple-system, sans-serif;
    --font-heading: 'Syne', 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html { scroll-behavior: smooth; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.6;
    overflow-x: hidden;
  }

  a { color: inherit; text-decoration: none; }

  ::selection { background: var(--accent); color: #000; }

  /* ── Skip link ── */
  .skip-link {
    position: absolute;
    top: -100%;
    left: 0;
    z-index: 9999;
    padding: 8px 16px;
    background: var(--accent);
    color: #000;
    font-weight: 700;
    font-size: 14px;
    border-radius: 0 0 8px 0;
    transition: top 0.15s;
  }
  .skip-link:focus { top: 0; }

  /* ── Scanline overlay ── */
  .scanline {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9998;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.03) 2px,
      rgba(0, 0, 0, 0.03) 4px
    );
  }

  /* ── Reduced motion ── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* ── Header ── */
  .header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }
  .header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 20px;
    color: var(--fg);
  }
  .header-brand svg { flex-shrink: 0; }
  .header-nav { display: flex; align-items: center; gap: 24px; }
  .header-nav a {
    font-size: 14px;
    font-weight: 500;
    color: var(--fg-secondary);
    transition: color 0.2s;
  }
  .header-nav a:hover { color: var(--fg); }
  .header-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    background: var(--accent);
    color: #000 !important;
    font-weight: 700;
    font-size: 14px;
    border-radius: 9999px;
    transition: all 0.2s;
  }
  .header-cta:hover {
    background: var(--accent-dim);
    transform: translateY(-1px);
    box-shadow: 0 0 20px var(--accent-glow);
  }
  .header-mobile-cta {
    display: none;
  }

  @media (max-width: 768px) {
    .header-nav a:not(.header-cta) { display: none; }
    .header-cta { display: none; }
    .header-mobile-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      background: var(--accent);
      color: #000 !important;
      font-weight: 700;
      font-size: 13px;
      border-radius: 9999px;
      width: 36px;
      height: 36px;
    }
  }

  /* ── Hero ── */
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 120px 20px 80px;
    overflow: hidden;
  }
  .hero-glow {
    position: absolute;
    top: 20%;
    left: 50%;
    width: 800px;
    height: 800px;
    transform: translateX(-50%);
    background: radial-gradient(circle, var(--accent-glow) 0%, transparent 60%);
    pointer-events: none;
    animation: glow-float 10s ease-in-out infinite alternate;
  }
  @keyframes glow-float {
    0% { opacity: 0.3; transform: translateX(-50%) translateY(0) scale(1); }
    100% { opacity: 0.7; transform: translateX(-50%) translateY(-24px) scale(1.06); }
  }
  .hero-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(0, 255, 65, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 255, 65, 0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    pointer-events: none;
  }
  .hero-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-bottom: 32px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-mono);
    letter-spacing: 0.02em;
  }
  .badge-green {
    background: var(--accent-subtle);
    color: var(--accent);
    border: 1px solid rgba(0, 255, 65, 0.2);
  }
  .badge-green::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .badge-outline {
    border: 1px solid var(--border);
    color: var(--fg-secondary);
  }
  .hero-title {
    position: relative;
    z-index: 1;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: clamp(2.8rem, 8vw, 5rem);
    line-height: 1.08;
    letter-spacing: -0.03em;
    margin-bottom: 20px;
  }
  .hero-title .accent {
    background: var(--gradient-text);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .hero-sub {
    position: relative;
    z-index: 1;
    font-size: clamp(1rem, 2.2vw, 1.25rem);
    color: var(--fg-secondary);
    max-width: 640px;
    margin: 0 auto 36px;
    line-height: 1.7;
  }
  .hero-cta {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    border-radius: 9999px;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 16px;
    transition: all 0.25s;
    cursor: pointer;
    border: none;
  }
  .btn-primary {
    background: var(--accent);
    color: #000;
  }
  .btn-primary:hover {
    background: var(--accent-dim);
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(0, 255, 65, 0.25);
  }
  .btn-secondary {
    background: transparent;
    color: var(--fg);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover {
    border-color: var(--fg-secondary);
    background: var(--surface-raised);
    transform: translateY(-2px);
  }
  .btn-arrow {
    transition: transform 0.2s;
  }
  .btn:hover .btn-arrow {
    transform: translateX(3px);
  }

  /* ── Stats bar ── */
  .stats-bar {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0;
    margin-top: 56px;
    padding: 24px 40px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--card);
    max-width: 780px;
    width: 100%;
  }
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 24px;
    min-width: 120px;
  }
  .stat-value {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 28px;
    color: var(--accent);
    letter-spacing: -0.02em;
  }
  .stat-label {
    font-size: 12px;
    color: var(--fg-tertiary);
    margin-top: 2px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .stat-divider {
    width: 1px;
    background: var(--border);
    align-self: stretch;
    margin: 4px 0;
  }

  @media (max-width: 640px) {
    .stats-bar { padding: 16px; gap: 8px; }
    .stat-item { min-width: 80px; padding: 6px 12px; }
    .stat-value { font-size: 22px; }
    .stat-divider { display: none; }
    .stats-bar { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  }

  /* ── Section shared ── */
  .section-wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 20px;
  }
  .section-label {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
    margin-bottom: 16px;
  }
  .section-label-line {
    width: 32px;
    height: 1px;
    background: var(--border);
  }
  .section-label-text {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--fg-tertiary);
    font-family: var(--font-mono);
  }
  .section-title {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    text-align: center;
    line-height: 1.2;
    letter-spacing: -0.02em;
    margin-bottom: 16px;
  }
  .section-title .accent {
    background: var(--gradient-text);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .section-sub {
    text-align: center;
    font-size: 16px;
    color: var(--fg-secondary);
    max-width: 580px;
    margin: 0 auto 48px;
    line-height: 1.7;
  }

  /* ── Features grid ── */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
    margin-bottom: 80px;
  }
  .feature-card {
    padding: 28px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--card);
    transition: all 0.3s;
  }
  .feature-card:hover {
    border-color: rgba(0, 255, 65, 0.15);
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }
  .feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--accent-subtle);
    color: var(--accent);
    margin-bottom: 16px;
  }
  .feature-card h3 {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 18px;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
  }
  .feature-card p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--fg-secondary);
  }

  /* ── Protocol list ── */
  .protocol-strip {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-bottom: 80px;
  }
  .protocol-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 9999px;
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
    background: var(--surface);
    transition: all 0.2s;
  }
  .protocol-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-subtle);
  }
  .protocol-chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── How It Works ── */
  .steps-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-bottom: 80px;
  }
  .step-card {
    text-align: center;
    padding: 32px 20px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--card);
  }
  .step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--accent-subtle);
    color: var(--accent);
    font-family: var(--font-mono);
    font-weight: 800;
    font-size: 18px;
    margin: 0 auto 16px;
  }
  .step-card h3 {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 18px;
    margin-bottom: 8px;
  }
  .step-card p {
    font-size: 14px;
    color: var(--fg-secondary);
    line-height: 1.7;
  }

  /* ── Quote ── */
  .quote-card {
    max-width: 680px;
    margin: 0 auto 64px;
    padding: 40px 32px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--card);
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .quote-card::before {
    content: '"';
    position: absolute;
    top: -10px;
    left: 20px;
    font-size: 100px;
    font-family: var(--font-heading);
    color: var(--accent);
    opacity: 0.08;
    line-height: 1;
  }
  .quote-text {
    position: relative;
    z-index: 1;
    font-size: 18px;
    line-height: 1.7;
    color: var(--fg-secondary);
    font-style: italic;
  }
  .quote-attribution {
    margin-top: 16px;
    font-size: 13px;
    color: var(--fg-tertiary);
    font-style: normal;
  }

  /* ── Final CTA ── */
  .cta-final {
    text-align: center;
    padding: 80px 20px;
  }
  .cta-final h2 {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: clamp(2rem, 5vw, 3rem);
    letter-spacing: -0.02em;
    margin-bottom: 16px;
  }
  .cta-final p {
    font-size: 16px;
    color: var(--fg-secondary);
    margin-bottom: 32px;
    line-height: 1.7;
  }
  .cta-final .btns {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
  }

  /* ── Footer ── */
  .footer {
    border-top: 1px solid var(--border);
    padding: 48px 20px 32px;
  }
  .footer-inner {
    max-width: 1100px;
    margin: 0 auto;
  }
  .footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 40px;
    margin-bottom: 40px;
  }
  .footer-brand-area {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .footer-brand-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 18px;
  }
  .footer-brand-row svg { flex-shrink: 0; }
  .footer-desc {
    font-size: 13px;
    color: var(--fg-tertiary);
    line-height: 1.6;
    max-width: 300px;
  }
  .footer-col h4 {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-tertiary);
    margin-bottom: 16px;
    font-family: var(--font-mono);
  }
  .footer-col a {
    display: block;
    font-size: 14px;
    color: var(--fg-secondary);
    margin-bottom: 10px;
    transition: color 0.2s;
  }
  .footer-col a:hover { color: var(--fg); }
  .footer-bottom {
    border-top: 1px solid var(--border-soft);
    padding-top: 20px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .footer-bottom p {
    font-size: 12px;
    color: var(--fg-tertiary);
  }
  .footer-socials {
    display: flex;
    gap: 16px;
  }
  .footer-socials a {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--fg-tertiary);
    transition: color 0.2s;
  }
  .footer-socials a:hover { color: var(--accent); }

  @media (max-width: 768px) {
    .footer-grid {
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .footer-brand-area { grid-column: 1 / -1; }
    .features-grid { grid-template-columns: 1fr; }
    .steps-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .footer-grid { grid-template-columns: 1fr; }
    .footer-bottom { flex-direction: column; text-align: center; }
  }

  /* ── Animations ── */
  .fade-up {
    opacity: 0;
    transform: translateY(24px);
    animation: fadeUp 0.7s ease-out forwards;
  }
  @keyframes fadeUp {
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-up-d1 { animation-delay: 0.1s; }
  .fade-up-d2 { animation-delay: 0.2s; }
  .fade-up-d3 { animation-delay: 0.3s; }
  .fade-up-d4 { animation-delay: 0.4s; }
  .fade-up-d5 { animation-delay: 0.5s; }
  .fade-up-d6 { animation-delay: 0.6s; }
`;

/* ─── FEATURES DATA ───────────────────────────────────────────────────── */

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
    title: 'Multi-Protocol Feed',
    desc: 'Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS, YouTube, and more into one unified timeline. Filter by network, topic, or creator.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: 'Zero Sign-Up Required',
    desc: 'No account, no wallet, no key needed. Open the app and start reading every protocol immediately. Zero friction, zero data collection.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v18M3 12h18" />
        <path d="M8 16l4 4 4-4" opacity="0.6" />
        <path d="M8 8l4-4 4 4" opacity="0.6" />
      </svg>
    ),
    title: 'Cross-Post Everywhere',
    desc: 'Compose once. Publish to Nostr, Farcaster, Lens, Bluesky, Mastodon, and Threads simultaneously. Partial failures retry automatically in the background.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="12" cy="12" r="3" />
        <path d="M7 7h.01" />
      </svg>
    ),
    title: 'Your Keys, Your Data',
    desc: 'Sign in with your existing Nostr key, Farcaster signer, or Lens wallet. Your keys never leave your browser. We never store or touch your private data.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" opacity="0.7" />
        <path d="M2 12l10 5 10-5" opacity="0.5" />
      </svg>
    ),
    title: '100% Open Source',
    desc: 'MIT licensed. Self-hostable. Public API. No tokens, no ads, no VC funding. Built by Rug Munch Media LLC for the community.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
    title: 'Real-Time Updates',
    desc: 'Live streaming across all protocols. See posts, likes, and reposts as they happen. No refresh needed — WebSocket-powered instant updates.',
  },
];

/* ─── PROTOCOLS DATA ──────────────────────────────────────────────────── */

interface Protocol {
  name: string;
  color: string;
}

const PROTOCOLS: Protocol[] = [
  { name: 'Nostr', color: '#8e30eb' },
  { name: 'Farcaster', color: '#8a63d2' },
  { name: 'Lens', color: '#abfe2c' },
  { name: 'Bluesky', color: '#1185fe' },
  { name: 'Mastodon', color: '#6364ff' },
  { name: 'Threads', color: '#888' },
  { name: 'Reddit', color: '#ff4500' },
  { name: 'PeerTube', color: '#f2690d' },
  { name: 'PixelFed', color: '#ff0080' },
  { name: 'YouTube', color: '#ff0000' },
  { name: 'RSS', color: '#ffa500' },
  { name: 'Discourse', color: '#00aeef' },
];

/* ─── STATS DATA ──────────────────────────────────────────────────────── */

const STATS = [
  { label: 'Protocols', value: '101+' },
  { label: 'RSS Sources', value: '319' },
  { label: 'Reddit Communities', value: '137' },
  { label: 'YouTube Channels', value: '68' },
];

/* ─── PAGE COMPONENT ──────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <>
      <style>{THEME_STYLES}</style>
      <div className="scanline" aria-hidden="true" />

      {/* ════════════ HEADER ════════════ */}
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="header-brand" aria-label="DegenFeed home">
            {LOGO_SVG}
            <span>DegenFeed</span>
          </Link>
          <nav className="header-nav" aria-label="Primary">
            <Link href="https://app.degenfeed.xyz/feed">Feed</Link>
            <Link href="https://social.degenfeed.xyz">Social</Link>
            <Link href="https://blog.degenfeed.xyz">Blog</Link>
            <Link href="https://docs.degenfeed.xyz">Docs</Link>
            <Link href="https://app.degenfeed.xyz" className="header-cta">
              Launch App
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="btn-arrow"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="https://app.degenfeed.xyz"
              className="header-mobile-cta"
              aria-label="Launch App"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        {/* ════════════ HERO ════════════ */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-grid" aria-hidden="true" />

          <div className="hero-badges">
            <span className="badge badge-green">Now Live</span>
            <span className="badge badge-outline">Open Source</span>
            <span className="badge badge-outline">Free Forever</span>
          </div>

          <h1 id="hero-title" className="hero-title">
            The Web3
            <br />
            <span className="accent">Social Universe</span>
          </h1>

          <p className="hero-sub">
            Aggregate every protocol. Read everything for free.
            <br />
            Sign in with your existing identity to like, reply, and cross-post everywhere.
          </p>

          <div className="hero-cta">
            <Link href="https://app.degenfeed.xyz" className="btn btn-primary">
              Launch App
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="btn-arrow"
                aria-hidden="true"
              >
                <path
                  d="M4 10h12M10 4l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="https://social.degenfeed.xyz" className="btn btn-secondary">
              Create Free Account
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="btn-arrow"
                aria-hidden="true"
              >
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

          {/* Stats bar */}
          <div className="stats-bar">
            {STATS.map((stat, _i) => (
              <span key={stat.label} className="stat-item">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </span>
            ))}
            <span className="stat-divider" aria-hidden="true" />
            <span className="stat-item">
              <span className="stat-value">15M+</span>
              <span className="stat-label">Reachable</span>
            </span>
          </div>
        </section>

        {/* ════════════ PROTOCOLS ════════════ */}
        <section className="section-wrap" aria-labelledby="protocols-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">Supported Networks</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="protocols-title" className="section-title">
            One Window Into <span className="accent">Every</span> Protocol
          </h2>
          <p className="section-sub">
            Read and interact across the entire open social graph from a single interface.
          </p>
          <div className="protocol-strip">
            {PROTOCOLS.map((p) => (
              <span key={p.name} className="protocol-chip">
                <span className="protocol-chip-dot" style={{ background: p.color }} />
                {p.name}
              </span>
            ))}
          </div>
        </section>

        {/* ════════════ FEATURES ════════════ */}
        <section className="section-wrap" aria-labelledby="features-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">Platform Capabilities</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="features-title" className="section-title">
            Everything You Need to <span className="accent">Navigate</span> the Open Social Graph
          </h2>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ════════════ HOW IT WORKS ════════════ */}
        <section className="section-wrap" aria-labelledby="how-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">How It Works</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="how-title" className="section-title">
            Three Steps to <span className="accent">Connect</span> Everything
          </h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">01</div>
              <h3>Open the App</h3>
              <p>
                No sign-up, no wallet, no key. All protocols and RSS feeds load instantly. Start
                reading in seconds.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">02</div>
              <h3>Connect Your Identity</h3>
              <p>
                Nostr key, Farcaster signer, Lens wallet, Bluesky password, Mastodon token — use
                what you already have.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">03</div>
              <h3>Cross-Post Everywhere</h3>
              <p>
                Link multiple accounts and compose once. DegenFeed publishes to every network in
                parallel.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════ QUOTE ════════════ */}
        <section className="section-wrap" aria-labelledby="manifesto-title">
          <div className="quote-card">
            <div className="section-label">
              <span className="section-label-line" aria-hidden="true" />
              <span className="section-label-text">Our Philosophy</span>
              <span className="section-label-line" aria-hidden="true" />
            </div>
            <h2 id="manifesto-title" className="section-title" style={{ marginBottom: 24 }}>
              The Window to the <span className="accent">Open Social Graph</span>
            </h2>
            <blockquote className="quote-text">
              &ldquo;The open social graph is fractured across a dozen protocols, each with its own
              app, its own feed, its own set of accounts to manage. DegenFeed is the window that
              sees them all. The graph belongs to the protocols. The window belongs to you.&rdquo;
            </blockquote>
            <p className="quote-attribution">&mdash; DegenFeed Team</p>
          </div>
        </section>

        {/* ════════════ FINAL CTA ════════════ */}
        <section className="cta-final" aria-labelledby="cta-title">
          <h2 id="cta-title">
            Ready to Explore the
            <br />
            Social Universe?
          </h2>
          <p>
            The feed is live. No waitlist. No tokens. No sign-up required.
            <br />
            Built for the community, forever.
          </p>
          <div className="btns">
            <Link href="https://app.degenfeed.xyz" className="btn btn-primary">
              Launch App
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="btn-arrow"
                aria-hidden="true"
              >
                <path
                  d="M4 10h12M10 4l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="https://social.degenfeed.xyz" className="btn btn-secondary">
              Create Free Account
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="btn-arrow"
                aria-hidden="true"
              >
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
      </main>

      {/* ════════════ FOOTER ════════════ */}
      <footer className="footer" role="contentinfo">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand-area">
              <div className="footer-brand-row">
                {LOGO_SVG}
                <span>DegenFeed</span>
              </div>
              <p className="footer-desc">
                The Web3 Social Universe. Aggregate Nostr, Farcaster, Lens, Bluesky, Mastodon, and
                more into one unified feed. Built on open protocols by{' '}
                <strong>Rug Munch Media LLC</strong>.
              </p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="https://app.degenfeed.xyz">Launch App</a>
              <a href="https://docs.degenfeed.xyz">Documentation</a>
              <a href="https://status.degenfeed.xyz">Status</a>
              <a href="https://blog.degenfeed.xyz">Blog</a>
            </div>
            <div className="footer-col">
              <h4>Network</h4>
              <a href="https://social.degenfeed.xyz">Social</a>
              <a href="https://community.degenfeed.xyz">Community</a>
              <a href="https://video.degenfeed.xyz">Video</a>
              <a href="https://photos.degenfeed.xyz">Photos</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="https://github.com/RugMunchMedia">GitHub</a>
              <a href="https://git.rugmunch.io/RugMunchMedia">Git</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>
              &copy; {new Date().getFullYear()} DegenFeed &mdash; a Rug Munch Media LLC product.
              Open source (MIT). Your data, never sold.
            </p>
            <div className="footer-socials">
              <a href="https://github.com/RugMunchMedia" target="_blank" rel="noopener noreferrer">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
