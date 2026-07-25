import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const streamsBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Streams',
      item: 'https://app.degenfeed.xyz/feed/streams',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Streams Feed — Decentralized Content | DegenFeed',
  description: 'Browse Streams content aggregated in your DegenFeed timeline.',
  keywords: ['streams feed', 'streams content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Streams Feed — DegenFeed',
    description: 'Streams content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/streams',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/streams' },
};

export default function StreamsFeedPage() {
  return (
    <>
      <Script id="breadcrumb-streams-feed" type="application/ld+json">
        {JSON.stringify(streamsBreadcrumb)}
      </Script>
      <ProtocolFeed source="streams" />
    </>
  );
}
