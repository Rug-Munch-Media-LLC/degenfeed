import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const diasporaBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Diaspora',
      item: 'https://app.degenfeed.xyz/feed/diaspora',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Diaspora Feed — Decentralized Content | DegenFeed',
  description: 'Browse Diaspora content aggregated in your DegenFeed timeline.',
  keywords: ['diaspora feed', 'diaspora content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Diaspora Feed — DegenFeed',
    description: 'Diaspora content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/diaspora',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/diaspora' },
};

export default function DiasporaFeedPage() {
  return (
    <>
      <Script id="breadcrumb-diaspora-feed" type="application/ld+json">
        {JSON.stringify(diasporaBreadcrumb)}
      </Script>
      <ProtocolFeed source="diaspora" />
    </>
  );
}
