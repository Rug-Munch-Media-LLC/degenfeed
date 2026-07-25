import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const dtubeBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'DTube',
      item: 'https://app.degenfeed.xyz/feed/dtube',
    },
  ],
};

export const metadata: Metadata = {
  title: 'DTube Feed — Decentralized Content | DegenFeed',
  description: 'Browse DTube content aggregated in your DegenFeed timeline.',
  keywords: ['dtube feed', 'dtube content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'DTube Feed — DegenFeed',
    description: 'DTube content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/dtube',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/dtube' },
};

export default function DTubeFeedPage() {
  return (
    <>
      <Script id="breadcrumb-dtube-feed" type="application/ld+json">
        {JSON.stringify(dtubeBreadcrumb)}
      </Script>
      <ProtocolFeed source="dtube" />
    </>
  );
}
