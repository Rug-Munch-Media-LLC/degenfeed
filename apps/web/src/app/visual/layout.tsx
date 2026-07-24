import type { Metadata } from 'next';
import Script from 'next/script';

const breadcrumbStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Visual Feed',
      item: 'https://app.degenfeed.xyz/visual',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Visual Feed — Photos, NFTs & Videos from Every Platform',
  description:
    'Unified visual feed aggregating photos from Pixelfed, NFTs from Zora, and media posts from Bluesky, Nostr, Farcaster, and GoToSocial. Browse, tip, mint, and collect in one Instagram-like experience.',
  keywords: [
    'visual feed',
    'photo feed',
    'nft gallery',
    'pixelfed photos',
    'zora nfts',
    'bluesky photos',
    'decentralized social media',
    'masonry grid',
    'creator tipping',
    'nft minting',
    'cross-platform visual feed',
  ],
  openGraph: {
    title: 'DegenFeed Visual Feed — Photos, NFTs & Videos',
    description:
      'Browse photos from Pixelfed, NFTs from Zora, and media from Bluesky, Nostr, and Farcaster in one unified Instagram-like experience. Tip creators, mint NFTs, and collect creator coins.',
    url: 'https://app.degenfeed.xyz/visual',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-visual.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Visual Feed — unified photo, NFT, and video feed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed Visual Feed — Photos, NFTs & Videos',
    description:
      'Every visual platform, one feed. Photos from Pixelfed, NFTs from Zora, media from Bluesky and more.',
    images: ['https://app.degenfeed.xyz/og-visual.png'],
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/visual' },
};

export default function VisualLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-visual" type="application/ld+json">
        {JSON.stringify(breadcrumbStructuredData)}
      </Script>
      {children}
    </>
  );
}
