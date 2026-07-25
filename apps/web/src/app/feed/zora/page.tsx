import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const zoraBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Zora',
      item: 'https://app.degenfeed.xyz/feed/zora',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Zora Feed — Decentralized Content | DegenFeed',
  description: 'Browse Zora content aggregated in your DegenFeed timeline.',
  keywords: ['zora feed', 'zora content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Zora Feed — DegenFeed',
    description: 'Zora content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/zora',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/zora' },
};

export default function ZoraFeedPage() {
  return (
    <>
      <Script id="breadcrumb-zora-feed" type="application/ld+json">
        {JSON.stringify(zoraBreadcrumb)}
      </Script>
      <ProtocolFeed source="zora" />
    </>
  );
}
