import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const takaheBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Takahē',
      item: 'https://app.degenfeed.xyz/feed/takahe',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Takahē Feed — Decentralized Content | DegenFeed',
  description: 'Browse Takahē content aggregated in your DegenFeed timeline.',
  keywords: ['takahe feed', 'takahe content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Takahē Feed — DegenFeed',
    description: 'Takahē content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/takahe',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/takahe' },
};

export default function TakahēFeedPage() {
  return (
    <>
      <Script id="breadcrumb-takahe-feed" type="application/ld+json">
        {JSON.stringify(takaheBreadcrumb)}
      </Script>
      <ProtocolFeed source="takahe" />
    </>
  );
}
