import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trending',
  description:
    'Trending topics across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS. See what the web3 social graph is talking about right now.',
};

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
