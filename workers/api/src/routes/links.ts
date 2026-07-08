/**
 * Link tree page for Rug Munch Media — all products, one page.
 * Served at rugmunch.io/links
 */

export function handleLinksPage(_request: Request, _env: unknown): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rug Munch Media — Products & Links</title>
<meta name="description" content="Rug Munch Media LLC — building the future of web3 infrastructure. Rug Munch Intelligence, DegenFeed, WalletPress, Pryscraper.">
<meta property="og:title" content="Rug Munch Media — Products & Links">
<meta property="og:description" content="Rug Munch Intelligence, DegenFeed, WalletPress, Pryscraper. Open-source web3 infrastructure.">
<meta property="og:url" content="https://rugmunch.io/links">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', system-ui, sans-serif; background: #000; color: #fff; min-height: 100vh; }
.container { max-width: 640px; margin: 0 auto; padding: 40px 24px 80px; }

.header { text-align: center; margin-bottom: 48px; }
.avatar { width: 88px; height: 88px; border-radius: 50%; border: 2px solid rgba(34,197,94,0.3); margin: 0 auto 16px; background: linear-gradient(135deg, #0a2a0f, #000); display: flex; align-items: center; justify-content: center; font-size: 36px; }
.name { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
.name span { color: #22c55e; }
.tagline { margin-top: 8px; font-size: 15px; color: #888; font-weight: 500; }

.product { display: block; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px 24px; margin-bottom: 12px; text-decoration: none; color: inherit; background: rgba(255,255,255,0.02); transition: all 0.2s; }
.product:hover { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.04); }
.product.primary { border-color: rgba(34,197,94,0.2); background: rgba(34,197,94,0.05); }
.product.primary:hover { border-color: rgba(34,197,94,0.5); background: rgba(34,197,94,0.08); }

.product-header { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.product-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.product-name { font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
.product-badge { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; padding: 2px 8px; border-radius: 100px; background: rgba(34,197,94,0.15); color: #22c55e; }
.product-desc { font-size: 13px; color: #888; line-height: 1.5; margin-top: 4px; }
.product-meta { margin-top: 8px; font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #555; }

.section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin: 32px 0 12px; padding-left: 4px; }

.social-link { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; margin-bottom: 8px; text-decoration: none; color: #ccc; font-size: 14px; transition: all 0.2s; }
.social-link:hover { border-color: rgba(255,255,255,0.15); color: #fff; background: rgba(255,255,255,0.03); }
.social-icon { font-size: 20px; width: 32px; text-align: center; flex-shrink: 0; }

.footer { text-align: center; margin-top: 48px; font-size: 12px; color: #444; }
.footer a { color: #666; text-decoration: none; }
.footer a:hover { color: #22c55e; }
</style>
</head>
<body>
<div class="container">

<div class="header">
  <div class="avatar">🛡️</div>
  <h1 class="name">Rug Munch <span>Media</span></h1>
  <p class="tagline">building open-source web3 infrastructure</p>
</div>

<div class="section-title">Products</div>

<a href="https://rugmunch.io" class="product primary">
  <div class="product-header">
    <div class="product-icon" style="background:rgba(34,197,94,0.12);color:#22c55e">🛡️</div>
    <div class="product-name">Rug Munch Intelligence</div>
    <div class="product-badge">Flagship</div>
  </div>
  <p class="product-desc">The Bloomberg Terminal of Shitcoins. 234 crypto security tools across 13 chains. Rug pull detection, honeypot checks, wallet intelligence, AI investigation reports. Pay per use via x402 — no API keys.</p>
  <p class="product-meta">rugmunch.io · 13 chains · 234 tools · 194K labeled wallets</p>
</a>

<a href="https://degenfeed.xyz" class="product">
  <div class="product-header">
    <div class="product-icon" style="background:rgba(139,92,246,0.12);color:#a78bfa">◈</div>
    <div class="product-name">DegenFeed</div>
  </div>
  <p class="product-desc">Open-source web3 social aggregator. 10 protocols, one window. Browse Nostr, Farcaster, Lens, Bluesky, Mastodon, Lemmy, Threads, Reddit, and RSS in a unified, ranked timeline. No account needed.</p>
  <p class="product-meta">degenfeed.xyz · 10 protocols · 550+ RSS sources · 93 YouTube channels</p>
</a>

<a href="https://walletpress.rugmunch.io" class="product">
  <div class="product-header">
    <div class="product-icon" style="background:rgba(99,102,241,0.12);color:#818cf8">👛</div>
    <div class="product-name">WalletPress</div>
  </div>
  <p class="product-desc">Crypto wallet infrastructure + WordPress plugin. Wallet engine, x402 payment service, chain vault, self-hosted wallet management. Accept crypto payments on any WordPress site.</p>
  <p class="product-meta">walletpress.rugmunch.io · FastAPI · WordPress · Docker</p>
</a>

<a href="https://pry.rugmunch.io" class="product">
  <div class="product-header">
    <div class="product-icon" style="background:rgba(234,179,8,0.12);color:#facc15">🕷️</div>
    <div class="product-name">Pryscraper</div>
  </div>
  <p class="product-desc">Multi-source crypto intelligence crawler. FastAPI + Docker. CLI, MCP server, and SDK for automated data collection. Scraper, extractor, parser, automator, job queue with referral proxy rotation.</p>
  <p class="product-meta">pry.rugmunch.io · MCP Server · Python CLI · Docker</p>
</a>

<div class="section-title">Social & Code</div>

<a href="https://social.degenfeed.xyz/@cryptorugmunch" class="social-link">
  <span class="social-icon">🐘</span> @cryptorugmunch@degenfeed.xyz — Fediverse (Mastodon/GotoSocial)
</a>
<a href="https://x.com/cryptorugmunch" class="social-link">
  <span class="social-icon">𝕏</span> @cryptorugmunch — X / Twitter
</a>
<a href="https://t.me/cryptorugmunch" class="social-link">
  <span class="social-icon">✈</span> @cryptorugmunch — Telegram
</a>
<a href="https://git.rugmunch.io" class="social-link">
  <span class="social-icon">⎔</span> git.rugmunch.io — Forgejo (all repos)
</a>
<a href="https://gitlab.com/cryptorugmuncher" class="social-link">
  <span class="social-icon">◈</span> GitLab — Public mirrors & CI
</a>

<div class="section-title">Contact</div>

<a href="mailto:admin@rugmunch.io" class="social-link">
  <span class="social-icon">✉</span> admin@rugmunch.io
</a>
<a href="https://rugmunch.io" class="social-link">
  <span class="social-icon">🌐</span> rugmunch.io — Rug Munch Intelligence
</a>
<a href="https://degenfeed.xyz" class="social-link">
  <span class="social-icon">◈</span> degenfeed.xyz — DegenFeed Aggregator
</a>

<div class="footer">
  <p>Rug Munch Media LLC © 2026 · Built with ❤️ on open protocols</p>
  <p style="margin-top:4px"><a href="https://rugmunch.io/links">rugmunch.io/links</a></p>
</div>

</div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html',
      'cache-control': 'public, max-age=3600',
    },
  });
}
