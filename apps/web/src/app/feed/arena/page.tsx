import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const arenaBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Arena',
      item: 'https://app.degenfeed.xyz/feed/arena',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Arena Feed — Decentralized Content | DegenFeed',
  description: 'Browse Arena content aggregated in your DegenFeed timeline.',
  keywords: ['arena feed', 'arena content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Arena Feed — DegenFeed',
    description: 'Arena content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/arena',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/arena' },
};

export default function ArenaFeedPage() {
  return (
    <>
      <Script id="breadcrumb-arena-feed" type="application/ld+json">
        {JSON.stringify(arenaBreadcrumb)}
      </Script>
      <ProtocolFeed source="arena" />
    </>
  );
}
