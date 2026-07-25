import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const bonfireBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Bonfire',
      item: 'https://app.degenfeed.xyz/feed/bonfire',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Bonfire Feed — Decentralized Content | DegenFeed',
  description: 'Browse Bonfire content aggregated in your DegenFeed timeline.',
  keywords: ['bonfire feed', 'bonfire content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Bonfire Feed — DegenFeed',
    description: 'Bonfire content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/bonfire',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/bonfire' },
};

export default function BonfireFeedPage() {
  return (
    <>
      <Script id="breadcrumb-bonfire-feed" type="application/ld+json">
        {JSON.stringify(bonfireBreadcrumb)}
      </Script>
      <ProtocolFeed source="bonfire" />
    </>
  );
}
