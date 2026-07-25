import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const yggdrasilBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Yggdrasil',
      item: 'https://app.degenfeed.xyz/feed/yggdrasil',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Yggdrasil Feed — Decentralized Content | DegenFeed',
  description: 'Browse Yggdrasil content aggregated in your DegenFeed timeline.',
  keywords: ['yggdrasil feed', 'yggdrasil content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Yggdrasil Feed — DegenFeed',
    description: 'Yggdrasil content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/yggdrasil',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/yggdrasil' },
};

export default function YggdrasilFeedPage() {
  return (
    <>
      <Script id="breadcrumb-yggdrasil-feed" type="application/ld+json">
        {JSON.stringify(yggdrasilBreadcrumb)}
      </Script>
      <ProtocolFeed source="yggdrasil" />
    </>
  );
}
