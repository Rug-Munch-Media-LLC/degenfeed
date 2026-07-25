import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const subsocialBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Subsocial',
      item: 'https://app.degenfeed.xyz/feed/subsocial',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Subsocial Feed — Decentralized Content | DegenFeed',
  description: 'Browse Subsocial content aggregated in your DegenFeed timeline.',
  keywords: ['subsocial feed', 'subsocial content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Subsocial Feed — DegenFeed',
    description: 'Subsocial content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/subsocial',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/subsocial' },
};

export default function SubsocialFeedPage() {
  return (
    <>
      <Script id="breadcrumb-subsocial-feed" type="application/ld+json">
        {JSON.stringify(subsocialBreadcrumb)}
      </Script>
      <ProtocolFeed source="subsocial" />
    </>
  );
}
