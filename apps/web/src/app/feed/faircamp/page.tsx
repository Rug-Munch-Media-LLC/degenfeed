import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const faircampBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Faircamp',
      item: 'https://app.degenfeed.xyz/feed/faircamp',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Faircamp Feed — Decentralized Content | DegenFeed',
  description: 'Browse Faircamp content aggregated in your DegenFeed timeline.',
  keywords: ['faircamp feed', 'faircamp content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Faircamp Feed — DegenFeed',
    description: 'Faircamp content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/faircamp',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/faircamp' },
};

export default function FaircampFeedPage() {
  return (
    <>
      <Script id="breadcrumb-faircamp-feed" type="application/ld+json">
        {JSON.stringify(faircampBreadcrumb)}
      </Script>
      <ProtocolFeed source="faircamp" />
    </>
  );
}
