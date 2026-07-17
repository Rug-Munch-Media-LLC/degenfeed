/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.degenfeed.xyz' },
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
  },
  transpilePackages: [
    "@degenfeed/types",
    "@degenfeed/feed-core",
    "@degenfeed/ranking",
    "@degenfeed/nostr-sdk",
    "@degenfeed/storage",
    "@degenfeed/auth",
    "@degenfeed/identity",
    "@degenfeed/ui",
  ],
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;
