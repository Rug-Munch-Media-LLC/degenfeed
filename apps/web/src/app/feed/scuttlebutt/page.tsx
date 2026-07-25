import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const scuttlebuttBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Scuttlebutt',
      item: 'https://app.degenfeed.xyz/feed/scuttlebutt',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Scuttlebutt Feed — Decentralized Content | DegenFeed',
  description: 'Browse Scuttlebutt content aggregated in your DegenFeed timeline.',
  keywords: ['scuttlebutt feed', 'scuttlebutt content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Scuttlebutt Feed — DegenFeed',
    description: 'Scuttlebutt content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/scuttlebutt',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/scuttlebutt' },
};

export default function ScuttlebuttFeedPage() {
  return (
    <>
      <Script id="breadcrumb-scuttlebutt-feed" type="application/ld+json">
        {JSON.stringify(scuttlebuttBreadcrumb)}
      </Script>
      <ProtocolFeed source="scuttlebutt" />
    </>
  );
}
