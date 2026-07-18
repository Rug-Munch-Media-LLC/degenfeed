import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Communities — DegenFeed',
  description:
    'Browse cross-protocol communities. Discover groups, channels, and collectives across Nostr, Farcaster, Lemmy, and the fediverse.',
  openGraph: {
    title: 'Communities — DegenFeed',
    description:
      'Browse cross-protocol communities across Nostr, Farcaster, Lemmy, and the fediverse.',
    url: 'https://app.degenfeed.xyz/communities',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Communities',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Communities — DegenFeed',
    description:
      'Browse cross-protocol communities across Nostr, Farcaster, Lemmy, and the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/communities' },
};

export default function CommunitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
