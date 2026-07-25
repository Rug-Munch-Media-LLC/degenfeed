import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const pleromaBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Pleroma',
      item: 'https://app.degenfeed.xyz/feed/pleroma',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Pleroma Feed — Decentralized Content | DegenFeed',
  description: 'Browse Pleroma content aggregated in your DegenFeed timeline.',
  keywords: ['pleroma feed', 'pleroma content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Pleroma Feed — DegenFeed',
    description: 'Pleroma content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/pleroma',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/pleroma' },
};

export default function PleromaFeedPage() {
  return (
    <>
      <Script id="breadcrumb-pleroma-feed" type="application/ld+json">
        {JSON.stringify(pleromaBreadcrumb)}
      </Script>
      <ProtocolFeed source="pleroma" />
    </>
  );
}
