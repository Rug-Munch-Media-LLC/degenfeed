import type { Metadata } from 'next';
import Script from 'next/script';

const spacesBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Spaces', item: 'https://app.degenfeed.xyz/spaces' },
  ],
};

export const metadata: Metadata = {
  title: 'Spaces — Web3 Live Audio Rooms & Crypto Social Spaces',
  description:
    'Join live audio rooms and spaces across Nostr, Farcaster, and the fediverse. Host web3 conversations, connect with the crypto community, and discover decentralized social audio.',
  keywords: [
    'web3 audio rooms', 'crypto social spaces', 'decentralized audio',
    'nostr spaces', 'farcaster audio', 'fediverse live audio',
    'crypto voice chat',
  ],
  openGraph: {
    title: 'Spaces — Web3 Live Audio Rooms & Crypto Social Spaces | DegenFeed',
    description:
      'Join live audio rooms across Nostr, Farcaster, and the fediverse. Host web3 conversations.',
    url: 'https://app.degenfeed.xyz/spaces',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed web3 spaces — live audio rooms across Nostr, Farcaster, fediverse',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spaces — Web3 Audio | DegenFeed',
    description:
      'Live audio rooms across Nostr, Farcaster, and the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/spaces' },
};

export default function SpacesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-spaces" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(spacesBreadcrumb) }} />
      {children}
    </>
  );
}
