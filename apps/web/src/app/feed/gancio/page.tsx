import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Gancio Events',
      item: 'https://app.degenfeed.xyz/feed/gancio',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Gancio Events — Federated Event Calendar | DegenFeed',
  description: 'Real-world events, meetups and hackathons from the federated Gancio network.',
  keywords: ['gancio feed', 'decentralized social', 'fediverse', 'gancio'],
  openGraph: {
    title: 'Gancio Events — DegenFeed',
    description: 'Real-world events, meetups and hackathons from the federated Gancio network.',
    url: 'https://app.degenfeed.xyz/feed/gancio',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/gancio' },
};

export default function GancioFeedPage() {
  return (
    <>
      <Script id="breadcrumb-gancio-feed" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      <ProtocolFeed source="gancio" />
    </>
  );
}
