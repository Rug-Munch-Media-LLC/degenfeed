import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const threadsBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Threads',
      item: 'https://app.degenfeed.xyz/feed/threads',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Threads Feed — Decentralized Content | DegenFeed',
  description: 'Browse Threads content aggregated in your DegenFeed timeline.',
  keywords: ['threads feed', 'threads content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Threads Feed — DegenFeed',
    description: 'Threads content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/threads',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/threads' },
};

export default function ThreadsFeedPage() {
  return (
    <>
      <Script id="breadcrumb-threads-feed" type="application/ld+json">
        {JSON.stringify(threadsBreadcrumb)}
      </Script>
      <ProtocolFeed source="threads" />
    </>
  );
}
