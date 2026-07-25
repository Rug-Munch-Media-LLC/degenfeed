import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const mbinBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Mbin',
      item: 'https://app.degenfeed.xyz/feed/mbin',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Mbin Feed — Decentralized Content | DegenFeed',
  description: 'Browse Mbin content aggregated in your DegenFeed timeline.',
  keywords: ['mbin feed', 'mbin content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Mbin Feed — DegenFeed',
    description: 'Mbin content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/mbin',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/mbin' },
};

export default function MbinFeedPage() {
  return (
    <>
      <Script id="breadcrumb-mbin-feed" type="application/ld+json">
        {JSON.stringify(mbinBreadcrumb)}
      </Script>
      <ProtocolFeed source="mbin" />
    </>
  );
}
