import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const mediagoblinBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'MediaGoblin',
      item: 'https://app.degenfeed.xyz/feed/mediagoblin',
    },
  ],
};

export const metadata: Metadata = {
  title: 'MediaGoblin Feed — Decentralized Content | DegenFeed',
  description: 'Browse MediaGoblin content aggregated in your DegenFeed timeline.',
  keywords: ['mediagoblin feed', 'mediagoblin content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'MediaGoblin Feed — DegenFeed',
    description: 'MediaGoblin content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/mediagoblin',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/mediagoblin' },
};

export default function MediaGoblinFeedPage() {
  return (
    <>
      <Script id="breadcrumb-mediagoblin-feed" type="application/ld+json">
        {JSON.stringify(mediagoblinBreadcrumb)}
      </Script>
      <ProtocolFeed source="mediagoblin" />
    </>
  );
}
