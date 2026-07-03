/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output as static export for Cloudflare Pages
  output: 'export',
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    '@degenfeed/types',
    '@degenfeed/feed-core',
    '@degenfeed/ranking',
    '@degenfeed/nostr-sdk',
    '@degenfeed/storage',
    '@degenfeed/auth',
    '@degenfeed/identity',
    '@degenfeed/ui',
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
