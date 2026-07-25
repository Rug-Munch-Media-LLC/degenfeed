import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const mitraBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Mitra',
      item: 'https://app.degenfeed.xyz/feed/mitra',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Mitra Feed — Decentralized Content | DegenFeed',
  description: 'Browse Mitra content aggregated in your DegenFeed timeline.',
  keywords: ['mitra feed', 'mitra content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Mitra Feed — DegenFeed',
    description: 'Mitra content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/mitra',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/mitra' },
};

export default function MitraFeedPage() {
  return (
    <>
      <Script id="breadcrumb-mitra-feed" type="application/ld+json">
        {JSON.stringify(mitraBreadcrumb)}
      </Script>
      <ProtocolFeed source="mitra" />
    </>
  );
}
