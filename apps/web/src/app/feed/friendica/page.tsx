import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const friendicaBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Friendica',
      item: 'https://app.degenfeed.xyz/feed/friendica',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Friendica Feed — Decentralized Content | DegenFeed',
  description: 'Browse Friendica content aggregated in your DegenFeed timeline.',
  keywords: ['friendica feed', 'friendica content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Friendica Feed — DegenFeed',
    description: 'Friendica content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/friendica',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/friendica' },
};

export default function FriendicaFeedPage() {
  return (
    <>
      <Script id="breadcrumb-friendica-feed" type="application/ld+json">
        {JSON.stringify(friendicaBreadcrumb)}
      </Script>
      <ProtocolFeed source="friendica" />
    </>
  );
}
