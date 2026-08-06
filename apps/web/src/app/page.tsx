import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { LandingStats } from '../components/LandingStats';

/* ─── SEO ────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'DegenFeed — One Protocol for All Web3 Social',
  description:
    'One feed for the entire open social graph. Read Nostr, Farcaster, Bluesky, Mastodon, Lens, Threads, Reddit, Minds, RSS and 18+ more networks — then cross-post to all of them at once. Bias-rated news, creator coins, video streaming, and zero sign-up required.',
  keywords: [
    'web3 social media',
    'decentralized social network',
    'one protocol all web3 social',
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
    canonical: 'https://degenfeed.xyz',
    languages: {
      en: 'https://degenfeed.xyz',
      'x-default': 'https://degenfeed.xyz',
    },
  },
  openGraph: {
    title: 'DegenFeed — One Protocol for All Web3 Social',
    description:
      'One feed for the entire open social graph. Nostr, Farcaster, Bluesky, Mastodon + 18 networks and 248 news sources with bias ratings. No sign-up needed.',
    url: 'https://degenfeed.xyz',
    siteName: 'DegenFeed',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'DegenFeed — One Protocol for All Web3 Social',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — One Protocol for All Web3 Social',
    description:
      'One feed for the entire open social graph. Nostr, Farcaster, Bluesky, Mastodon + 18 networks with bias-rated news.',
    images: ['/opengraph-image'],
    creator: '@degenfeed',
  },
};

/* ─── LOGOS ───────────────────────────────────────────────────────────── */

/**
 * DegenFeed logo — neon green wordmark, inline SVG.
 */
const DEGENFEED_LOGO = (
  <img
    src="/degenfeedlogo.png"
    alt="DegenFeed"
    width={400}
    height={251}
    style={{ maxWidth: 'min(400px, 80vw)', height: 'auto' }}
  />
);

/* ─── THEME INLINE STYLES ─────────────────────────────────────────────── */

const THEME_STYLES = `
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
    --accent-subtle: rgba(0, 255, 65, 0.06);
    --accent-glow: rgba(0, 255, 65, 0.12);
    --accent-soft: rgba(0, 255, 65, 0.04);
    --gradient-text: linear-gradient(135deg, #00ff41, #00cc34);
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
    line-height: 1.5;
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
    background: rgba(0, 0, 0, 0.82);
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
  .header-brand-sub {
    display: block;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fg-tertiary);
    margin-top: 1px;
  }
  .header-brand svg {
    flex-shrink: 0;
    width: clamp(128px, 20vw, 176px);
    height: auto;
  }
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
  .header-mobile-cta { display: none; }

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
      linear-gradient(rgba(0, 255, 65, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 255, 65, 0.05) 1px, transparent 1px);
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
    border: 1px solid rgba(0, 255, 65, 0.25);
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
    font-size: clamp(2.6rem, 8vw, 4.6rem);
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
    max-width: 720px;
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
  .btn-primary { background: var(--accent); color: #000; }
  .btn-primary:hover {
    background: var(--accent-dim);
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(0, 255, 65, 0.3);
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
  .btn-arrow { transition: transform 0.2s; }
  .btn:hover .btn-arrow { transform: translateX(3px); }

  /* ── Protocol logo marquee ── */
  .protocol-marquee {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 1080px;
    margin: 56px auto 0;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  }
  .protocol-marquee-track {
    display: flex;
    align-items: center;
    gap: 14px;
    width: max-content;
    animation: marquee-scroll 36s linear infinite;
    will-change: transform;
  }
  .protocol-marquee:hover .protocol-marquee-track { animation-play-state: paused; }
  @keyframes marquee-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  .marquee-item {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 18px;
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: var(--surface-raised);
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-secondary);
    transition: all 0.2s;
  }
  .marquee-item:hover {
    border-color: var(--accent);
    color: var(--fg);
    background: var(--accent-subtle);
  }
  .marquee-item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .marquee-item-name { font-family: var(--font-body); }

  /* ── Fade-in on load (hero) ── */
  .hero-fade {
    opacity: 0;
    animation: heroFadeIn 0.8s ease-out forwards;
  }
  @keyframes heroFadeIn {
    to { opacity: 1; }
  }
  .hero-fade-1 { animation-delay: 0.05s; }
  .hero-fade-2 { animation-delay: 0.15s; }
  .hero-fade-3 { animation-delay: 0.25s; }
  .hero-fade-4 { animation-delay: 0.35s; }
  .hero-fade-5 { animation-delay: 0.5s; }

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
    max-width: 900px;
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
    max-width: 640px;
    margin: 0 auto 48px;
    line-height: 1.7;
  }

  /* ── Features grid (8) ── */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 80px;
  }
  .feature-card {
    padding: 28px 24px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--card);
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }
  .feature-card:hover {
    border-color: rgba(0, 255, 65, 0.3);
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }
  .feature-icon {
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
  .feature-card h3 {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 18px;
    margin-bottom: 8px;
    letter-spacing: -0.01em;
  }
  .feature-card p {
    font-size: 13.5px;
    line-height: 1.7;
    color: var(--fg-secondary);
  }

  /* ── Protocol showcase grid (18) ── */
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
  .protocols-more {
    text-align: center;
    margin: -56px 0 80px;
    font-size: 14px;
    color: var(--fg-tertiary);
  }
  .protocols-more::before {
    content: '✦ ';
    color: var(--accent);
  }

  /* ── How It Works (3-step) ── */
  .how-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 80px;
  }
  .how-card {
    padding: 32px 28px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--card);
    position: relative;
  }
  .how-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--accent);
    color: #000;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 18px;
    margin-bottom: 16px;
  }
  .how-card h3 {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 19px;
    margin-bottom: 10px;
    letter-spacing: -0.01em;
  }
  .how-card p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--fg-secondary);
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
    background: radial-gradient(circle, rgba(0, 255, 65, 0.1) 0%, transparent 65%);
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

  /* ── Testimonials ── */
  .testimonial-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 80px;
  }
  .testimonial-card {
    padding: 28px 24px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--card);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .testimonial-quote {
    font-size: 14px;
    line-height: 1.7;
    color: var(--fg-secondary);
    flex-grow: 1;
  }
  .testimonial-author {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .testimonial-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--accent-subtle);
    color: var(--accent);
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 14px;
    flex-shrink: 0;
  }
  .testimonial-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--fg);
  }
  .testimonial-handle {
    font-size: 11px;
    color: var(--fg-tertiary);
    font-family: var(--font-mono);
  }

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
    border-color: rgba(0, 255, 65, 0.45);
    background: linear-gradient(180deg, rgba(0, 255, 65, 0.06), var(--card));
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
  .price-btn.primary { background: var(--accent); color: #000; }
  .price-btn.primary:hover { background: var(--accent-dim); }
  .price-btn.secondary { border: 1px solid var(--border); color: var(--fg); }
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
  .faq-more {
    text-align: center;
    margin: -56px 0 80px;
    font-size: 14px;
    color: var(--fg-tertiary);
  }
  .faq-more a { color: var(--accent); font-weight: 600; }

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

  @media (max-width: 1024px) {
    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .protocol-grid { grid-template-columns: repeat(3, 1fr); }
    .testimonial-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .footer-grid { grid-template-columns: 1fr 1fr; gap: 24px; }
    .footer-brand-area { grid-column: 1 / -1; }
    .features-grid { grid-template-columns: 1fr; }
    .protocol-grid { grid-template-columns: repeat(2, 1fr); }
    .how-grid { grid-template-columns: 1fr; }
    .news-grid { grid-template-columns: 1fr; gap: 24px; }
    .news-section { padding: 32px 20px; }
    .pricing-grid { grid-template-columns: 1fr; }
    .pricing-note { margin-top: 0; }
    .testimonial-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .footer-grid { grid-template-columns: 1fr; }
    .footer-bottom { flex-direction: column; text-align: center; }
    .news-stats { grid-template-columns: 1fr; }
    .features-grid { grid-template-columns: 1fr; }
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

const ICON_FEED = (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
    <path d="M8 8h8M8 12h5M8 16h8" />
  </svg>
);
const ICON_CLOCK = (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const ICON_CODE = (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 6l-6 6 6 6M16 6l6 6-6 6" />
    <path d="M14 4l-4 16" />
  </svg>
);
const ICON_SERVER = (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="7" rx="2" />
    <rect x="2" y="14" width="20" height="7" rx="2" />
    <path d="M6 6.5h.01M6 17.5h.01" />
  </svg>
);
const ICON_STORAGE = (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.7 4H7.3a2 2 0 00-1.8 1.1z" />
  </svg>
);
const ICON_WALLET = (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12V7H5a2 2 0 01-2-2 2 2 0 012-2h14v5" />
    <path d="M3 5v14a2 2 0 002 2h16v-5" />
    <path d="M18 12a2 2 0 000 4h4v-4h-4z" />
  </svg>
);
const ICON_CHECK = (
  <svg
    aria-hidden="true"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const ICON_CHEVRON = (
  <svg
    className="faq-chevron"
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
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* ─── PROTOCOL ICONS ─────────────────────────────────────────────────── */

interface Protocol {
  name: string;
  color: string;
  tag: string;
  icon: ReactNode;
  slug: string;
}

const PROTOCOLS: Protocol[] = [
  {
    name: 'Nostr',
    color: '#8e30eb',
    tag: 'Protocol',
    slug: 'nostr',
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
    slug: 'farcaster',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c2 0 3 1 3 3v5h4l2 12h-4l-1-6h-1v6h-6v-6H7l-1 6H2L4 10h4V5c0-2 1-3 3-3z" />
      </svg>
    ),
  },
  {
    name: 'Bluesky',
    color: '#1185fe',
    tag: 'AT Protocol',
    slug: 'bluesky',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 10.5c-1.5-3-4.5-5-7-4.5-2.5.5-3.5 3-3 5 .5 2 2 3 3.5 3.5-1.5.5-3 1.5-3.5 3.5-.5 2 .5 4.5 3 5 2.5.5 5.5-1.5 7-4.5 1.5 3 4.5 5 7 4.5 2.5-.5 3.5-3 3-5-.5-2-2-3-3.5-3.5 1.5-.5 3-1.5 3.5-3.5.5-2-.5-4.5-3-5-2.5-.5-5.5 1.5-7 4.5z" />
      </svg>
    ),
  },
  {
    name: 'AT Protocol',
    color: '#0a7cff',
    tag: 'Protocol',
    slug: 'atproto',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    ),
  },
  {
    name: 'Mastodon',
    color: '#6364ff',
    tag: 'ActivityPub',
    slug: 'mastodon',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C7.6 2 4 3.6 4 7.5v8.3c0 1.8.8 3.1 2.4 4 .8.5 2.6 1 4.8 1.1l.2-2.2c-1.4-.2-2.3-.6-2.9-1 .6.6 1.5 1.1 2.7 1.3l.4.1c2.3.3 5.4-.1 7.4-2 1.6-.9 2.4-2.2 2.4-4V7.5C20 3.6 16.4 2 12 2zm5.3 12.2l-2.6-.4c-.2 0-.4.2-.4.4l.1 1.7c0 .2-.2.4-.4.3-2.4-.7-4.4-2.6-4.6-6.1-.1-1.5.9-2.5 2.2-2.5 1.2 0 2.3.8 2.5 2 .2 1.2.2 2.8.2 2.8h3.3s0-1.6.2-2.8c.2-1.2 1.3-2 2.5-2 1.3 0 2.3 1 2.2 2.5-.2 3.5-2.2 5.4-4.6 6.1-.2.1-.4-.1-.4-.3l.1-1.7c.1-.2 0-.4-.3-.4z" />
      </svg>
    ),
  },
  {
    name: 'ActivityPub',
    color: '#7c5cff',
    tag: 'Fediverse',
    slug: 'activitypub',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 6a3 3 0 013-3h10a3 3 0 013 3v7a3 3 0 01-3 3h-4l-5 4v-4H7a3 3 0 01-3-3V6z" />
        <path
          d="M8 9h8M8 12h5"
          stroke="#0d0d0d"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    name: 'Lens',
    color: '#abfe2c',
    tag: 'Protocol',
    slug: 'lens',
    icon: (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
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
    name: 'Threads',
    color: '#b8bdc4',
    tag: 'Read-only',
    slug: 'threads',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c3 0 5 1.5 5 4v.2c2.5.8 4 2.6 4 5.3 0 3.4-2.4 6-6.5 6.6-2 .3-3.5.2-3.5.2s-.2 2-1.2 2.9c-.5.5-1.1.8-1.7.5-.5-.2-.7-.8-.7-1.5 0-1 .2-2.3.2-3.3-2-.6-3-2.2-3-4.2C4.6 8 7 5.6 10 5.4c1.7-.1 3.2 0 4.4.5-.2-.9-.9-1.6-2-1.6-.8 0-1.4.4-1.8.9L8.5 4.5c.9-1.4 2.2-2.4 4.1-2.5h1.8z" />
      </svg>
    ),
  },
  {
    name: 'Reddit',
    color: '#ff4500',
    tag: 'Read-only',
    slug: 'reddit',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="13" r="9" />
        <circle cx="9" cy="12" r="1.6" fill="#0d0d0d" />
        <circle cx="15" cy="12" r="1.6" fill="#0d0d0d" />
        <path d="M12 15c1.8 0 3.2.8 4 2h-8c.8-1.2 2.2-2 4-2z" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'Minds',
    color: '#25d366',
    tag: 'Read-only',
    slug: 'minds',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-4h2v2h-2v-2zm0-10h2v7h-2V6z" />
      </svg>
    ),
  },
  {
    name: 'RSS',
    color: '#ffa500',
    tag: 'News',
    slug: 'rss',
    icon: (
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 11a9 9 0 019 9" />
        <path d="M4 4a16 16 0 0116 16" />
        <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'PeerTube',
    color: '#f2690d',
    tag: 'Video',
    slug: 'peertube',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7L8 5z" />
      </svg>
    ),
  },
  {
    name: 'Owncast',
    color: '#8e30eb',
    tag: 'Video',
    slug: 'owncast',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 17a7 7 0 110-14 7 7 0 010 14z" />
        <path d="M12 6a6 6 0 000 12V6z" />
      </svg>
    ),
  },
  {
    name: 'Lemmy',
    color: '#f2690d',
    tag: 'Community',
    slug: 'lemmy',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M7 10c1.5-2 4-3 5-3s3.5 1 5 3c-1.5 1-3 1.5-5 1.5S8.5 11 7 10z" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    color: '#ff0000',
    tag: 'Video',
    slug: 'youtube',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23 12s0-3.8-.5-5.6c-.3-1-1-1.7-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.4c-1 .3-1.7 1-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6c.3 1 1 1.7 2 2 1.8.4 8.5.4 8.5.4s6.7 0 8.5-.4c-1 .3-1.7 1-2 2z" />
        <path d="M10 15.5v-7l6 3.5-6 3.5z" fill="#0d0d0d" />
      </svg>
    ),
  },
  {
    name: 'Odysee',
    color: '#ef1970',
    tag: 'Video',
    slug: 'odysee',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.2 14.5a5.3 5.3 0 110-10.6 5.3 5.3 0 010 10.6z" />
      </svg>
    ),
  },
  {
    name: 'Rumble',
    color: '#85c742',
    tag: 'Video',
    slug: 'rumble',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.6 13.5l-5-2.9v-5.2h5l5 2.9-5 5.2z" />
      </svg>
    ),
  },
  {
    name: 'Substack',
    color: '#ff6719',
    tag: 'Newsletter',
    slug: 'substack',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 4h16v2.5H4V4zm0 4.5h16V11H4V8.5zm0 4.5h16v2.5L12 20l-8-4.5V13z" />
      </svg>
    ),
  },
  {
    name: 'Mirror',
    color: '#7c3aed',
    tag: 'Publishing',
    slug: 'mirror',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 2h10a1 1 0 011 1v2H6V3a1 1 0 011-1zM6 8h12v2H6V8zm0 4h12v2H6v-2zm0 4h12v2H6v-2zm0 4h12v2H6v-2z" />
      </svg>
    ),
  },
  {
    name: 'Paragraph',
    color: '#00bfff',
    tag: 'Publishing',
    slug: 'paragraph',
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 4h8v2h-3v14h-2V6H8V4z" />
      </svg>
    ),
  },
];

/* ─── FEATURES DATA ──────────────────────────────────────────────────── */

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: ICON_FEED,
    title: 'Multi-Protocol Aggregation',
    desc: 'One ranked timeline across Nostr, Farcaster, Bluesky, Mastodon, Lens, Threads, Reddit, Minds, RSS, PeerTube, and 20+ more networks. Filter by protocol, topic, or creator — no app-hopping, ever.',
  },
  {
    icon: ICON_STORAGE,
    title: 'Decentralized Infrastructure',
    desc: 'No single server owns your feed. Media is pinned to IPFS and Blossom, identities stay on their native protocols, and relays are community-run — so no walled garden can pull the plug.',
  },
  {
    icon: ICON_CLOCK,
    title: 'No Algorithms, Chronological',
    desc: 'Posts arrive in real time, newest first — no engagement-maximizing black box, no shadowbanning, no rage-bait ranking. What you follow is exactly what you see.',
  },
  {
    icon: ICON_CODE,
    title: 'Open Source',
    desc: 'The entire platform is open source (AGPL-3.0). Review every line, audit the ranking, fork it, and contribute — transparency is the point, not a marketing page.',
  },
  {
    icon: ICON_SERVER,
    title: 'Self-Hostable',
    desc: 'Run your own instance with a single Docker Compose file. Own the relay, own the cache, own the bridge — your community, your uptime, your rules.',
  },
  {
    icon: ICON_WALLET,
    title: 'Your Keys, Your Data',
    desc: 'Sign in with the keys you already own — a Nostr nsec, Farcaster signer, Bluesky account, Mastodon token, or a Solana/EVM wallet. We never sell data, and your keys never leave your browser.',
  },
];

/* ─── HOW IT WORKS DATA ──────────────────────────────────────────────── */

const HOW_STEPS = [
  {
    title: 'Connect Your Identity',
    desc: 'Link the keys you already own — a Nostr nsec, Farcaster signer, Bluesky account, Mastodon token, or a Solana/EVM wallet. No new account, no phone number, no lock-in.',
  },
  {
    title: 'Read the Whole Graph',
    desc: 'Your unified feed pulls every protocol into one ranked timeline — social posts, video, communities, and 248 bias-rated news sources. Filter by network or topic.',
  },
  {
    title: 'Post to Everything at Once',
    desc: 'Open the composer, pick which networks to publish to, and hit post. DegenFeed fans out to each protocol natively, aggregates engagement, and collects tips in crypto.',
  },
];

/* ─── TESTIMONIALS DATA ──────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote:
      'I run the same crypto thread on Nostr, Farcaster, and Bluesky without touching three apps. DegenFeed is the first client that made the open social graph feel like one place.',
    name: 'Relay Rancher',
    handle: 'npub1…r8k2',
    initial: 'R',
  },
  {
    quote:
      'The bias ratings on the news feed are genuinely useful — it flags when every source on a story leans one way and points me to the other side. Free, too.',
    name: 'Fedi Finance',
    handle: '@fedifinance',
    initial: 'F',
  },
  {
    quote:
      'Streamed my weekly show to PeerTube, YouTube, and Owncast at once from OBS. Setup took minutes, and the chat aggregated from every platform.',
    name: 'Token Telly',
    handle: 'cast:0x3f…9a1c',
    initial: 'T',
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
    a: 'DegenFeed reads the entire open social graph: Nostr, Farcaster, Lens, Bluesky (AT Protocol), Mastodon, Threads, Reddit, Minds, RSS/Atom, PeerTube, Owncast, Lemmy, YouTube, Odysee, Rumble, Substack, Mirror, Paragraph, and more — over the AT Protocol and ActivityPub as well. The full bridge is live today — browse everything from a single feed with zero sign-up.',
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
    a: 'Your keys never leave your browser, we never sell your data, and there are no trackers beyond privacy-friendly analytics. The platform is open source (AGPL-3.0) and self-hostable, and the ranking algorithm is transparent — no black-box feeds here.',
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
    features: [
      'Read all 18+ protocols',
      '248 news sources with bias ratings',
      'Connect 1 protocol identity',
      'Basic posts on 3 protocols',
    ],
    cta: 'Get Started Free',
  },
  {
    name: 'Pro',
    price: '$9.99',
    per: 'per month',
    desc: 'For power readers who want the whole graph and every identity.',
    features: [
      'All protocol identities',
      'Cross-post to 10+ networks',
      'Verified badge',
      '100 scheduled posts',
      'Cross-network DMs',
    ],
    cta: 'Go Pro',
    popular: true,
  },
  {
    name: 'Creator+',
    price: '$24.99',
    per: 'per month',
    desc: 'For creators building an audience across every protocol.',
    features: [
      'Cross-post to ALL protocols',
      'Creator coin creation',
      'Newsletter + monetization',
      'Unlimited scheduling + Buffer',
      'Full analytics',
    ],
    cta: 'Become a Creator',
  },
];

/* ─── STRUCTURED DATA ────────────────────────────────────────────────── */

const webApplicationStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'DegenFeed',
  alternateName: 'DegenFeed — One Protocol for All Web3 Social',
  url: 'https://degenfeed.xyz',
  applicationCategory: 'SocialNetworkingApplication',
  operatingSystem: 'Any',
  description:
    'One feed for the entire open social graph. Read Nostr, Farcaster, Bluesky, Mastodon, Lens and 18+ more networks — then cross-post to all of them at once. Bias-rated news, creator coins, video streaming.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free forever browsing tier',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '312',
    bestRating: '5',
  },
  featureList: [
    'Unified multi-protocol feed',
    'Cross-protocol posting',
    'Multi-protocol video streaming',
    'Creator coins',
    'Decentralized storage',
    'Multi-protocol chat',
    'News aggregation with bias ratings',
    'Wallet integration',
  ],
};

const breadcrumbStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://degenfeed.xyz' },
  ],
};

/* ─── PAGE COMPONENT ─────────────────────────────────────────────────── */

export default async function LandingPage() {
  // CSP nonce for the inline theme <style> block (see src/proxy.ts).
  const headersList = await headers();
  const nonce = headersList.get('x-csp-nonce') || '';

  return (
    <>
      <style nonce={nonce}>{THEME_STYLES}</style>
      <Script
        id="web-application-structured-data"
        type="application/ld+json"
        strategy="beforeInteractive"
      >
        {JSON.stringify(webApplicationStructuredData)}
      </Script>
      <Script
        id="breadcrumb-structured-data"
        type="application/ld+json"
        strategy="beforeInteractive"
      >
        {JSON.stringify(breadcrumbStructuredData)}
      </Script>
      <div className="scanline" aria-hidden="true" />

      {/* ════════════ HEADER ════════════ */}
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="header-brand" aria-label="DegenFeed home — by Rug Munch Media">
            {DEGENFEED_LOGO}
            <span>
              DegenFeed
              <span className="header-brand-sub">by Rug Munch Media</span>
            </span>
          </Link>
          <nav className="header-nav" aria-label="Primary">
            <Link href="https://app.degenfeed.xyz/feed">Feed</Link>
            <Link href="https://app.degenfeed.xyz/news">News</Link>
            <Link href="https://app.degenfeed.xyz/pricing">Pricing</Link>
            <Link href="https://blog.degenfeed.xyz">Blog</Link>
            <Link href="/docs">Docs</Link>
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

          <h1 id="hero-title" className="hero-title hero-fade hero-fade-1">
            The Internet,
            <br />
            <span className="accent">Unfragmented</span>
          </h1>

          <p className="hero-sub hero-fade hero-fade-2">
            All your feeds. All your platforms. One place.
            <br />
            No algorithms. No censorship.
          </p>

          <div className="hero-cta hero-fade hero-fade-3">
            <Link href="https://app.degenfeed.xyz/register" className="btn btn-primary">
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
            <Link href="https://app.degenfeed.xyz/feed/unified" className="btn btn-secondary">
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
          </div>

          {/* Protocol logo marquee */}
          <div className="protocol-marquee hero-fade hero-fade-4" aria-label="Supported protocols">
            <div className="protocol-marquee-track">
              {[...PROTOCOLS, ...PROTOCOLS].map((p, i) => (
                <span key={`${p.name}-${i}`} className="marquee-item">
                  <span
                    className="marquee-item-icon"
                    style={{ background: `${p.color}1f`, color: p.color }}
                    aria-hidden="true"
                  >
                    {p.icon}
                  </span>
                  <span className="marquee-item-name">{p.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Stats bar — real counts from bridge health, "—" when unavailable */}
          <div className="stats-bar hero-fade hero-fade-5">
            <LandingStats />
          </div>
        </section>

        {/* ════════════ FEATURES GRID ════════════ */}
        <section className="section-wrap" aria-labelledby="features-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">Features</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="features-title" className="section-title">
            Built for the <span className="accent">Open Web</span>
          </h2>
          <p className="section-sub">
            Aggregation without the algorithm. Infrastructure you can run yourself. Your keys, your
            data, your feed — always.
          </p>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="feature-card fade-up">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ════════════ PROTOCOL SHOWCASE (18) ════════════ */}
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
            Read and interact across the entire open social graph from a single interface — 20+
            protocols and growing, each with its own live feed.
          </p>
          <div className="protocol-grid">
            {PROTOCOLS.map((p) => (
              <Link
                key={p.name}
                href={`https://app.degenfeed.xyz/feed/${p.slug}`}
                className="protocol-tile"
              >
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
              </Link>
            ))}
          </div>
          <p className="protocols-more">
            20+ protocols and growing — every feed is live, browsable, and free.
          </p>
        </section>

        {/* ════════════ HOW IT WORKS ════════════ */}
        <section className="section-wrap" aria-labelledby="how-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">How It Works</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="how-title" className="section-title">
            Live in <span className="accent">Three Steps</span>
          </h2>
          <p className="section-sub">
            No migration, no new handle, no learning curve. Bring the identity you already own.
          </p>
          <div className="how-grid">
            {HOW_STEPS.map((s, i) => (
              <article key={s.title} className="how-card fade-up">
                <span className="how-number">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </article>
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

        {/* ════════════ TESTIMONIALS ════════════ */}
        <section className="section-wrap" aria-labelledby="testimonials-title">
          <div className="section-label">
            <span className="section-label-line" aria-hidden="true" />
            <span className="section-label-text">Community</span>
            <span className="section-label-line" aria-hidden="true" />
          </div>
          <h2 id="testimonials-title" className="section-title">
            Loved Across <span className="accent">Every Protocol</span>
          </h2>
          <p className="section-sub">
            From Nostr relays to Mastodon instances to the Fediverse at large — here&rsquo;s what
            the community is saying.
          </p>
          <div className="testimonial-grid">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="testimonial-card fade-up">
                <blockquote className="testimonial-quote">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="testimonial-author">
                  <span className="testimonial-avatar" aria-hidden="true">
                    {t.initial}
                  </span>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-handle">{t.handle}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
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
            Browsing every protocol and reading the news is free forever. Upgrade only when you want
            the full creator toolkit.
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
            Everything you need to know about DegenFeed — and{' '}
            <Link href="/faq" style={{ color: 'var(--accent)' }}>
              27 more answers
            </Link>{' '}
            on the full FAQ page.
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
          <p className="faq-more">
            Still curious? <Link href="/faq">Read the complete FAQ</Link> or{' '}
            <Link href="/docs">browse the documentation</Link>.
          </p>
        </section>

        {/* ════════════ FINAL CTA ════════════ */}
        <section className="cta-final" aria-labelledby="cta-title">
          <h2 id="cta-title">
            Ready to Join the
            <br />
            Open Social Web?
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
                {DEGENFEED_LOGO}
                <span>DegenFeed</span>
              </div>
              <p className="footer-desc">
                One Protocol for All Web3 Social. Aggregate Nostr, Farcaster, Lens, Bluesky,
                Mastodon, and 18+ more networks into one unified feed — plus 248 news sources with
                bias ratings. Built on open protocols by <strong>Rug Munch Media LLC</strong>.
              </p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="https://app.degenfeed.xyz/feed">Explore Feeds</a>
              <a href="https://app.degenfeed.xyz/news">News</a>
              <a href="https://app.degenfeed.xyz/pricing">Pricing</a>
              <a href="/docs">Documentation</a>
              <a href="/faq">FAQ</a>
            </div>
            <div className="footer-col">
              <h4>Network</h4>
              <a href="https://social.degenfeed.xyz">Social</a>
              <a href="https://status.degenfeed.xyz">Status</a>
              <a href="https://blog.degenfeed.xyz">Blog</a>
              <a href="https://community.degenfeed.xyz">Community</a>
              <a href="/docs/protocols">Protocols</a>
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
              Open source (AGPL-3.0). Your data, never sold.
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
              <a
                href="https://social.degenfeed.xyz/@degenfeed"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C7.6 2 4 3.6 4 7.5v8.3c0 1.8.8 3.1 2.4 4 .8.5 2.6 1 4.8 1.1l.2-2.2c-1.4-.2-2.3-.6-2.9-1 .6.6 1.5 1.1 2.7 1.3l.4.1c2.3.3 5.4-.1 7.4-2 1.6-.9 2.4-2.2 2.4-4V7.5C20 3.6 16.4 2 12 2zm5.3 12.2l-2.6-.4c-.2 0-.4.2-.4.4l.1 1.7c0 .2-.2.4-.4.3-2.4-.7-4.4-2.6-4.6-6.1-.1-1.5.9-2.5 2.2-2.5 1.2 0 2.3.8 2.5 2 .2 1.2.2 2.8.2 2.8h3.3s0-1.6.2-2.8c.2-1.2 1.3-2 2.5-2 1.3 0 2.3 1 2.2 2.5-.2 3.5-2.2 5.4-4.6 6.1-.2.1-.4-.1-.4-.3l.1-1.7c.1-.2 0-.4-.3-.4z" />
                </svg>
                Mastodon
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
