import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const raribleBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Rarible',
      item: 'https://app.degenfeed.xyz/feed/rarible',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Rarible Feed — Decentralized Content | DegenFeed',
  description: 'Browse Rarible content aggregated in your DegenFeed timeline.',
  keywords: ['rarible feed', 'rarible content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Rarible Feed — DegenFeed',
    description: 'Rarible content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/rarible',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/rarible' },
};

export default function RaribleFeedPage() {
  return (
    <>
      <Script id="breadcrumb-rarible-feed" type="application/ld+json">
        {JSON.stringify(raribleBreadcrumb)}
      </Script>
      <ProtocolFeed source="rarible" />
    </>
  );
}
