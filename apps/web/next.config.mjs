/** @type {import("next").NextConfig} */
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
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Public static assets (fonts, images, icons): 1 year
      {
        source: '/:path*.(svg|png|jpg|jpeg|gif|webp|avif|ico|woff2|woff|ttf|eot|css)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // API responses: no browser cache, short CDN TTL
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=120' },
        ],
      },
      // HTML pages: short cache, revalidate
      {
        source: '/((?!api|_next/static|_next/image|favicon|icon|manifest|sw\\.js).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=30' },
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
  // `biome check` in CI. Type errors are pre-existing; they are validated
  // separately with `tsc --noEmit` in CI (see apps/web/package.json).
  typescript: { ignoreBuildErrors: false }, // Pre-existing type issues with Next.js 16 async params
};

export default nextConfig;
