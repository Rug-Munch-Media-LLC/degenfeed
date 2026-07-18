import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages — DegenFeed',
  description:
    'Cross-protocol direct messages. Send and receive encrypted DMs across Nostr, Farcaster, Lens, and Bluesky.',
  openGraph: {
    title: 'Messages — DegenFeed',
    description: 'Cross-protocol direct messages across Nostr, Farcaster, Lens, and Bluesky.',
    url: 'https://app.degenfeed.xyz/messages',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Messages',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Messages — DegenFeed',
    description: 'Cross-protocol direct messages.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/messages' },
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
