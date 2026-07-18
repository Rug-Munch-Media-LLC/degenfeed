import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search — DegenFeed',
  description:
    'Cross-protocol search across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS. Find posts, people, and communities across the open social web.',
  openGraph: {
    title: 'Search — DegenFeed',
    description: 'Search across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more.',
    url: 'https://app.degenfeed.xyz/search',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Search',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Search — DegenFeed',
    description: 'Cross-protocol search across the open social web.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/search' },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
