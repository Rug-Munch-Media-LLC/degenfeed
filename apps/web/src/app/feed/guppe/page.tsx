import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const guppeBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Guppe',
      item: 'https://app.degenfeed.xyz/feed/guppe',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Guppe Feed — Decentralized Content | DegenFeed',
  description: 'Browse Guppe content aggregated in your DegenFeed timeline.',
  keywords: ['guppe feed', 'guppe content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Guppe Feed — DegenFeed',
    description: 'Guppe content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/guppe',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/guppe' },
};

export default function GuppeFeedPage() {
  return (
    <>
      <Script id="breadcrumb-guppe-feed" type="application/ld+json">
        {JSON.stringify(guppeBreadcrumb)}
      </Script>
      <ProtocolFeed source="guppe" />
    </>
  );
}
