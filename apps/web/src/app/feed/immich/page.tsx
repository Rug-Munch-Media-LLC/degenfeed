import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const immichBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Immich',
      item: 'https://app.degenfeed.xyz/feed/immich',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Immich Feed — Decentralized Content | DegenFeed',
  description: 'Browse Immich content aggregated in your DegenFeed timeline.',
  keywords: ['immich feed', 'immich content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Immich Feed — DegenFeed',
    description: 'Immich content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/immich',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/immich' },
};

export default function ImmichFeedPage() {
  return (
    <>
      <Script id="breadcrumb-immich-feed" type="application/ld+json">
        {JSON.stringify(immichBreadcrumb)}
      </Script>
      <ProtocolFeed source="immich" />
    </>
  );
}
