/** @type {import("next").NextConfig} */

// ── API proxy: /api/* → self-hosted API (replaces Cloudflare Worker) ──
// The browser hits same-origin /api/* paths; the rewrites() below forward
// catch-all ones (e.g. /api/feed/unified, /api/feed/{protocol},
// /api/analytics, /api/creator/earnings) to the self-hosted API.
// Exact-match route handlers (src/app/api/**) still run first and proxy
// through src/app/api/_proxy.ts (afterFiles fires before dynamic routes).
//
// API_PROXY_TARGET is a RUNTIME env var:
//   - Docker:   http://<bridge-host>:8787 (bridge container/host — reachable
//     from the web container; pass as build ARG so rewrites() bake it in)
//   - local dev: http://localhost:8787 (default — the bridge, only live feed server)
//
// NOTE: rewrites() is evaluated at BUILD time in standalone output, so the
// value must also be passed as a build ARG (API_PROXY_TARGET) when building
// the Docker image. The runtime env var alone does NOT change baked rewrites.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8787';

const nextConfig = {
  output: process.env.CF_PAGES ? undefined : 'standalone',

  // ── Compression (Brotli/gzip) for TTFB ──
  compress: true,
  generateEtags: true,

  // ── Security headers are set in middleware.ts (per-request, with nonces) ──
  poweredByHeader: false,

  // ── HTTP keep-alive for faster connection reuse ──
  httpAgentOptions: {
    keepAlive: true,
  },

  // ── Image optimization ──
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.degenfeed.xyz' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 'cdn.bsky.app' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: '**.ipfs.dweb.link' },
      { protocol: 'https', hostname: 'arweave.net' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '**.social' },
      { protocol: 'https', hostname: '**.cloudflare-ipfs.com' },
      // ── Author profile pictures (native protocol sources) ──
      // Nostr kind-0 pictures
      { protocol: 'https', hostname: 'nostr.build' },
      { protocol: 'https', hostname: '**.nostr.build' },
      { protocol: 'https', hostname: 'm.primal.net' },
      { protocol: 'https', hostname: 'void.cat' },
      { protocol: 'https', hostname: 'nostr.download' },
      // Farcaster PFPs (Neynar CDN + Farcaster hub CDN)
      { protocol: 'https', hostname: 'imagedelivery.net' },
      { protocol: 'https', hostname: 'cdn.farcaster.xyz' },
      // Mastodon / ActivityPub instance media (media.*, files.*, cdn.*)
      { protocol: 'https', hostname: '**.mastodon.social' },
      { protocol: 'https', hostname: '**.bitcoinhackers.org' },
      { protocol: 'https', hostname: '**.hachyderm.io' },
      { protocol: 'https', hostname: '**.fosstodon.org' },
      { protocol: 'https', hostname: '**.infosec.exchange' },
      { protocol: 'https', hostname: '**.cryptodon.lol' },
      { protocol: 'https', hostname: '**.mas.to' },
      { protocol: 'https', hostname: '**.mstdn.social' },
      { protocol: 'https', hostname: '**.techhub.social' },
      { protocol: 'https', hostname: '**.mastodon.online' },
      { protocol: 'https', hostname: '**.mastodon.world' },
      { protocol: 'https', hostname: '**.mastodon.art' },
      { protocol: 'https', hostname: '**.hackers.town' },
      { protocol: 'https', hostname: '**.mastodon.cloud' },
      { protocol: 'https', hostname: '**.universeodon.com' },
      { protocol: 'https', hostname: '**.floss.social' },
      { protocol: 'https', hostname: '**.norden.social' },
      { protocol: 'https', hostname: '**.mastodon.ie' },
      { protocol: 'https', hostname: '**.todon.eu' },
      { protocol: 'https', hostname: '**.social.treehouse.systems' },
      { protocol: 'https', hostname: '**.metalhead.club' },
      { protocol: 'https', hostname: '**.mastodon.green' },
      { protocol: 'https', hostname: '**.masto.host' },
      // RSS feed image / favicon fallback
      { protocol: 'https', hostname: 'www.google.com' },
    ],
    // Minimum cache TTL for optimized images — reduces repeated origin fetches
    minimumCacheTTL: 86400,
  },

  // ── Monorepo transpilation ──
  transpilePackages: [
    '@degenfeed/auth',
    '@degenfeed/bluesky-sdk',
    '@degenfeed/creator-coin',
    '@degenfeed/farcaster-sdk',
    '@degenfeed/feed-core',
    '@degenfeed/feed-providers',
    '@degenfeed/identity',
    '@degenfeed/lens-sdk',
    '@degenfeed/monetization',
    '@degenfeed/nostr-sdk',
    '@degenfeed/peertube-provider',
    '@degenfeed/ranking',
    '@degenfeed/realtime',
    '@degenfeed/source-discovery',
    '@degenfeed/spaces-bridge',
    '@degenfeed/storage',
    '@degenfeed/types',
    '@degenfeed/ui',
    '@degenfeed/utils',
    '@degenfeed/web3',
    '@degenfeed/youtube-provider',
  ],

  // ── Headers for caching ──
  async headers() {
    return [
      // Static assets with content hash: 1 year immutable
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Public static assets (fonts, images, icons): 1 year
      {
        source: '/:path*.(svg|png|jpg|jpeg|gif|webp|avif|ico|woff2|woff|ttf|eot|css)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // API responses: no browser cache, short CDN TTL
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      // HTML pages: short cache, revalidate
      {
        source: '/((?!api|_next/static|_next/image|favicon|icon|manifest|sw\\.js).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=30',
          },
        ],
      },
    ];
  },

  // ── Host-aware root routing ──
  // degenfeed.xyz/ → marketing landing page (page.tsx)
  // app.degenfeed.xyz/ → Twitter-clone feed with left sidebar
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'app.degenfeed.xyz' }],
        destination: '/feed',
        permanent: false,
      },
      {
        source: '/',
        has: [{ type: 'host', value: 'm.degenfeed.xyz' }],
        destination: '/feed',
        permanent: false,
      },
    ];
  },

  // Note: Next.js 16 removed the `eslint` config option. Linting runs via
  // Type errors FAIL the build (quality gate). apps/web is tsc-clean as of
  // 2026-08-25 quality push; keep it that way.
  typescript: { ignoreBuildErrors: false },

  // ── API proxy rewrite: /api/* → self-hosted API ──
  // afterFiles (default) position: exact route handlers are checked first,
  // then this rewrite catches the remaining /api/* paths (feed catch-alls,
  // analytics, creator earnings, etc.) and forwards them to the self-hosted
  // API at apiProxyTarget. See the API_PROXY_TARGET note at the top.
  async rewrites() {
    // REMOVED the /api/:path* -> API_PROXY_TARGET rewrite (2026-08-31):
    // afterFiles rewrites run BEFORE dynamic route segments, so this rewrite
    // intercepted /api/feed/{catch-all} paths (rss, nostr, threads, peertube)
    // and forwarded them to the bridge WITHOUT the BRIDGE_API_KEY -> 401.
    // Dedicated routes (home, mastodon) matched first and worked, which made
    // the bug invisible for the most-used feeds. Every /api/* path now has a
    // route handler (dedicated or [...slug] catch-all) that proxies via
    // _proxy.ts with proper bridge auth.
    return [];
  },
};

export default nextConfig;
