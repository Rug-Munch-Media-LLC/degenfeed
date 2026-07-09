import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
  description:
    'Browse DegenFeed by protocol or topic. Explore Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS feeds.',
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
