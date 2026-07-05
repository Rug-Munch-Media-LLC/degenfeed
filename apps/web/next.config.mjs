/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    '@degenfeed/types',
    '@degenfeed/feed-core',
    '@degenfeed/ranking',
    '@degenfeed/identity',
    '@degenfeed/storage',
    '@degenfeed/auth',
    '@degenfeed/nostr-sdk',
    '@degenfeed/bluesky-sdk',
    '@degenfeed/farcaster-sdk',
    '@degenfeed/lens-sdk',
    '@degenfeed/threads-sdk',
    '@degenfeed/mastodon-sdk',
    '@degenfeed/rss-sdk',
    '@degenfeed/ui',
  ],
};

export default nextConfig;
