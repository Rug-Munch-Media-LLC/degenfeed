import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const epicyonBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Epicyon',
      item: 'https://app.degenfeed.xyz/feed/epicyon',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Epicyon Feed — Decentralized Content | DegenFeed',
  description: 'Browse Epicyon content aggregated in your DegenFeed timeline.',
  keywords: ['epicyon feed', 'epicyon content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Epicyon Feed — DegenFeed',
    description: 'Epicyon content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/epicyon',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/epicyon' },
};

export default function EpicyonFeedPage() {
  return (
    <>
      <Script id="breadcrumb-epicyon-feed" type="application/ld+json">
        {JSON.stringify(epicyonBreadcrumb)}
      </Script>
      <ProtocolFeed source="epicyon" />
    </>
  );
}
