import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Custom Feeds — DegenFeed',
  description:
    'Create and manage custom multi-protocol feeds. Mix Nostr, Farcaster, Lens, Bluesky, Mastodon, RSS, and Reddit into personalized timelines.',
  openGraph: {
    title: 'Custom Feeds — DegenFeed',
    description: 'Build personalized multi-protocol feeds on DegenFeed.',
    url: 'https://app.degenfeed.xyz/feeds',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Custom Feeds',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Custom Feeds — DegenFeed',
    description: 'Build personalized multi-protocol feeds on DegenFeed.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feeds' },
};

export default function FeedsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
