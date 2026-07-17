/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  images: { unoptimized: true },
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
