import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const owncastBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Owncast',
      item: 'https://app.degenfeed.xyz/feed/owncast',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Owncast Feed — Decentralized Content | DegenFeed',
  description: 'Browse Owncast content aggregated in your DegenFeed timeline.',
  keywords: ['owncast feed', 'owncast content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Owncast Feed — DegenFeed',
    description: 'Owncast content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/owncast',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/owncast' },
};

export default function OwncastFeedPage() {
  return (
    <>
      <Script id="breadcrumb-owncast-feed" type="application/ld+json">
        {JSON.stringify(owncastBreadcrumb)}
      </Script>
      <ProtocolFeed source="owncast" />
    </>
  );
}
