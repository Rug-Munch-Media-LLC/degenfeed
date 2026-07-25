import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const akkomaBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Akkoma',
      item: 'https://app.degenfeed.xyz/feed/akkoma',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Akkoma Feed — Decentralized Content | DegenFeed',
  description: 'Browse Akkoma content aggregated in your DegenFeed timeline.',
  keywords: ['akkoma feed', 'akkoma content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Akkoma Feed — DegenFeed',
    description: 'Akkoma content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/akkoma',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/akkoma' },
};

export default function AkkomaFeedPage() {
  return (
    <>
      <Script id="breadcrumb-akkoma-feed" type="application/ld+json">
        {JSON.stringify(akkomaBreadcrumb)}
      </Script>
      <ProtocolFeed source="akkoma" />
    </>
  );
}
