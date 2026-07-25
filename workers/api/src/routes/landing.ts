/**
 * Landing page assets — served by the Worker at degenfeed.xyz/
 * and www.degenfeed.xyz/ to bypass the tunnel/port-80 mismatch.
 *
 * Redesigned: 2026-07-25 — "One Feed. Every Protocol. Your Rules."
 * Cyberpunk vision page with aurora gradient, feature grid, protocol marquee.
 */

export const LANDING_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#000000" />
    <meta name="color-scheme" content="dark" />

    <title>DegenFeed — The Web3 Social Aggregator</title>
    <meta
      name="description"
      content="One feed. Every protocol. Your rules. DegenFeed unifies 18 decentralized networks into a single, beautiful timeline. Own your identity. Control your feed. Bridge every protocol."
    />

    <!-- Open Graph -->
    <meta property="og:title" content="DegenFeed — The Web3 Social Aggregator" />
    <meta property="og:description" content="One feed. Every protocol. Your rules." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://degenfeed.xyz" />
    <meta property="og:image" content="https://degenfeed.xyz/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@degenfeed" />
    <meta name="twitter:title" content="DegenFeed — The Web3 Social Aggregator" />
    <meta name="twitter:description" content="One feed. Every protocol. Your rules." />
    <meta name="twitter:image" content="https://degenfeed.xyz/og-image.png" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/favicon.svg" />

    <!-- Google Fonts: Syne (headings) + Plus Jakarta Sans (body) -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Syne:wght@700;800&display=swap"
      rel="stylesheet"
    />

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "DegenFeed",
        "url": "https://degenfeed.xyz",
        "description": "Open-source multi-protocol social aggregator for web3. Nostr, Farcaster, Lens, Bluesky, Mastodon, and more in one feed. Zero sign-ups to read. One composer to post everywhere.",
        "applicationCategory": "SocialNetworkingApplication",
        "operatingSystem": "Web",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "author": { "@type": "Organization", "name": "Rug Munch Media LLC", "url": "https://degenfeed.xyz" }
      }
    </script>

    <link rel="stylesheet" href="/styles.css" />
    <script defer data-domain="degenfeed.xyz" src="https://plausible.rugmunch.io/js/script.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>

    <!-- ═══ HEADER ═══ -->
    <header class="navbar" role="banner">
      <a href="/" class="brand" aria-label="DegenFeed home">
        <span class="brand-mark" aria-hidden="true">&gt;_</span>
        <span class="brand-name">DegenFeed</span>
      </a>
      <nav class="nav" aria-label="Primary">
        <a href="#features">Features</a>
        <a href="#protocols">Protocols</a>
        <a href="#stats">Stats</a>
        <a href="/docs">Docs</a>
        <a href="https://app.degenfeed.xyz" class="nav-cta">Open App →</a>
      </nav>
    </header>

    <main id="main">

      <!-- ═══════════════ HERO SECTION ═══════════════ -->
      <section class="hero" aria-labelledby="hero-title">
        <!-- Aurora background layers -->
        <div class="aurora-bg" aria-hidden="true">
          <div class="aurora-layer aurora-1"></div>
          <div class="aurora-layer aurora-2"></div>
          <div class="aurora-layer aurora-3"></div>
        </div>
        <!-- Grid overlay -->
        <div class="hero-grid" aria-hidden="true"></div>

        <div class="hero-content">
          <!-- Badge -->
          <div class="hero-badge">
            <span class="badge-dot"></span>
            Live — 18 Protocols · 38 Self-Hosted Nodes
          </div>

          <!-- Headline -->
          <h1 id="hero-title" class="hero-title">
            <span class="hero-gradient-line">One Feed.</span>
            <span class="hero-fg-line">Every Protocol.</span>
            <span class="hero-gradient-line">Your Rules.</span>
          </h1>

          <!-- Subheadline -->
          <p class="hero-sub">
            DegenFeed unifies 18 decentralized networks into a single, beautiful timeline.
            Own your identity. Control your feed. Bridge every protocol.
          </p>

          <!-- CTA Buttons -->
          <div class="hero-cta">
            <a href="https://app.degenfeed.xyz" class="btn-glow">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 9l6 3-6 3V9z"/></svg>
              Connect Wallet
            </a>
            <a href="https://app.degenfeed.xyz" class="btn-outline">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Browse Anonymously
            </a>
          </div>

          <!-- Live Stats -->
          <div class="hero-stats">
            <div class="hero-stat">
              <span class="hero-stat-value">18</span>
              <span class="hero-stat-label">Protocols</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">38</span>
              <span class="hero-stat-label">Self-Hosted Nodes</span>
            </div>
            <div class="hero-stat">
              <span class="hero-stat-value">100%</span>
              <span class="hero-stat-label">Open Source</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════ FEATURES GRID ═══════════════ -->
      <section class="features" id="features" aria-labelledby="features-title">
        <div class="section-header">
          <h2 id="features-title" class="section-title">
            The Unified <span class="gradient-text">Social Layer</span>
          </h2>
          <p class="section-sub">
            One protocol is limiting. Eighteen is liberation. Every network, every identity, every post — in one place.
          </p>
        </div>

        <div class="features-grid">
          <article class="f-card">
            <div class="f-card-icon" style="--fc-accent:#8b5cf6">🔗</div>
            <h3 class="f-card-title">Cross-Protocol Identity</h3>
            <p class="f-card-desc">One wallet. Every identity. Link your Nostr npub, Farcaster FID, Bluesky DID, Mastodon handle, and Lens profile — all owned by you.</p>
          </article>

          <article class="f-card">
            <div class="f-card-icon" style="--fc-accent:#00ff41">📡</div>
            <h3 class="f-card-title">Unified Feed</h3>
            <p class="f-card-desc">No more checking 8 apps. See every post from every protocol in one timeline. Smart deduplication means no repeats.</p>
          </article>

          <article class="f-card">
            <div class="f-card-icon" style="--fc-accent:#f59e0b">💰</div>
            <h3 class="f-card-title">Creator Coins</h3>
            <p class="f-card-desc">Launch your own token across Base and Solana. Let fans tip you from ANY protocol. Vesting schedules, bonding curves, anti-exploit protection.</p>
          </article>

          <article class="f-card">
            <div class="f-card-icon" style="--fc-accent:#00ba7c">🔒</div>
            <h3 class="f-card-title">Data Sovereignty</h3>
            <p class="f-card-desc">We self-host Farcaster Hubble, Nostr relay, PeerTube, GoToSocial, and more. Your data lives on our infrastructure, not theirs.</p>
          </article>

          <article class="f-card">
            <div class="f-card-icon" style="--fc-accent:#6364ff">🌉</div>
            <h3 class="f-card-title">Protocol Bridging</h3>
            <p class="f-card-desc">Post once, publish everywhere. Reply to a Farcaster cast from Nostr. DM a Bluesky user from Matrix. The bridges work.</p>
          </article>

          <article class="f-card">
            <div class="f-card-icon" style="--fc-accent:#f91880">🎨</div>
            <h3 class="f-card-title">Beautiful &amp; Fast</h3>
            <p class="f-card-desc">Designed like the best social apps. Dark mode by default. Sub-100ms feed loads. Mobile-first with native-feel gestures.</p>
          </article>
        </div>
      </section>

      <!-- ═══════════════ PROTOCOL SHOWCASE ═══════════════ -->
      <section class="protocols" id="protocols" aria-labelledby="protocols-title">
        <div class="section-header">
          <h2 id="protocols-title" class="section-title">
            Every Protocol. <span class="gradient-text">One Window.</span>
          </h2>
          <p class="section-sub">
            18 decentralized networks. One unified timeline. The social graph belongs to the protocols — the window belongs to you.
          </p>
        </div>

        <div class="marquee-wrapper">
          <div class="marquee-edge left"></div>
          <div class="marquee-edge right"></div>
          <div class="marquee-track">
            <div class="marquee-content">
              <span class="p-chip" style="--pc:#8b5cf6">🌩 Nostr</span>
              <span class="p-chip" style="--pc:#8a63d2">⚡ Farcaster</span>
              <span class="p-chip" style="--pc:#abfe2c">🔮 Lens</span>
              <span class="p-chip" style="--pc:#1185fe">🦋 Bluesky</span>
              <span class="p-chip" style="--pc:#6364ff">🐘 Mastodon</span>
              <span class="p-chip" style="--pc:#ff4500">🤖 Reddit</span>
              <span class="p-chip" style="--pc:#e74c3c">🎬 PeerTube</span>
              <span class="p-chip" style="--pc:#c44a8b">📸 PixelFed</span>
              <span class="p-chip" style="--pc:#888">🧵 Threads</span>
              <span class="p-chip" style="--pc:#0dbd8b">💬 Matrix</span>
              <span class="p-chip" style="--pc:#5865f2">💜 Discord</span>
              <span class="p-chip" style="--pc:#ff0000">▶ YouTube</span>
              <span class="p-chip" style="--pc:#f1502f">🐙 GitHub</span>
              <span class="p-chip" style="--pc:#ffa500">📡 RSS</span>
              <span class="p-chip" style="--pc:#00b868">🍋 Lemmy</span>
              <span class="p-chip" style="--pc:#ff6719">✉ Substack</span>
              <span class="p-chip" style="--pc:#e74c3c">🎥 PeerTube</span>
              <span class="p-chip" style="--pc:#6364ff">🐘 GoToSocial</span>
            </div>
            <div class="marquee-content" aria-hidden="true">
              <span class="p-chip" style="--pc:#8b5cf6">🌩 Nostr</span>
              <span class="p-chip" style="--pc:#8a63d2">⚡ Farcaster</span>
              <span class="p-chip" style="--pc:#abfe2c">🔮 Lens</span>
              <span class="p-chip" style="--pc:#1185fe">🦋 Bluesky</span>
              <span class="p-chip" style="--pc:#6364ff">🐘 Mastodon</span>
              <span class="p-chip" style="--pc:#ff4500">🤖 Reddit</span>
              <span class="p-chip" style="--pc:#e74c3c">🎬 PeerTube</span>
              <span class="p-chip" style="--pc:#c44a8b">📸 PixelFed</span>
              <span class="p-chip" style="--pc:#888">🧵 Threads</span>
              <span class="p-chip" style="--pc:#0dbd8b">💬 Matrix</span>
              <span class="p-chip" style="--pc:#5865f2">💜 Discord</span>
              <span class="p-chip" style="--pc:#ff0000">▶ YouTube</span>
              <span class="p-chip" style="--pc:#f1502f">🐙 GitHub</span>
              <span class="p-chip" style="--pc:#ffa500">📡 RSS</span>
              <span class="p-chip" style="--pc:#00b868">🍋 Lemmy</span>
              <span class="p-chip" style="--pc:#ff6719">✉ Substack</span>
              <span class="p-chip" style="--pc:#e74c3c">🎥 PeerTube</span>
              <span class="p-chip" style="--pc:#6364ff">🐘 GoToSocial</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════ STATS SECTION ═══════════════ -->
      <section class="stats" id="stats" aria-labelledby="stats-title">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">✧</div>
            <div class="stat-value" data-count="10427">10,427+</div>
            <div class="stat-label">Tweets Posted</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⬡</div>
            <div class="stat-value">18</div>
            <div class="stat-label">Protocols Bridged</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">◈</div>
            <div class="stat-value">2,847+</div>
            <div class="stat-label">Identities Linked</div>
          </div>
        </div>
        <div class="stats-cta-wrapper">
          <a href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web" target="_blank" rel="noopener" class="stats-built-in-public">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
            Built in public — star on Forgejo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
          </a>
        </div>
      </section>

      <!-- ═══════════════ CTA FOOTER ═══════════════ -->
      <section class="cta-section" aria-labelledby="cta-title">
        <div class="cta-glow" aria-hidden="true"></div>
        <div class="cta-content">
          <div class="cta-icon">⚡</div>
          <h2 id="cta-title" class="cta-title">Ready to unify your social web?</h2>
          <p class="cta-sub">
            One feed. Every protocol. Your rules. Join thousands of users already bridging
            the decentralized social graph.
          </p>
          <a href="https://app.degenfeed.xyz" class="btn-glow btn-glow-large">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Connect Wallet
          </a>
          <p class="cta-assurance">No email required. No phone number. Just your wallet.</p>
          <div class="cta-checkmarks">
            <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Non-custodial</span>
            <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Open source</span>
            <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> No tracking</span>
            <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Free forever</span>
          </div>
        </div>
      </section>

    </main>

    <!-- ═══ FOOTER ═══ -->
    <footer class="footer" role="contentinfo">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="brand-mark" aria-hidden="true">&gt;_</span>
          <span>DegenFeed</span>
        </div>
        <p class="footer-tag">The social feed of web3.</p>
        <p class="footer-meta">Built by <strong>Rug Munch Media LLC</strong> · Wyoming, USA · Open source (MIT)</p>

        <nav class="footer-links" aria-label="Footer pages">
          <a href="/about">About</a>
          <span aria-hidden="true">·</span>
          <a href="/faq">FAQ</a>
          <span aria-hidden="true">·</span>
          <a href="/docs">Docs</a>
          <span aria-hidden="true">·</span>
          <a href="/status">Status</a>
          <span aria-hidden="true">·</span>
          <a href="/privacy">Privacy</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">Terms</a>
          <span aria-hidden="true">·</span>
          <a href="/community-guidelines">Rules</a>
        </nav>

        <nav class="footer-links footer-social" aria-label="Source code">
          <a href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web" target="_blank" rel="noopener">Forgejo</a>
          <span aria-hidden="true">·</span>
          <a href="https://codeberg.org/degenfeed/degenfeed-web" target="_blank" rel="noopener">Codeberg</a>
          <span aria-hidden="true">·</span>
          <a href="https://social.degenfeed.xyz" target="_blank" rel="noopener">degenfeed@social.degenfeed.xyz</a>
        </nav>
      </div>
    </footer>

    <script src="/app.js" defer></script>
  </body>
</html>`;

export const LANDING_CSS = `*,
*::before,
*::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #000000;
  --fg: #e7e9ea;
  --fg-secondary: #b0b3b8;
  --accent: #00ff41;
  --accent-soft: rgba(0,255,65,0.15);
  --accent-glow: rgba(0,255,65,0.12);
  --accent-glow-strong: rgba(0,255,65,0.25);
  --accent-secondary: #8b5cf6;
  --muted: #8b8f93;
  --border: #2f3336;
  --card: #0a0a0a;
  --card-hover: #111113;

  --font-heading: "Syne", "Inter", system-ui, sans-serif;
  --font-body: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}

html { scroll-behavior: smooth; color-scheme: dark; }

body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

/* ═══ Skip Link ═══ */
.skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 100;
  background: var(--accent); color: #000; padding: 8px 16px; font-weight: 600;
  border-radius: 0 0 var(--radius-sm) 0;
}
.skip-link:focus { left: 8px; top: 8px; }

/* ═══ Links ═══ */
a { color: var(--accent); text-decoration: none; transition: color 0.15s; }
a:hover { color: #10b981; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: var(--radius-sm); }

/* ═══ Navbar ═══ */
.navbar {
  position: sticky; top: 0; z-index: 50;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
  padding: 14px 24px;
  display: flex; justify-content: space-between; align-items: center;
  max-width: 1200px; margin: 0 auto;
}

.brand { display: flex; align-items: center; gap: 8px; color: var(--fg); font-weight: 700; font-size: 1.1rem; }
.brand-mark {
  font-family: var(--font-mono);
  color: var(--accent);
  background: #000;
  border: 1px solid var(--accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.nav { display: flex; gap: 20px; align-items: center; }
.nav a { color: var(--muted); font-size: 0.9rem; font-weight: 500; }
.nav a:hover { color: var(--fg); }
.nav-cta {
  background: var(--accent) !important;
  color: #000 !important;
  padding: 7px 16px;
  border-radius: var(--radius-full);
  font-weight: 700 !important;
  font-size: 0.9rem !important;
}
.nav-cta:hover { background: #00cc34 !important; color: #000 !important; }

/* ═══ Section Common ═══ */
.section-header {
  text-align: center;
  max-width: 640px;
  margin: 0 auto 48px;
  padding: 0 24px;
}

.section-title {
  font-family: var(--font-heading);
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 12px;
  letter-spacing: -0.03em;
}

.section-sub {
  color: var(--fg-secondary);
  font-size: 1rem;
  line-height: 1.6;
}

.gradient-text {
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary), #f91880);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ═══════════════ HERO ═══════════════ */
.hero {
  position: relative;
  overflow: hidden;
  padding: 80px 24px 60px;
  min-height: 85vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Aurora background */
.aurora-bg {
  position: absolute; inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.aurora-layer {
  position: absolute; inset: -100px;
  filter: blur(80px);
  will-change: transform;
}

.aurora-1 {
  background:
    radial-gradient(ellipse at 20% 50%, rgba(0,255,65,0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 40% 80%, rgba(0,255,65,0.04) 0%, transparent 50%);
  animation: aurora-pan-1 20s ease-in-out infinite;
}

.aurora-2 {
  background:
    radial-gradient(ellipse at 60% 30%, rgba(139,92,246,0.1) 0%, transparent 50%),
    radial-gradient(ellipse at 10% 70%, rgba(0,255,65,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 90% 60%, rgba(249,24,128,0.04) 0%, transparent 50%);
  animation: aurora-pan-2 25s ease-in-out infinite;
}

.aurora-3 {
  background:
    radial-gradient(ellipse at 30% 60%, rgba(0,255,65,0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.06) 0%, transparent 50%);
  animation: aurora-pan-1 30s ease-in-out infinite;
  opacity: 0.5;
}

@keyframes aurora-pan-1 {
  0%, 100% { transform: translateX(-20%) translateY(-10%) rotate(0deg); }
  50% { transform: translateX(10%) translateY(5%) rotate(2deg); }
}

@keyframes aurora-pan-2 {
  0%, 100% { transform: translateX(10%) translateY(-5%) rotate(0deg); }
  50% { transform: translateX(-15%) translateY(10%) rotate(-3deg); }
}

/* Grid overlay */
.hero-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 800px;
}

/* Badge */
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid rgba(0,255,65,0.2);
  margin-bottom: 24px;
  animation: fade-slide-up 0.6s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)) both;
}

.badge-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--accent); }
  50% { opacity: 0.5; box-shadow: 0 0 12px var(--accent); }
}

/* Title */
.hero-title {
  display: flex;
  flex-direction: column;
  gap: 0;
  animation: fade-slide-up 0.6s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)) 0.15s both;
}

.hero-gradient-line {
  font-family: var(--font-heading);
  font-size: clamp(2.5rem, 8vw, 5.5rem);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.05em;
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary), #f91880);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-fg-line {
  font-family: var(--font-heading);
  font-size: clamp(2.5rem, 8vw, 5.5rem);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.05em;
  color: var(--fg);
}

/* Sub */
.hero-sub {
  font-size: clamp(1rem, 2vw, 1.2rem);
  color: var(--fg-secondary);
  max-width: 560px;
  line-height: 1.6;
  margin-top: 20px;
  animation: fade-slide-up 0.6s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)) 0.3s both;
}

/* CTA Row */
.hero-cta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 32px;
  animation: fade-slide-up 0.6s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)) 0.45s both;
}

/* Glow Button */
.btn-glow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: var(--radius-xl);
  font-weight: 700;
  font-size: 1rem;
  color: #000;
  background: linear-gradient(135deg, var(--accent), #00cc34);
  border: none;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.btn-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 30px var(--accent-glow-strong), 0 0 60px var(--accent-glow);
}

.btn-glow:active {
  transform: translateY(0) scale(0.97);
}

.btn-glow-large {
  padding: 18px 40px;
  font-size: 1.15rem;
  border-radius: var(--radius-xl);
}

/* Outline Button */
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: var(--radius-xl);
  font-weight: 600;
  font-size: 1rem;
  color: var(--fg);
  background: transparent;
  border: 1.5px solid var(--border);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
  text-decoration: none;
}

.btn-outline:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
  transform: translateY(-1px);
}

.btn-outline:active {
  transform: translateY(0) scale(0.97);
}

/* Hero Stats */
.hero-stats {
  display: flex;
  gap: 40px;
  justify-content: center;
  margin-top: 48px;
  animation: fade-slide-up 0.6s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)) 0.6s both;
}

.hero-stat {
  text-align: center;
}

.hero-stat-value {
  display: block;
  font-family: var(--font-heading);
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  font-weight: 800;
  color: var(--accent);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.hero-stat-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 4px;
}

/* ═══════════════ FEATURES ═══════════════ */
.features {
  padding: 80px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  padding: 0;
}

.f-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 28px;
  transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
  position: relative;
  overflow: hidden;
}

.f-card:hover {
  transform: translateY(-4px);
  border-color: rgba(0,255,65,0.25);
  box-shadow: 0 8px 40px rgba(0,0,0,0.4), 0 0 30px var(--accent-glow);
}

.f-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  font-size: 1.2rem;
  margin-bottom: 16px;
  background: color-mix(in srgb, var(--fc-accent, var(--accent)) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--fc-accent, var(--accent)) 25%, transparent);
  transition: transform 0.3s ease;
}

.f-card:hover .f-card-icon {
  transform: scale(1.1);
}

.f-card-title {
  font-family: var(--font-heading);
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--fg);
}

.f-card-desc {
  font-size: 0.9rem;
  color: var(--fg-secondary);
  line-height: 1.6;
}

/* ═══════════════ PROTOCOL MARQUEE ═══════════════ */
.protocols {
  padding: 80px 0;
  max-width: 1200px;
  margin: 0 auto;
}

.marquee-wrapper {
  position: relative;
  overflow: hidden;
}

.marquee-edge {
  position: absolute; inset: 0;
  width: 80px;
  z-index: 2;
  pointer-events: none;
}

.marquee-edge.left {
  left: 0;
  background: linear-gradient(to right, #000, transparent);
}

.marquee-edge.right {
  right: 0;
  background: linear-gradient(to left, #000, transparent);
}

.marquee-track {
  display: flex;
  gap: 0;
  overflow: hidden;
  padding: 12px 0;
}

@keyframes marquee-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.marquee-content {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  animation: marquee-scroll 50s linear infinite;
  will-change: transform;
  padding: 0 5px;
}

.marquee-wrapper:hover .marquee-content {
  animation-play-state: paused;
}

.p-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-full);
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  background: color-mix(in srgb, var(--pc, var(--accent)) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--pc, var(--accent)) 25%, transparent);
  color: var(--pc, var(--accent));
  transition: all 0.15s ease;
  user-select: none;
}

.p-chip:hover {
  transform: scale(1.08);
  filter: brightness(1.2);
  box-shadow: 0 0 20px color-mix(in srgb, var(--pc, var(--accent)) 20%, transparent);
}

/* ═══════════════ STATS ═══════════════ */
.stats {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 48px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 800px;
  margin: 0 auto 24px;
}

.stat-card {
  text-align: center;
}

.stat-icon {
  font-size: 1.5rem;
  margin-bottom: 8px;
  color: var(--accent);
}

.stat-value {
  font-family: var(--font-heading);
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  font-weight: 800;
  color: var(--accent);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 4px;
}

.stats-cta-wrapper {
  text-align: center;
}

.stats-built-in-public {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-secondary);
  border: 1px solid var(--border);
  transition: all 0.2s ease;
}

.stats-built-in-public:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

/* ═══════════════ CTA SECTION ═══════════════ */
.cta-section {
  position: relative;
  overflow: hidden;
  padding: 80px 24px;
  text-align: center;
}

.cta-glow {
  position: absolute; inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 50%, var(--accent-glow) 0%, transparent 60%),
    radial-gradient(ellipse at 50% 80%, rgba(139,92,246,0.1) 0%, transparent 60%);
}

.cta-content {
  position: relative;
  z-index: 1;
  max-width: 600px;
  margin: 0 auto;
}

.cta-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xl);
  font-size: 1.5rem;
  margin: 0 auto 24px;
  background: var(--accent-soft);
  border: 1px solid rgba(0,255,65,0.2);
  color: var(--accent);
}

.cta-title {
  font-family: var(--font-heading);
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 12px;
}

.cta-sub {
  color: var(--fg-secondary);
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 32px;
}

.cta-assurance {
  color: var(--muted);
  font-size: 0.85rem;
  margin-top: 16px;
}

.cta-checkmarks {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 24px;
  font-size: 0.8rem;
  color: var(--muted);
}

.cta-checkmarks span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cta-checkmarks svg {
  color: var(--accent);
  flex-shrink: 0;
}

/* ═══════════════ FOOTER ═══════════════ */
.footer {
  border-top: 1px solid var(--border);
  padding: 48px 0 40px;
  text-align: center;
  background: linear-gradient(to top, rgba(0,255,65,0.02), transparent);
}

.footer-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.footer-brand { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 700; }
.footer-tag { color: var(--accent); font-size: 0.9rem; margin-bottom: 4px; }
.footer-meta { color: var(--muted); font-size: 0.8rem; margin-bottom: 16px; }
.footer-meta strong { color: var(--fg); }
.footer-links { display: flex; gap: 12px; justify-content: center; font-size: 0.85rem; color: var(--muted); flex-wrap: wrap; padding: 4px 0; }
.footer-links a { color: var(--muted); }
.footer-links a:hover { color: var(--accent); }
.footer-social { margin-top: 8px; font-size: 0.8rem; }

/* ═══════════════ ANIMATIONS ═══════════════ */
@keyframes fade-slide-up {
  0% { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

/* ═══════════════ RESPONSIVE ═══════════════ */
@media (max-width: 768px) {
  .navbar { flex-direction: column; gap: 12px; }
  .nav { flex-wrap: wrap; justify-content: center; gap: 12px; }
  .hero { padding: 60px 16px 40px; min-height: auto; }
  .hero-stats { gap: 24px; margin-top: 32px; flex-wrap: wrap; }
  .features-grid { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: 1fr; gap: 32px; }
  .cta-checkmarks { gap: 12px; }
}

@media (max-width: 480px) {
  .hero-cta { flex-direction: column; align-items: stretch; }
  .btn-glow, .btn-outline { justify-content: center; }
  .f-card { padding: 20px; }
}

/* ═══ Reduced Motion ═══ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .aurora-layer { display: none; }
  .hero-grid { mask-image: none; -webkit-mask-image: none; }
  .marquee-content { animation: none; }
  .gradient-text { background: none; -webkit-text-fill-color: var(--accent); }
}`;

export const LANDING_JS = `// DegenFeed landing page — minimal vanilla JS
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(a.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
// Landing page loaded`;

function htmlResponse(body: string, cacheSeconds = 300): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=${cacheSeconds}`,
      'content-security-policy':
        "default-src 'self'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        'font-src https://fonts.gstatic.com; ' +
        "script-src 'self' https://plausible.rugmunch.io; " +
        "img-src 'self' data:; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'none'",
    },
  });
}

function cssResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/css; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'content-security-policy':
        "default-src 'self'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        'font-src https://fonts.gstatic.com; ' +
        "script-src 'self' https://plausible.rugmunch.io; " +
        "img-src 'self' data:; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'none'",
    },
  });
}

function jsResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'content-security-policy':
        "default-src 'self'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        'font-src https://fonts.gstatic.com; ' +
        "script-src 'self' https://plausible.rugmunch.io; " +
        "img-src 'self' data:; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'none'",
    },
  });
}

export function handleLandingHtml(_request: Request, _env: unknown): Response {
  return htmlResponse(LANDING_HTML);
}

export function handleLandingCss(_request: Request, _env: unknown): Response {
  return cssResponse(LANDING_CSS);
}

export function handleLandingJs(_request: Request, _env: unknown): Response {
  return jsResponse(LANDING_JS);
}
