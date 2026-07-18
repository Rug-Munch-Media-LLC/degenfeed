import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trending',
  description:
    'Trending topics across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS. See what the web3 social graph is talking about right now.',
  openGraph: {
    title: 'Trending — DegenFeed',
    description:
      'See what the web3 social graph is talking about right now. Trending topics across all protocols.',
    url: 'https://app.degenfeed.xyz/trending',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Trending on DegenFeed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trending — DegenFeed',
    description: 'See what the web3 social graph is talking about right now.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/trending' },
};

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
