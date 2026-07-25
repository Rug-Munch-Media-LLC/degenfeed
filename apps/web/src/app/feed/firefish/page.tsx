import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const firefishBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Firefish',
      item: 'https://app.degenfeed.xyz/feed/firefish',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Firefish Feed — Decentralized Content | DegenFeed',
  description: 'Browse Firefish content aggregated in your DegenFeed timeline.',
  keywords: ['firefish feed', 'firefish content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Firefish Feed — DegenFeed',
    description: 'Firefish content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/firefish',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/firefish' },
};

export default function FirefishFeedPage() {
  return (
    <>
      <Script id="breadcrumb-firefish-feed" type="application/ld+json">
        {JSON.stringify(firefishBreadcrumb)}
      </Script>
      <ProtocolFeed source="firefish" />
    </>
  );
}
