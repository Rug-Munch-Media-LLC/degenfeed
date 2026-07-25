import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const lbryBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'LBRY',
      item: 'https://app.degenfeed.xyz/feed/lbry',
    },
  ],
};

export const metadata: Metadata = {
  title: 'LBRY Feed — Decentralized Content | DegenFeed',
  description: 'Browse LBRY content aggregated in your DegenFeed timeline.',
  keywords: ['lbry feed', 'lbry content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'LBRY Feed — DegenFeed',
    description: 'LBRY content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/lbry',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/lbry' },
};

export default function LBRYFeedPage() {
  return (
    <>
      <Script id="breadcrumb-lbry-feed" type="application/ld+json">
        {JSON.stringify(lbryBreadcrumb)}
      </Script>
      <ProtocolFeed source="lbry" />
    </>
  );
}
