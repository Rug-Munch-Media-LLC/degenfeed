import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feed',
  description:
    'Your unified web3 social feed. Posts from Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS in reverse-chronological order.',
  openGraph: {
    title: 'DegenFeed — Your Unified Feed',
    description:
      'Every social protocol, one feed. Browse Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.',
    url: 'https://app.degenfeed.xyz/feed',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Feed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — Your Unified Feed',
    description: 'Every social protocol, one feed.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed' },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
