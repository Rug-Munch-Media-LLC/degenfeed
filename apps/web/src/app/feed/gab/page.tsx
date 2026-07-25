import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const gabBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Gab',
      item: 'https://app.degenfeed.xyz/feed/gab',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Gab Feed — Decentralized Content | DegenFeed',
  description: 'Browse Gab content aggregated in your DegenFeed timeline.',
  keywords: ['gab feed', 'gab content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Gab Feed — DegenFeed',
    description: 'Gab content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/gab',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/gab' },
};

export default function GabFeedPage() {
  return (
    <>
      <Script id="breadcrumb-gab-feed" type="application/ld+json">
        {JSON.stringify(gabBreadcrumb)}
      </Script>
      <ProtocolFeed source="gab" />
    </>
  );
}
