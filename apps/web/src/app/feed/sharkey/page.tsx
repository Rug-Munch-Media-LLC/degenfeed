import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const sharkeyBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Sharkey',
      item: 'https://app.degenfeed.xyz/feed/sharkey',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Sharkey Feed — Decentralized Content | DegenFeed',
  description: 'Browse Sharkey content aggregated in your DegenFeed timeline.',
  keywords: ['sharkey feed', 'sharkey content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Sharkey Feed — DegenFeed',
    description: 'Sharkey content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/sharkey',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/sharkey' },
};

export default function SharkeyFeedPage() {
  return (
    <>
      <Script id="breadcrumb-sharkey-feed" type="application/ld+json">
        {JSON.stringify(sharkeyBreadcrumb)}
      </Script>
      <ProtocolFeed source="sharkey" />
    </>
  );
}
