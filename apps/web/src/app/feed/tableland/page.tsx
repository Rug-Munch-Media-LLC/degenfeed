import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const tablelandBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Tableland',
      item: 'https://app.degenfeed.xyz/feed/tableland',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Tableland Feed — Decentralized Content | DegenFeed',
  description: 'Browse Tableland content aggregated in your DegenFeed timeline.',
  keywords: ['tableland feed', 'tableland content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Tableland Feed — DegenFeed',
    description: 'Tableland content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/tableland',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/tableland' },
};

export default function TablelandFeedPage() {
  return (
    <>
      <Script id="breadcrumb-tableland-feed" type="application/ld+json">
        {JSON.stringify(tablelandBreadcrumb)}
      </Script>
      <ProtocolFeed source="tableland" />
    </>
  );
}
