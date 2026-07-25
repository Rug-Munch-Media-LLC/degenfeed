import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const mobilizonBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Mobilizon',
      item: 'https://app.degenfeed.xyz/feed/mobilizon',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Mobilizon Feed — Decentralized Content | DegenFeed',
  description: 'Browse Mobilizon content aggregated in your DegenFeed timeline.',
  keywords: ['mobilizon feed', 'mobilizon content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Mobilizon Feed — DegenFeed',
    description: 'Mobilizon content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/mobilizon',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/mobilizon' },
};

export default function MobilizonFeedPage() {
  return (
    <>
      <Script id="breadcrumb-mobilizon-feed" type="application/ld+json">
        {JSON.stringify(mobilizonBreadcrumb)}
      </Script>
      <ProtocolFeed source="mobilizon" />
    </>
  );
}
