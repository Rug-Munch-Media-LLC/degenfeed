import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications — DegenFeed',
  description:
    'Your notifications across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more. Replies, likes, reposts, follows, and tips in one place.',
  openGraph: {
    title: 'Notifications — DegenFeed',
    description: 'Cross-protocol notifications for replies, likes, reposts, and tips.',
    url: 'https://app.degenfeed.xyz/notifications',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Notifications',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notifications — DegenFeed',
    description: 'Cross-protocol notifications.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/notifications' },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
