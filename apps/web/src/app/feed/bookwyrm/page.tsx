import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const bookwyrmBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'BookWyrm',
      item: 'https://app.degenfeed.xyz/feed/bookwyrm',
    },
  ],
};

export const metadata: Metadata = {
  title: 'BookWyrm Feed — Decentralized Content | DegenFeed',
  description: 'Browse BookWyrm content aggregated in your DegenFeed timeline.',
  keywords: ['bookwyrm feed', 'bookwyrm content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'BookWyrm Feed — DegenFeed',
    description: 'BookWyrm content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/bookwyrm',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/bookwyrm' },
};

export default function BookWyrmFeedPage() {
  return (
    <>
      <Script id="breadcrumb-bookwyrm-feed" type="application/ld+json">
        {JSON.stringify(bookwyrmBreadcrumb)}
      </Script>
      <ProtocolFeed source="bookwyrm" />
    </>
  );
}
