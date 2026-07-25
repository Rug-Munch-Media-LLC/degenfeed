import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const ceramicBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Ceramic',
      item: 'https://app.degenfeed.xyz/feed/ceramic',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Ceramic Feed — Decentralized Content | DegenFeed',
  description: 'Browse Ceramic content aggregated in your DegenFeed timeline.',
  keywords: ['ceramic feed', 'ceramic content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Ceramic Feed — DegenFeed',
    description: 'Ceramic content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/ceramic',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/ceramic' },
};

export default function CeramicFeedPage() {
  return (
    <>
      <Script id="breadcrumb-ceramic-feed" type="application/ld+json">
        {JSON.stringify(ceramicBreadcrumb)}
      </Script>
      <ProtocolFeed source="ceramic" />
    </>
  );
}
