import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const aetherBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Aether',
      item: 'https://app.degenfeed.xyz/feed/aether',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Aether Feed — Decentralized Content | DegenFeed',
  description: 'Browse Aether content aggregated in your DegenFeed timeline.',
  keywords: ['aether feed', 'aether content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Aether Feed — DegenFeed',
    description: 'Aether content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/aether',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/aether' },
};

export default function AetherFeedPage() {
  return (
    <>
      <Script id="breadcrumb-aether-feed" type="application/ld+json">
        {JSON.stringify(aetherBreadcrumb)}
      </Script>
      <ProtocolFeed source="aether" />
    </>
  );
}
