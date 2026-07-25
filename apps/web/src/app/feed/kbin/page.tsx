import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const kbinBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Kbin',
      item: 'https://app.degenfeed.xyz/feed/kbin',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Kbin Feed — Decentralized Content | DegenFeed',
  description: 'Browse Kbin content aggregated in your DegenFeed timeline.',
  keywords: ['kbin feed', 'kbin content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Kbin Feed — DegenFeed',
    description: 'Kbin content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/kbin',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/kbin' },
};

export default function KbinFeedPage() {
  return (
    <>
      <Script id="breadcrumb-kbin-feed" type="application/ld+json">
        {JSON.stringify(kbinBreadcrumb)}
      </Script>
      <ProtocolFeed source="kbin" />
    </>
  );
}
