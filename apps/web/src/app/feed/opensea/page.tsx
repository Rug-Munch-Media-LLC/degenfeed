import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const openseaBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'OpenSea',
      item: 'https://app.degenfeed.xyz/feed/opensea',
    },
  ],
};

export const metadata: Metadata = {
  title: 'OpenSea NFT Feed — Real-Time Marketplace Activity | DegenFeed',
  description: 'Browse real-time NFT sales, listings & trending collections from OpenSea.',
  keywords: ['opensea feed', 'nft marketplace', 'nft sales', 'digital art', 'ethereum nft'],
  openGraph: {
    title: 'OpenSea NFT Feed — DegenFeed',
    description: 'Real-time NFT marketplace activity aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/opensea',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/opensea' },
};

export default function OpenSeaFeedPage() {
  return (
    <>
      <Script id="breadcrumb-opensea-feed" type="application/ld+json">
        {JSON.stringify(openseaBreadcrumb)}
      </Script>
      <ProtocolFeed source="opensea" />
    </>
  );
}
