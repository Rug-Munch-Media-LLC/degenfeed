import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const iceshrimpBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Iceshrimp',
      item: 'https://app.degenfeed.xyz/feed/iceshrimp',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Iceshrimp Feed — Decentralized Content | DegenFeed',
  description: 'Browse Iceshrimp content aggregated in your DegenFeed timeline.',
  keywords: ['iceshrimp feed', 'iceshrimp content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Iceshrimp Feed — DegenFeed',
    description: 'Iceshrimp content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/iceshrimp',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/iceshrimp' },
};

export default function IceshrimpFeedPage() {
  return (
    <>
      <Script id="breadcrumb-iceshrimp-feed" type="application/ld+json">
        {JSON.stringify(iceshrimpBreadcrumb)}
      </Script>
      <ProtocolFeed source="iceshrimp" />
    </>
  );
}
