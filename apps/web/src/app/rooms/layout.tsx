import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rooms — DegenFeed',
  description:
    'Cross-platform group messaging. Create rooms that span Nostr, Matrix, Farcaster, Bluesky, and Telegram.',
  openGraph: {
    title: 'Rooms — DegenFeed',
    description: 'Cross-platform group messaging across Nostr, Matrix, Farcaster, Bluesky, and Telegram.',
    url: 'https://app.degenfeed.xyz/rooms',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Rooms',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rooms — DegenFeed',
    description: 'Cross-platform group messaging.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/rooms' },
};

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
