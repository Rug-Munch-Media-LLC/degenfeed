import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Creator Studio — DegenFeed',
  description:
    'Your unified creator dashboard: scheduling, analytics, monetization, and cross-protocol publishing across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.',
};

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
