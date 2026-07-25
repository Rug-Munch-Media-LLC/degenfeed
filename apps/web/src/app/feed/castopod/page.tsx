import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const castopodBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Castopod',
      item: 'https://app.degenfeed.xyz/feed/castopod',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Castopod Feed — Decentralized Content | DegenFeed',
  description: 'Browse Castopod content aggregated in your DegenFeed timeline.',
  keywords: ['castopod feed', 'castopod content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Castopod Feed — DegenFeed',
    description: 'Castopod content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/castopod',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/castopod' },
};

export default function CastopodFeedPage() {
  return (
    <>
      <Script id="breadcrumb-castopod-feed" type="application/ld+json">
        {JSON.stringify(castopodBreadcrumb)}
      </Script>
      <ProtocolFeed source="castopod" />
    </>
  );
}
