import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const steemBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Steem',
      item: 'https://app.degenfeed.xyz/feed/steem',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Steem Feed — Decentralized Content | DegenFeed',
  description: 'Browse Steem content aggregated in your DegenFeed timeline.',
  keywords: ['steem feed', 'steem content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Steem Feed — DegenFeed',
    description: 'Steem content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/steem',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/steem' },
};

export default function SteemFeedPage() {
  return (
    <>
      <Script id="breadcrumb-steem-feed" type="application/ld+json">
        {JSON.stringify(steemBreadcrumb)}
      </Script>
      <ProtocolFeed source="steem" />
    </>
  );
}
