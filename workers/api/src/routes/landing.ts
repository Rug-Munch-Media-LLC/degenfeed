/**
 * Landing page assets — served by the Worker at degenfeed.xyz/
 * and www.degenfeed.xyz/ to bypass the tunnel/port-80 mismatch.
 */

export const LANDING_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#000000" />
    <meta name="color-scheme" content="dark" />
    <title>DegenFeed — The social feed of web3</title>
    <meta name="description" content="Browse Nostr, Farcaster, Lens, Bluesky, Threads, Mastodon, Reddit, and RSS from one window. Zero sign-ups required. Sign in with one key to like and reply. Compose once, cross-post everywhere." />
    <meta property="og:title" content="DegenFeed — The social feed of web3" />
    <meta property="og:description" content="Browse 7 protocols + RSS from one window. Zero sign-ups. One composer, all networks." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://degenfeed.xyz" />
    <meta property="og:image" content="https://degenfeed.xyz/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/favicon.svg" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "DegenFeed",
        "url": "https://degenfeed.xyz",
        "description": "Open-source multi-protocol social aggregator for web3. Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS in one feed. Zero sign-ups required.",
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
    <header class="topbar" role="banner">
      <a href="/" class="brand" aria-label="DegenFeed home">
        <span class="brand-mark" aria-hidden="true">&gt;_</span>
        <span class="brand-name">DegenFeed</span>
      </a>
      <nav class="nav" aria-label="Primary">
        <a href="#how">How it works</a>
        <a href="#protocols">Protocols</a>
        <a href="/docs">Docs</a>
        <a href="/newsletter">Newsletter</a>
        <a href="/premium">Premium</a>
        <a href="https://social.degenfeed.xyz" target="_blank" rel="noopener">Mastodon</a>
        <a href="https://app.degenfeed.xyz" class="nav-cta">Open feed →</a>
      </nav>
    </header>
    <main id="main">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="hero-inner">
          <div class="hero-badges">
            <span class="badge badge-green">✦ Now live — 14 networks</span>
            <span class="badge badge-gray">Open source</span>
            <span class="badge badge-blue">No sign-up needed</span>
          </div>
          <h1 id="hero-title" class="hero-title">
            One window. <span class="accent">Every</span> network.
          </h1>
          <p class="hero-pitch">
            Browse Nostr, Farcaster, Lens, Bluesky, Threads, <strong>Mastodon</strong>, Reddit, RSS,<br />
            PeerTube, YouTube, Discord, Matrix, GitHub, and more — from one interface.
          </p>
          <div class="hero-cta">
            <a href="https://app.degenfeed.xyz" class="btn btn-primary btn-large">Open the feed →</a>
            <a href="#how" class="btn btn-secondary">How it works</a>
          </div>
          <div class="protocol-strip" id="protocols">
            <div class="ps-item" style="--pcolor: #8e30eb"><span class="ps-dot"></span>Nostr</div>
            <div class="ps-item" style="--pcolor: #8a63d2"><span class="ps-dot"></span>Farcaster</div>
            <div class="ps-item" style="--pcolor: #abfe2c"><span class="ps-dot"></span>Lens</div>
            <div class="ps-item" style="--pcolor: #1185fe"><span class="ps-dot"></span>Bluesky</div>
            <div class="ps-item" style="--pcolor: #888"><span class="ps-dot"></span>Threads</div>
            <div class="ps-item" style="--pcolor: #6364ff"><span class="ps-dot"></span>Mastodon</div>
            <div class="ps-item" style="--pcolor: #ff4500"><span class="ps-dot"></span>Reddit</div>
            <div class="ps-item" style="--pcolor: #ffa500"><span class="ps-dot"></span>RSS</div>
          </div>
          <div class="stats-row">
            <div class="stat"><span class="stat-value">14</span><span class="stat-label">Protocols</span></div>
            <div class="stat"><span class="stat-value">353</span><span class="stat-label">RSS sources</span></div>
            <div class="stat"><span class="stat-value">10M+</span><span class="stat-label">Reachable users</span></div>
            <div class="stat"><span class="stat-value">∞</span><span class="stat-label">Free reads</span></div>
          </div>
        </div>
      </section>
      <section class="how" id="how" aria-labelledby="how-title">
        <h2 id="how-title" class="section-title">
          <span class="bracket" aria-hidden="true">[</span>How it works<span class="bracket" aria-hidden="true">]</span>
        </h2>
        <div class="how-grid">
          <article class="card">
            <div class="card-num" aria-hidden="true">01</div>
            <h3>Open the app. See everything.</h3>
            <p>No sign-up, no wallet, no key. All 14 protocols and RSS feeds load immediately. <strong>Zero friction.</strong></p>
          </article>
          <article class="card">
            <div class="card-num" aria-hidden="true">02</div>
            <h3>Connect your identity.</h3>
            <p>Nostr key, Farcaster signer, Lens wallet, Bluesky password, Mastodon token — whatever you have. Sign in to like, reply, repost natively on that network. Your key <strong>never leaves your browser.</strong></p>
          </article>
          <article class="card">
            <div class="card-num" aria-hidden="true">03</div>
            <h3>Cross-post everywhere.</h3>
            <p>Link multiple accounts and compose once. DegenFeed publishes the same post to Nostr, Farcaster, Lens, Bluesky, Threads, and Mastodon in parallel. Partial success? Failed networks retry in the background.</p>
          </article>
          <article class="card">
            <div class="card-num" aria-hidden="true">04</div>
            <h3>Ranked, transparent, yours.</h3>
            <p>Every post is scored with a public algorithm — recency, engagement, source quality, niche relevance. No black box. You can override any weight.</p>
          </article>
        </div>
      </section>
      <section class="what" aria-labelledby="what-title">
        <h2 id="what-title" class="section-title">
          <span class="bracket" aria-hidden="true">[</span>What we are<span class="bracket" aria-hidden="true">]</span>
        </h2>
        <div class="what-grid">
          <div class="what-card">
            <div class="what-icon">⊞</div>
            <h3>A client, not a network</h3>
            <p>We don't own your data. We don't host your posts. DegenFeed is a window onto the existing open social graph — we read from public APIs and sign actions with your keys.</p>
          </div>
          <div class="what-card">
            <div class="what-icon">🐘</div>
            <h3>Mastodon-compatible server</h3>
            <p>We run a <a href="https://social.degenfeed.xyz" target="_blank" rel="noopener">GotoSocial instance</a> at <code>social.degenfeed.xyz</code>. <a href="https://social.degenfeed.xyz" target="_blank" rel="noopener" style="color:#6364ff;text-decoration:underline">Create a free @degenfeed.xyz account</a> in 30 seconds. Username + password, no email required. Your posts federate with the wider fediverse automatically.</p>
          </div>
          <div class="what-card">
            <div class="what-icon">◆</div>
            <h3>Open source &amp; free</h3>
            <p>Licensed under MIT. Self-hostable. Public API. No tokens, no ads, no tracking. Operating cost at scale is minimal — <strong>DegenFeed can run forever without charging.</strong></p>
          </div>
        </div>
      </section>
      <section class="protocol-details" aria-labelledby="pd-title">
        <h2 id="pd-title" class="section-title">
          <span class="bracket" aria-hidden="true">[</span>14 protocols, 1 feed<span class="bracket" aria-hidden="true">]</span>
        </h2>
        <div class="pd-grid">
          <article class="pd-card" style="--pcolor:#8e30eb"><div class="pd-icon">☰</div><h3>Nostr</h3><p class="pd-desc">Decentralized relay-based notes. Keys, not accounts.</p><span class="pd-stat">500K+ pubkeys</span></article>
          <article class="pd-card" style="--pcolor:#8a63d2"><div class="pd-icon">◈</div><h3>Farcaster</h3><p class="pd-desc">Sufficiently decentralized social with hubs.</p><span class="pd-stat">700K+ FIDs</span></article>
          <article class="pd-card" style="--pcolor:#abfe2c"><div class="pd-icon">◎</div><h3>Lens</h3><p class="pd-desc">User-owned social graph on Polygon.</p><span class="pd-stat">100K+ profiles</span></article>
          <article class="pd-card" style="--pcolor:#1185fe"><div class="pd-icon">☁</div><h3>Bluesky</h3><p class="pd-desc">AT Protocol social. Public AppView API.</p><span class="pd-stat">5M+ users</span></article>
          <article class="pd-card" style="--pcolor:#888"><div class="pd-icon">+</div><h3>Threads</h3><p class="pd-desc">Instagram's AT Protocol network. Free reads.</p><span class="pd-stat">200M+ reachable</span></article>
          <article class="pd-card" style="--pcolor:#6364ff"><div class="pd-icon">M</div><h3>Mastodon</h3><p class="pd-desc">Self-hosted GotoSocial. Create a free @degenfeed.xyz account in 30 seconds.</p><span class="pd-stat"><a href="https://social.degenfeed.xyz" target="_blank" rel="noopener" style="color:#6364ff;text-decoration:underline">Create account →</a></span></article>
          <article class="pd-card" style="--pcolor:#ff4500"><div class="pd-icon">R</div><h3>Reddit</h3><p class="pd-desc">Free RSS feeds. No API key required.</p><span class="pd-stat">137 subs</span></article>
          <article class="pd-card" style="--pcolor:#ffa500"><div class="pd-icon">A</div><h3>RSS + Articles</h3><p class="pd-desc">Mirror, Substack, Medium, Paragraph, and any feed URL.</p><span class="pd-stat">353 sources</span></article>
          <article class="pd-card" style="--pcolor:#e74ccc"><div class="pd-icon">▶</div><h3>YouTube</h3><p class="pd-desc">Video content from creator channels.</p><span class="pd-stat">Feeds + discovery</span></article>
          <article class="pd-card" style="--pcolor:#f96854"><div class="pd-icon">P</div><h3>PeerTube</h3><p class="pd-desc">Federated video + livestreaming.</p><span class="pd-stat">Self-hosted instance</span></article>
          <article class="pd-card" style="--pcolor:#5865f2"><div class="pd-icon">#</div><h3>Discord</h3><p class="pd-desc">Connect servers, bridge announcements, cross-post to channels.</p><span class="pd-stat">Webhook bridge</span></article>
          <article class="pd-card" style="--pcolor:#0dbd8b"><div class="pd-icon">M</div><h3>Matrix</h3><p class="pd-desc">Open federation messaging bridge to rooms.</p><span class="pd-stat">Decentralized chat</span></article>
          <article class="pd-card" style="--pcolor:#f1502f"><div class="pd-icon">◆</div><h3>GitHub</h3><p class="pd-desc">Dev-focused: repo releases, PRs, stars → DegenFeed.</p><span class="pd-stat">Post releases</span></article>
          <article class="pd-card" style="--pcolor:#333"><div class="pd-icon">☐</div><h3>Webhooks</h3><p class="pd-desc">Connect any service. Custom triggers for posts, tips, streams.</p><span class="pd-stat">Any service</span></article>
          <article class="pd-card" style="--pcolor:#ee4c2c"><div class="pd-icon">✉</div><h3>Email Newsletter</h3><p class="pd-desc">Send digests to subscribers via SendGrid/Mailgun/SMTP.</p><span class="pd-stat">Send &amp; manage</span></article>
          <article class="pd-card" style="--pcolor:#ff6719"><div class="pd-icon">S</div><h3>Substack / Ghost</h3><p class="pd-desc">Auto-cross-post newsletter articles to all protocols.</p><span class="pd-stat">RSS bridge</span></article>
        </div>
      </section>
      <section class="stack" aria-labelledby="stack-title">
        <h2 id="stack-title" class="section-title">
          <span class="bracket" aria-hidden="true">[</span>Built with<span class="bracket" aria-hidden="true">]</span>
        </h2>
        <div class="stack-grid">
          <span class="stack-item">TypeScript</span>
          <span class="stack-item">Next.js 15</span>
          <span class="stack-item">Cloudflare Workers</span>
          <span class="stack-item">Cloudflare Pages</span>
          <span class="stack-item">GotoSocial</span>
          <span class="stack-item">SQLite</span>
          <span class="stack-item">Tailwind</span>
          <span class="stack-item">pnpm monorepo</span>
          <span class="stack-item">RMI DataBus</span>
          <span class="stack-item">IndexedDB</span>
          <span class="stack-item">16 SDK packages</span>
          <span class="stack-item">16 test suites</span>
        </div>
      </section>
      <section class="manifesto" aria-labelledby="manifesto-title">
        <h2 id="manifesto-title" class="section-title">
          <span class="bracket" aria-hidden="true">[</span>Why this exists<span class="bracket" aria-hidden="true">]</span>
        </h2>
        <div class="manifesto-content">
          <p>The open social graph is fractured across a dozen protocols, each with its own app, its own feed, its own set of accounts to manage.</p>
          <p><strong>DegenFeed is the window that sees them all.</strong></p>
          <p>One UI. One composer. One ranked feed. 10 protocols. 353 RSS sources. Zero accounts required to read. Sign in with what you already have to write.</p>
          <p class="manifesto-tagline">The graph belongs to the protocols. The window belongs to you.</p>
        </div>
      </section>
      <section class="cta-final" id="launch" aria-labelledby="cta-title">
        <div class="cta-card">
          <h2 id="cta-title" class="cta-title">Ready to use it?</h2>
          <p class="cta-sub">The feed is live. No waitlist. No tokens. No sign-up required.</p>
          <div class="cta-buttons">
            <a href="https://app.degenfeed.xyz" class="btn btn-primary btn-large">Open feed →</a>
            <a href="https://social.degenfeed.xyz" target="_blank" rel="noopener" class="btn btn-secondary">Create @degenfeed.xyz account</a>
          </div>
        </div>
      </section>
    </main>
    <footer class="footer" role="contentinfo">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="brand-mark" aria-hidden="true">&gt;_</span>
          <span>DegenFeed</span>
        </div>
        <p class="footer-tag">The social feed of web3.</p>
        <p class="footer-meta">Built by <strong>Rug Munch Media LLC</strong> · Wyoming, USA · Open source (MIT)</p>
        <nav class="footer-links" aria-label="Footer">
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
          <a href="/legal">Legal</a>
          <span aria-hidden="true">·</span>
          <a href="/community-guidelines">Rules</a>
        </nav>
        <nav class="footer-links footer-social" aria-label="Source code">
          <a href="https://git.rugmunch.io/RugMunchMedia/degenfeed-web" target="_blank" rel="noopener">Forgejo</a>
          <span aria-hidden="true">·</span>
          <a href="https://gitlab.com/cryptorugmuncher/degenfeed-web" target="_blank" rel="noopener">GitLab</a>
          <span aria-hidden="true">·</span>
          <a href="https://codeberg.org/cryptorugmunch/degenfeed-web" target="_blank" rel="noopener">Codeberg</a>
          <span aria-hidden="true">·</span>
          <a href="https://social.degenfeed.xyz" target="_blank" rel="noopener">@cryptorugmunch@degenfeed.xyz</a>
        </nav>
      </div>
    </footer>
    <script src="/app.js" defer></script>
  </body>
</html>`;

export const LANDING_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0a0a0a;
  --fg: #e5e7eb;
  --accent: #00ff41;
  --accent-2: #10b981;
  --muted: #6b7280;
  --card: #111827;
  --border: #1f2937;
}
html { scroll-behavior: smooth; }
body {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 100;
  background: var(--accent); color: #000; padding: 8px 16px; font-weight: 600;
}
.skip-link:focus { left: 8px; top: 8px; }
a { color: var(--accent); text-decoration: none; transition: color 0.15s; }
a:hover { color: var(--accent-2); }
.topbar {
  position: sticky; top: 0; z-index: 50;
  background: rgba(10,10,10,0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  display: flex; justify-content: space-between; align-items: center;
  max-width: 1200px; margin: 0 auto;
}
.brand { display: flex; align-items: center; gap: 8px; color: var(--fg); font-weight: 700; font-size: 1.1rem; }
.brand-mark {
  font-family: ui-monospace, monospace;
  color: var(--accent);
  background: #000;
  border: 1px solid var(--accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9rem;
}
.nav { display: flex; gap: 24px; align-items: center; }
.nav a { color: var(--muted); font-size: 0.95rem; }
.nav a:hover { color: var(--fg); }
.nav-cta {
  background: var(--accent) !important;
  color: #000 !important;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 600 !important;
}
.nav-cta:hover { background: var(--accent-2) !important; }
main { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section-title {
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  margin: 80px 0 40px;
  color: var(--fg);
}
.section-title .bracket { color: var(--accent); margin: 0 8px; }
.hero { padding: 80px 0 60px; position: relative; }
.hero-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(0,255,65,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,65,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%);
  pointer-events: none;
}
.hero-inner { position: relative; }
.hero-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--border);
}
.badge-green { background: rgba(0,255,65,0.1); color: var(--accent); border-color: rgba(0,255,65,0.3); }
.badge-gray { background: #1f2937; color: var(--muted); }
.badge-blue { background: rgba(59,130,246,0.1); color: #60a5fa; border-color: rgba(59,130,246,0.3); }
.hero-title {
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}
.accent { color: var(--accent); }
.hero-pitch {
  font-size: 1.15rem;
  color: var(--muted);
  max-width: 640px;
  margin-bottom: 32px;
}
.hero-pitch strong { color: var(--fg); }
.hero-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 40px; }
.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}
.btn-primary { background: var(--accent); color: #000; }
.btn-primary:hover { background: var(--accent-2); transform: translateY(-1px); }
.btn-secondary { background: #1f2937; color: var(--fg); border: 1px solid var(--border); }
.btn-secondary:hover { background: #374151; }
.btn-large { padding: 16px 32px; font-size: 1.1rem; }
.protocol-strip {
  display: flex; gap: 16px; flex-wrap: wrap;
  padding: 20px 0; border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}
.ps-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.85rem; color: var(--pcolor, var(--muted));
  font-weight: 500;
}
.ps-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--pcolor, var(--muted));
  box-shadow: 0 0 8px var(--pcolor, transparent);
}
.stats-row { display: flex; gap: 32px; flex-wrap: wrap; }
.stat { display: flex; flex-direction: column; }
.stat-value { font-size: 1.8rem; font-weight: 800; color: var(--accent); }
.stat-label { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.how-grid, .what-grid, .pd-grid, .stack-grid { display: grid; gap: 16px; }
.how-grid, .pd-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.what-grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.stack-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
}
.card:hover {
  border-color: rgba(0,255,65,0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.card-num { font-family: ui-monospace, monospace; color: var(--accent); font-size: 0.8rem; margin-bottom: 8px; }
.card h3 { font-size: 1.1rem; margin-bottom: 8px; color: var(--fg); }
.card p { color: var(--muted); font-size: 0.95rem; }
.card p strong { color: var(--fg); }
.what-icon { font-size: 2rem; margin-bottom: 12px; }
.pd-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
.pd-icon { font-size: 1.8rem; margin-bottom: 8px; color: var(--pcolor, var(--accent)); }
.pd-card h3 { font-size: 1rem; margin-bottom: 4px; }
.pd-desc { font-size: 0.85rem; color: var(--muted); margin-bottom: 8px; }
.pd-stat { font-size: 0.8rem; color: var(--pcolor, var(--accent)); font-weight: 600; }
.pd-stat a { color: var(--pcolor, var(--accent)); }
.stack-item {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted);
  font-family: ui-monospace, monospace;
}
.manifesto-content { max-width: 640px; margin: 0 auto; }
.manifesto-content p { margin-bottom: 16px; color: var(--muted); font-size: 1.05rem; }
.manifesto-content p strong { color: var(--accent); }
.manifesto-tagline { color: var(--fg); font-size: 1.2rem !important; font-weight: 600; text-align: center; margin-top: 32px !important; }
.cta-final { padding: 60px 0 80px; text-align: center; }
.cta-card {
  background: linear-gradient(135deg, rgba(0,255,65,0.08), rgba(16,185,129,0.05));
  border: 1px solid rgba(0,255,65,0.2);
  border-radius: 16px;
  padding: 48px 24px;
  max-width: 640px; margin: 0 auto;
}
.cta-title { font-size: 2rem; font-weight: 800; margin-bottom: 8px; }
.cta-sub { color: var(--muted); margin-bottom: 24px; }
.cta-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.footer {
  border-top: 1px solid var(--border);
  padding: 48px 0 40px;
  text-align: center;
  background: linear-gradient(to top, rgba(0,255,65,0.03), transparent);
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
@media (max-width: 640px) {
  .topbar { flex-direction: column; gap: 12px; }
  .nav { flex-wrap: wrap; justify-content: center; }
  .section-title { font-size: 1.5rem; margin: 48px 0 24px; }
  .stats-row { gap: 16px; }
  .stat-value { font-size: 1.4rem; }
}`;

export const LANDING_JS = `// DegenFeed landing page — minimal vanilla JS
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(a.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
console.log('[DegenFeed] Landing page loaded');`;

function htmlResponse(body: string, cacheSeconds = 300): Response {
	return new Response(body, {
		status: 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": `public, max-age=${cacheSeconds}`,
		},
	});
}

function cssResponse(body: string): Response {
	return new Response(body, {
		status: 200,
		headers: {
			"content-type": "text/css; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
}

function jsResponse(body: string): Response {
	return new Response(body, {
		status: 200,
		headers: {
			"content-type": "application/javascript; charset=utf-8",
			"cache-control": "public, max-age=3600",
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
