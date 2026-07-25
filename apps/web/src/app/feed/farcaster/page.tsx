import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const farcasterBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Farcaster',
      item: 'https://app.degenfeed.xyz/feed/farcaster',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Farcaster Feed — Decentralized Social Casts | DegenFeed',
  description:
    'Browse Farcaster casts, frames, and trending content. Sufficiently decentralized social network aggregated in your DegenFeed timeline.',
  keywords: ['farcaster feed', 'farcaster casts', 'decentralized social', 'farcaster frames'],
  openGraph: {
    title: 'Farcaster Feed — DegenFeed',
    description: 'Farcaster casts and frames from across the network.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/farcaster' },
};

export default function FarcasterFeedPage() {
  return (
    <>
      <Script id="breadcrumb-farcaster-feed" type="application/ld+json">
        {JSON.stringify(farcasterBreadcrumb)}
      </Script>
      <ProtocolFeed source="farcaster" />
    </>
  );
}
