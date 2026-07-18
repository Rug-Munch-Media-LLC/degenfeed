import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spaces — DegenFeed',
  description:
    'Live audio rooms and spaces across Nostr, Farcaster, and the fediverse. Join conversations, host your own space, and connect with the web3 community.',
  openGraph: {
    title: 'Spaces — DegenFeed',
    description: 'Live audio rooms across Nostr, Farcaster, and the fediverse.',
    url: 'https://app.degenfeed.xyz/spaces',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Spaces',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spaces — DegenFeed',
    description: 'Live audio rooms across Nostr, Farcaster, and the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/spaces' },
};

export default function SpacesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
