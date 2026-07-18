import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Discover — DegenFeed',
  description:
    'Trending posts, communities, and people across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.',
  openGraph: {
    title: 'Discover — DegenFeed',
    description:
      'Discover trending posts, communities, and people across the open social web.',
    url: 'https://app.degenfeed.xyz/discover',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Discover DegenFeed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discover — DegenFeed',
    description: 'Discover trending posts and communities across the open social web.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/discover' },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
