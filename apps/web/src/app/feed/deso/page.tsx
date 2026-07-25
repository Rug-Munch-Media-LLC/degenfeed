import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const desoBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'DeSo',
      item: 'https://app.degenfeed.xyz/feed/deso',
    },
  ],
};

export const metadata: Metadata = {
  title: 'DeSo Feed — Decentralized Content | DegenFeed',
  description: 'Browse DeSo content aggregated in your DegenFeed timeline.',
  keywords: ['deso feed', 'deso content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'DeSo Feed — DegenFeed',
    description: 'DeSo content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/deso',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/deso' },
};

export default function DeSoFeedPage() {
  return (
    <>
      <Script id="breadcrumb-deso-feed" type="application/ld+json">
        {JSON.stringify(desoBreadcrumb)}
      </Script>
      <ProtocolFeed source="deso" />
    </>
  );
}
