import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const funkwhaleBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Funkwhale',
      item: 'https://app.degenfeed.xyz/feed/funkwhale',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Funkwhale Feed — Decentralized Content | DegenFeed',
  description: 'Browse Funkwhale content aggregated in your DegenFeed timeline.',
  keywords: ['funkwhale feed', 'funkwhale content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Funkwhale Feed — DegenFeed',
    description: 'Funkwhale content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/funkwhale',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/funkwhale' },
};

export default function FunkwhaleFeedPage() {
  return (
    <>
      <Script id="breadcrumb-funkwhale-feed" type="application/ld+json">
        {JSON.stringify(funkwhaleBreadcrumb)}
      </Script>
      <ProtocolFeed source="funkwhale" />
    </>
  );
}
