import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LandingStats } from '../components/LandingStats';

/* ─── SEO ────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'DegenFeed — The Web3 Social Universe',
  description:
    'One free feed for the entire open social graph. Read Nostr, Farcaster, Lens, Bluesky, Mastodon, and 248 news sources in one place — with bias ratings, blindspot detection, and zero sign-up required.',
  keywords: [
    'web3 social media',
    'decentralized social network',
    'multi protocol social feed',
    'nostr farcaster lens bluesky mastodon',
    'crypto news aggregator',
    'fediverse reader',
    'cross protocol posting',
    'decentralized twitter alternative',
    'open source social media',
    'web3 news feed',
  ],
  alternates: {
    canonical: 'https://app.degenfeed.xyz',
    languages: {
      'en': 'https://app.degenfeed.xyz',
      'x-default': 'https://app.degenfeed.xyz',
    },
  },
  openGraph: {
    title: 'DegenFeed — The Web3 Social Universe',
    description:
      'One free feed for the entire open social graph. Nostr, Farcaster, Lens, Bluesky, Mastodon + 248 news sources with bias ratings. No sign-up needed.',
    url: 'https://app.degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — The Web3 Social Universe',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — The Web3 Social Universe',
    description:
      'One free feed for the entire open social graph. Nostr, Farcaster, Lens, Bluesky, Mastodon + 248 news sources with bias ratings.',
    images: ['/opengraph-image'],
    creator: '@degenfeed',
  },
};

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
      <linearGradient id="lgd" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#1d9bf0" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#lgb)" rx={96} />
    <g stroke="url(#lgd)" strokeWidth={52} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1={160} y1={92} x2={160} y2={420} />
      <path d="M 160 92 A 148 164 0 0 1 160 420" />
    </g>
    <circle cx={230} cy={256} r={100} fill="#1d9bf0" opacity={0.08} />
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
    --accent: #1d9bf0;
    --accent-dim: #1a8cd8;
    --accent-subtle: rgba(29, 155, 240, 0.06);
    --accent-glow: rgba(29, 155, 240, 0.12);
    --accent-soft: rgba(29, 155, 240, 0.04);
    --gradient-text: linear-gradient(135deg, #1d9bf0, #00ccff);
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
    padding: 10px 20px;
    background: var(--accent);
    color: #000 !important;
    font-weight: 700;
    font-size: 14px;
    border-radius: 9999px;
    min-height: 44px;
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
      width: 44px;
      height: 44px;
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
      linear-gradient(rgba(29, 155, 240, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(29, 155, 240, 0.05) 1px, transparent 1px);
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
    padding: 8px 14px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-mono);
    letter-spacing: 0.02em;
  }
  .badge-green {
    background: var(--accent-subtle);
    color: var(--accent);
    border: 1px solid rgba(29, 155, 240, 0.25);
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
    max-width: 680px;
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
    justify-content: center;
    gap: 8px;
    padding: 14px 32px;
    border-radius: 9999px;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 16px;
    min-height: 52px;
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
    box-shadow: 0 0 30px rgba(29, 155, 240, 0.3);
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
    min-width: 130px;
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

  @media (max-width: 640px) {
    .stats-bar { padding: 16px; gap: 8px; }
    .stat-item { min-width: 42%; padding: 6px 8px; }
    .stat-value { font-size: 22px; }
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
    max-width: 620px;
    margin: 0 auto 48px;
    line-height: 1.7;
  }

  /* ── What We Offer (3-column) ── */
  .offer-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 80px;
  }
  .offer-card {
    padding: 32px 28px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--card);
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }
  .offer-card:hover {
    border-color: rgba(29, 155, 240, 0.25);
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }
  .offer-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--accent-subtle);
    color: var(--accent);
    margin-bottom: 16px;
  }
  .offer-card h3 {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 19px;
    margin-bottom: 10px;
    letter-spacing: -0.01em;
  }
  .offer-card p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--fg-secondary);
  }

  /* ── Protocol showcase grid ── */
  .protocol-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 80px;
  }
  .protocol-tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    transition: all 0.2s;
    min-height: 64px;
  }
  .protocol-tile:hover {
    border-color: var(--accent);
    background: var(--accent-subtle);
  }
  .protocol-tile-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .protocol-tile-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
  }
  .protocol-tile-tag {
    font-size: 11px;
    color: var(--fg-tertiary);
  }

  /* ── News section ── */
  .news-section {
    margin-bottom: 80px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: linear-gradient(180deg, var(--card), var(--surface));
    padding: 48px 40px;
    position: relative;
    overflow: hidden;
  }
  .news-section::before {
    content: '';
    position: absolute;
    top: -120px;
    right: -120px;
    width: 360px;
    height: 360px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(29, 155, 240, 0.10) 0%, transparent 65%);
    pointer-events: none;
  }
  .news-grid {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 40px;
    align-items: center;
  }
  .news-copy h2 {
    text-align: left;
    font-size: clamp(1.6rem, 3.6vw, 2.2rem);
    margin-bottom: 16px;
  }
  .news-copy p {
    font-size: 15px;
    color: var(--fg-secondary);
    line-height: 1.7;
    margin-bottom: 24px;
    max-width: 520px;
  }
  .news-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .news-stat {
    padding: 18px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--card);
  }
  .news-stat-value {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 24px;
    color: var(--accent);
    letter-spacing: -0.02em;
  }
  .news-stat-label {
    font-size: 12px;
    color: var(--fg-tertiary);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }
  .bias-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--fg-tertiary);
    margin-top: 12px;
  }
  .bias-pill {
    padding: 3px 10px;
    border-radius: 9999px;
    font-weight: 700;
    font-size: 11px;
  }
  .bias-left { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
  .bias-center { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; }
  .bias-right { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }

  /* ── Pricing ── */
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 80px;
  }
  .price-card {
    display: flex;
    flex-direction: column;
    padding: 32px 28px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--card);
    transition: all 0.3s;
  }
  .price-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }
  .price-card.popular {
    border-color: rgba(29, 155, 240, 0.45);
    background: linear-gradient(180deg, rgba(29, 155, 240, 0.06), var(--card));
  }
  .price-badge {
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: 9999px;
    background: var(--accent);
    color: #000;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 14px;
  }
  .price-name {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 20px;
    margin-bottom: 6px;
  }
  .price-amount {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 40px;
    letter-spacing: -0.03em;
    margin-bottom: 4px;
  }
  .price-amount span {
    font-size: 16px;
    color: var(--fg-tertiary);
    font-weight: 600;
  }
  .price-desc {
    font-size: 13px;
    color: var(--fg-secondary);
    line-height: 1.6;
    margin-bottom: 20px;
    flex-grow: 1;
  }
  .price-features {
    list-style: none;
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .price-features li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: var(--fg-secondary);
  }
  .price-features svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--accent);
  }
  .price-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 20px;
    border-radius: 9999px;
    font-weight: 700;
    font-size: 14px;
    min-height: 48px;
    transition: all 0.2s;
  }
  .price-btn.primary {
    background: var(--accent);
    color: #000;
  }
  .price-btn.primary:hover {
    background: var(--accent-dim);
  }
  .price-btn.secondary {
    border: 1px solid var(--border);
    color: var(--fg);
  }
  .price-btn.secondary:hover {
    border-color: var(--fg-secondary);
    background: var(--surface-raised);
  }
  .pricing-note {
    text-align: center;
    font-size: 13px;
    color: var(--fg-tertiary);
    margin: -56px 0 80px;
  }
  .pricing-note a { color: var(--accent); }

  /* ── FAQ ── */
  .faq-list {
    max-width: 720px;
    margin: 0 auto 80px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .faq-item {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--card);
    overflow: hidden;
  }
  .faq-item summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px;
    font-size: 15px;
    font-weight: 600;
    color: var(--fg);
    cursor: pointer;
    list-style: none;
    min-height: 60px;
    transition: color 0.2s;
  }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary:hover { color: var(--accent); }
  .faq-item summary .faq-chevron {
    flex-shrink: 0;
    transition: transform 0.25s;
    color: var(--fg-tertiary);
  }
  .faq-item[open] summary .faq-chevron { transform: rotate(45deg); }
  .faq-item[open] summary { color: var(--accent); }
  .faq-answer {
    padding: 0 24px 20px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--fg-secondary);
  }
  .faq-answer a { color: var(--accent); }

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

  @media (max-width: 900px) {
    .protocol-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 768px) {
    .footer-grid {
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .footer-brand-area { grid-column: 1 / -1; }
    .offer-grid { grid-template-columns: 1fr; }
    .protocol-grid { grid-template-columns: repeat(2, 1fr); }
    .news-grid { grid-template-columns: 1fr; gap: 24px; }
    .news-section { padding: 32px 20px; }
    .pricing-grid { grid-template-columns: 1fr; }
    .pricing-note { margin-top: 0; }
  }
  @media (max-width: 480px) {
    .footer-grid { grid-template-columns: 1fr; }
    .footer-bottom { flex-direction: column; text-align: center; }
    .news-stats { grid-template-columns: 1fr; }
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

/* ─── ICONS ──────────────────────────────────────────────────────────── */

const ICON_GL = (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const ICON_SHIELD = (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const ICON_NEWS = (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" />
    <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z" />
  </svg>
);
const ICON_CHECK = (
  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const ICON_CHEVRON = (
  <svg className="faq-chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* ─── PROTOCOL ICONS ─────────────────────────────────────────────────── */

interface Protocol {
  name: string;
  color: string;
  tag: string;
  icon: ReactNode;
}

const PROTOCOLS: Protocol[] = [
  {
    name: 'Nostr',
    color: '#8e30eb',
    tag: 'Protocol',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    ),
  },
  {
    name: 'Farcaster',
    color: '#8a63d2',
    tag: 'Protocol',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c2 0 3 1 3 3v5h4l2 12h-4l-1-6h-1v6h-6v-6H7l-1 6H2L4 10h4V5c0-2 1-3 3-3z" />
      </svg>
    ),
  },
  {
    name: 'Lens',
    color: '#abfe2c',
    tag: 'Protocol',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    name: 'Bluesky',
    color: '#1185fe',
    tag: 'Protocol',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 10.5c-1.5-3-4.5-5-7-4.5-2.5.5-3.5 3-3 5 .5 2 2 3 3.5 3.5-1.5.5-3 1.5-3.5 3.5-.5 2 .5 4.5 3 5 2.5.5 5.5-1.5 7-4.5 1.5 3 4.5 5 7 4.5 2.5-.5 3.5-3 3-5-.5-2-2-3-3.5-3.5 1.5-.5 3-1.5 3.5-3.5.5-2-.5-4.5-3-5-2.5-.5-5.5 1.5-7 4.5z" />
      </svg>
    ),
  },
  {
    name: 'Mastodon',
    color: '#6364ff',
    tag: 'Protocol',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C7.6 2 4 3.6 4 7.5v8.3c0 1.8.8 3.1 2.4 4 .8.5 2.6 1 4.8 1.1l.2-2.2c-1.4-.2-2.3-.6-2.9-1 .6.6 1.5 1.1 2.7 1.3l.4.1c2.3.3 5.4-.1 7.4-2 1.6-.9 2.4-2.2 2.4-4V7.5C20 3.6 16.4 2 12 2zm5.3 12.2l-2.6-.4c-.2 0-.4.2-.4.4l.1 1.7c0 .2-.2.4-.4.3-2.4-.7-4.4-2.6-4.6-6.1-.1-1.5.9-2.5 2.2-2.5 1.2 0 2.3.8 2.5 2 .2 1.2.2 2.8.2 2.8h3.3s0-1.6.2-2.8c.2-1.2 1.3-2 2.5-2 1.3 0 2.3 1 2.2 2.5-.2 3.5-2.2 5.4-4.6 6.1-.2.1-.4-.1-.4-.3l.1-1.7c.1-.2 0-.4-.3-.4z" />
      </svg>
    ),
  },
  {
    name: 'Lemmy',
    color: '#f2690d',
    tag: 'Community',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M7 10c1.5-2 4-3 5-3s3.5 1 5 3c-1.5 1-3 1.5-5 1.5S8.5 11 7 10z" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'PeerTube',
    color: '#f2690d',
    tag: 'Video',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7L8 5z" />
      </svg>
    ),
  },
  {
    name: 'RSS',
    color: '#ffa500',
    tag: 'News',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 019 9" />
        <path d="M4 4a16 16 0 0116 16" />
        <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

/* ─── OFFERS DATA ────────────────────────────────────────────────────── */

interface Offer {
  icon: ReactNode;
  title: string;
  desc: string;
}

const OFFERS: Offer[] = [
  {
    icon: ICON_GL,
    title: 'All Protocols, One Feed',
    desc: 'Read Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, PeerTube, and 30+ more networks in one unified, ranked timeline. Filter by protocol, topic, or creator — no app-hopping, ever.',
  },
  {
    icon: ICON_SHIELD,
    title: 'Your Content, Your Rules',
    desc: 'No ads, no algorithm manipulation, no data selling. Sign in with the keys you already own, cross-post to every network at once, and keep full control of your identity.',
  },
  {
    icon: ICON_NEWS,
    title: 'Best News in Web3',
    desc: '248 crypto, DeFi, AI, and tech sources ranked by credibility, recency, and sentiment — with bias ratings and blindspot detection so you see both sides of every story.',
  },
];

/* ─── FAQ DATA ───────────────────────────────────────────────────────── */

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'What protocols does DegenFeed support?',
    a: 'DegenFeed reads the entire open social graph: Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, PeerTube, Pixelfed, Threads, Reddit, RSS/Atom, YouTube, and 30+ more networks. The full bridge is live today — browse everything from a single feed with zero sign-up.',
  },
  {
    q: 'How does cross-posting work?',
    a: 'Open the composer, pick which protocols to publish to, and hit post. DegenFeed sends your content to each network using its native API — Nostr events, Farcaster protobufs, Bluesky XRPC, Mastodon REST — and retries partial failures in the background. One post, everywhere.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. Browsing every protocol and reading all 248 news sources is free forever — no account, no wallet, no credit card. Free users can connect one protocol identity and post. Paid tiers unlock all identities, cross-posting to everything, scheduling, and creator tools.',
  },
  {
    q: 'Do I need a wallet or crypto to use DegenFeed?',
    a: 'No. You can read everything with zero setup. To post, connect the identity you already have — a Nostr key, Farcaster signer, Bluesky account, or Mastodon token. Crypto is only involved if you want to tip creators or collect your own creator coin.',
  },
  {
    q: 'How is your news different from Ground News?',
    a: 'DegenFeed gives you Ground News-style bias ratings and echo-chamber detection for free — no paywall. 248 sources are ranked by credibility tier, tagged with a 5-point political bias, and stories flagged when coverage skews to one side, with suggested sources from the other.',
  },
  {
    q: 'Is my data safe? Is DegenFeed open source?',
    a: 'Your keys never leave your browser, we never sell your data, and there are no trackers beyond privacy-friendly analytics. The platform is open source (MIT) and self-hostable, and the ranking algorithm is transparent — no black-box feeds here.',
  },
];

/* ─── PRICING DATA ───────────────────────────────────────────────────── */

interface PriceTier {
  name: string;
  price: string;
  per: string;
  desc: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

const PRICE_TIERS: PriceTier[] = [
  {
    name: 'Free',
    price: '$0',
    per: 'forever',
    desc: 'Everything you need to start exploring the open social graph.',
    features: ['Read all 30+ protocols', '248 news sources with bias ratings', 'Connect 1 protocol identity', 'Basic posts on 3 protocols'],
    cta: 'Get Started Free',
  },
  {
    name: 'Pro',
    price: '$9.99',
    per: 'per month',
    desc: 'For power readers who want the whole graph and every identity.',
    features: ['All protocol identities', 'Cross-post to 10+ networks', 'Verified badge', '100 scheduled posts', 'Cross-network DMs'],
    cta: 'Go Pro',
    popular: true,
  },
  {
    name: 'Creator+',
    price: '$24.99',
    per: 'per month',
    desc: 'For creators building an audience across every protocol.',
    features: ['Cross-post to ALL protocols', 'Creator coin creation', 'Newsletter + monetization', 'Unlimited scheduling + Buffer', 'Full analytics'],
    cta: 'Become a Creator',
  },
];

/* ─── PAGE COMPONENT ─────────────────────────────────────────────────── */

export default async function LandingPage() {
  // CSP nonce for the inline theme <style> block (see src/proxy.ts). Without a
  // nonce the browser's style-src policy silently drops the landing theme, so
  // the page falls back to bare globals.css styling.
  const headersList = await headers();
  const nonce = headersList.get('x-csp-nonce') || '';

  return (
    <>
      <style nonce={nonce}>{THEME_STYLES}</style>
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
            <Link href="https://app.degenfeed.xyz/news">News</Link>
            <Link href="https://app.degenfeed.xyz/pricing">Pricing</Link>
            <Link href="https://blog.degenfeed.xyz">Blog</Link>
            <Link href="https://docs.degenfeed.xyz">Docs</Link>
            <Link href="https://app.degenfeed.xyz/feed" className="header-cta">
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
              href="https://app.degenfeed.xyz/feed"
              className="header-mobile-cta"
              aria-label="Launch App"
            >
              <svg
                aria-hidden="true"
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
            One free feed for every protocol and every side of the news.
            <br />
            Read Nostr, Farcaster, Lens, Bluesky, Mastodon, and 248 news sources — then post to all
            of them at once with the identity you already own.
          </p>

          <div className="hero-cta">
            <Link href="https://app.degenfeed.xyz/feed" className="btn btn-primary">
              Explore Feeds
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
            <Link href="https://app.degenfeed.xyz/register" className="btn btn-secondary">
              Get Started
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

          {/* Stats bar — real counts from bridge health, "—" when unavailable */}
          <div className="stats-bar">
            <LandingStats />
          </div>
        </section>

        {/* ════════════ WHAT WE OFFER ════════════ */}
        <section className="section-wrap" aria-labelledby="offers-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">What We Offer</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="offers-title" className="section-title">
            Everything You Need, <span className="accent">Nothing You Don&rsquo;t</span>
          </h2>
          <p className="section-sub">
            The entire open social graph, your identity, and the best news in web3 — unified,
            transparent, and free to read.
          </p>
          <div className="offer-grid">
            {OFFERS.map((o) => (
              <article key={o.title} className="offer-card fade-up">
                <div className="offer-icon">{o.icon}</div>
                <h3>{o.title}</h3>
                <p>{o.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ════════════ PROTOCOL SHOWCASE ════════════ */}
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
            Read and interact across the entire open social graph from a single interface — with
            30+ networks online right now.
          </p>
          <div className="protocol-grid">
            {PROTOCOLS.map((p) => (
              <div key={p.name} className="protocol-tile">
                <span className="protocol-tile-icon" style={{ background: `${p.color}1f`, color: p.color }}>
                  {p.icon}
                </span>
                <div>
                  <div className="protocol-tile-name">{p.name}</div>
                  <div className="protocol-tile-tag">{p.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════ NEWS BEATS EVERYONE ════════════ */}
        <section className="section-wrap" aria-labelledby="news-title">
          <div className="news-section">
            <div className="news-grid">
              <div className="news-copy">
                <div className="section-label" style={{ justifyContent: 'flex-start' }}>
                  <span className="section-label-text">News Beats Everyone</span>
                </div>
                <h2 id="news-title" className="section-title">
                  Smarter than the <span className="accent">Echo Chamber</span>
                </h2>
                <p>
                  DegenFeed aggregates <strong>248 news sources</strong> across crypto, DeFi, AI,
                  and tech — ranked by credibility, recency, and sentiment. Every story gets a
                  transparent bias rating and blindspot detection that flags one-sided coverage and
                  points you to the other side. Ground News-style transparency,{' '}
                  <strong>free forever</strong> — no paywall.
                </p>
                <div className="bias-row">
                  <span>Bias-rated on a 5-point scale:</span>
                  <span className="bias-pill bias-left">Left</span>
                  <span className="bias-pill bias-center">Center</span>
                  <span className="bias-pill bias-right">Right</span>
                </div>
                <div style={{ marginTop: 24 }}>
                  <Link href="https://app.degenfeed.xyz/news" className="btn btn-primary">
                    Read the News
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
              </div>
              <div className="news-stats">
                <div className="news-stat">
                  <div className="news-stat-value">248</div>
                  <div className="news-stat-label">News Sources</div>
                </div>
                <div className="news-stat">
                  <div className="news-stat-value">5-pt</div>
                  <div className="news-stat-label">Bias Rating</div>
                </div>
                <div className="news-stat">
                  <div className="news-stat-value">∞</div>
                  <div className="news-stat-label">Blindspot Alerts</div>
                </div>
                <div className="news-stat">
                  <div className="news-stat-value">$0</div>
                  <div className="news-stat-label">No Paywall</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ PRICING ════════════ */}
        <section className="section-wrap" aria-labelledby="pricing-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">Pricing</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="pricing-title" className="section-title">
            Free to Read. <span className="accent">Fair to Upgrade.</span>
          </h2>
          <p className="section-sub">
            Browsing every protocol and reading the news is free forever. Upgrade only when you
            want the full creator toolkit.
          </p>
          <div className="pricing-grid">
            {PRICE_TIERS.map((t) => (
              <div key={t.name} className={`price-card${t.popular ? ' popular' : ''}`}>
                {t.popular ? <span className="price-badge">Most Popular</span> : null}
                <h3 className="price-name">{t.name}</h3>
                <div className="price-amount">
                  {t.price} <span>/ {t.per}</span>
                </div>
                <p className="price-desc">{t.desc}</p>
                <ul className="price-features">
                  {t.features.map((f) => (
                    <li key={f}>
                      {ICON_CHECK}
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="https://app.degenfeed.xyz/pricing"
                  className={`price-btn ${t.popular ? 'primary' : 'secondary'}`}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="pricing-note">
            See the full comparison, annual plans, and Enterprise options on{' '}
            <Link href="https://app.degenfeed.xyz/pricing">the pricing page</Link>.
          </p>
        </section>

        {/* ════════════ FAQ ════════════ */}
        <section className="section-wrap" aria-labelledby="faq-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">FAQ</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="faq-title" className="section-title">
            Questions, <span className="accent">Answered</span>
          </h2>
          <p className="section-sub">
            Everything you need to know about the Web3 Social Universe.
          </p>
          <div className="faq-list">
            {FAQS.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>
                  {f.q}
                  {ICON_CHEVRON}
                </summary>
                <div className="faq-answer">{f.a}</div>
              </details>
            ))}
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
            <Link href="https://app.degenfeed.xyz/feed" className="btn btn-primary">
              Explore Feeds
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
            <Link href="https://app.degenfeed.xyz/register" className="btn btn-secondary">
              Get Started
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
                more into one unified feed — plus 248 news sources with bias ratings. Built on open
                protocols by <strong>Rug Munch Media LLC</strong>.
              </p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="https://app.degenfeed.xyz/feed">Explore Feeds</a>
              <a href="https://app.degenfeed.xyz/news">News</a>
              <a href="https://app.degenfeed.xyz/pricing">Pricing</a>
              <a href="https://docs.degenfeed.xyz">Documentation</a>
            </div>
            <div className="footer-col">
              <h4>Network</h4>
              <a href="https://social.degenfeed.xyz">Social</a>
              <a href="https://status.degenfeed.xyz">Status</a>
              <a href="https://blog.degenfeed.xyz">Blog</a>
              <a href="https://community.degenfeed.xyz">Community</a>
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
