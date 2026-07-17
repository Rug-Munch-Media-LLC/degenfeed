import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discover - DegenFeed',
  description:
    'Trending posts, communities, and people across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.',
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
