import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const hiveBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Hive',
      item: 'https://app.degenfeed.xyz/feed/hive',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Hive Feed — Decentralized Content | DegenFeed',
  description: 'Browse Hive content aggregated in your DegenFeed timeline.',
  keywords: ['hive feed', 'hive content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Hive Feed — DegenFeed',
    description: 'Hive content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/hive',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/hive' },
};

export default function HiveFeedPage() {
  return (
    <>
      <Script id="breadcrumb-hive-feed" type="application/ld+json">
        {JSON.stringify(hiveBreadcrumb)}
      </Script>
      <ProtocolFeed source="hive" />
    </>
  );
}
