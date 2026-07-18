/** @type {import("next").NextConfig} */
const nextConfig = {
  output: 'standalone',

  // ── Compression (Brotli/gzip) for TTFB ──
  compress: true,
  generateEtags: true,

  // ── Security headers ──
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
    '@degenfeed/types',
    '@degenfeed/feed-core',
    '@degenfeed/feed-providers',
    '@degenfeed/ranking',
    '@degenfeed/nostr-sdk',
    '@degenfeed/storage',
    '@degenfeed/auth',
    '@degenfeed/identity',
    '@degenfeed/ui',
  ],

  // ── Headers for caching & security ──
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Cache static assets aggressively
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          // API responses: revalidate often, but allow CDN caching
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/((?!api|_next/static|favicon|icon|manifest).*)',
        headers: [
          // HTML pages: short cache, revalidate
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=30',
          },
          // Security headers
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
