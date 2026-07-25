import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const discourseBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Discourse',
      item: 'https://app.degenfeed.xyz/feed/discourse',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Discourse Feed — Decentralized Content | DegenFeed',
  description: 'Browse Discourse content aggregated in your DegenFeed timeline.',
  keywords: ['discourse feed', 'discourse content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Discourse Feed — DegenFeed',
    description: 'Discourse content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/discourse',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/discourse' },
};

export default function DiscourseFeedPage() {
  return (
    <>
      <Script id="breadcrumb-discourse-feed" type="application/ld+json">
        {JSON.stringify(discourseBreadcrumb)}
      </Script>
      <ProtocolFeed source="discourse" />
    </>
  );
}
