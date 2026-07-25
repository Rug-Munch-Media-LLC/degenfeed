import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const audiusBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Audius',
      item: 'https://app.degenfeed.xyz/feed/audius',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Audius Feed — Decentralized Content | DegenFeed',
  description: 'Browse Audius content aggregated in your DegenFeed timeline.',
  keywords: ['audius feed', 'audius content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Audius Feed — DegenFeed',
    description: 'Audius content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/audius',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/audius' },
};

export default function AudiusFeedPage() {
  return (
    <>
      <Script id="breadcrumb-audius-feed" type="application/ld+json">
        {JSON.stringify(audiusBreadcrumb)}
      </Script>
      <ProtocolFeed source="audius" />
    </>
  );
}
