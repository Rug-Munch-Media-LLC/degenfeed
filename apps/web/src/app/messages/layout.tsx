import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DegenChat — Chat across every protocol | DegenFeed',
  description:
    'DegenChat — cross-protocol messaging across Nostr, Farcaster, Mastodon, Bluesky, Lens, Matrix, and XMPP. Send and receive encrypted DMs from one inbox.',
  openGraph: {
    title: 'DegenChat — Chat across every protocol',
    description:
      'Cross-protocol messaging across Nostr, Farcaster, Mastodon, Bluesky, Lens, Matrix, and XMPP.',
    url: 'https://app.degenfeed.xyz/messages',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenChat — Chat across every protocol',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenChat — Chat across every protocol',
    description: 'Cross-protocol messaging across every open protocol.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/messages' },
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
