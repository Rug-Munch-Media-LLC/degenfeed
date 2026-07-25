import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const orbisBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Orbis',
      item: 'https://app.degenfeed.xyz/feed/orbis',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Orbis Feed — Decentralized Content | DegenFeed',
  description: 'Browse Orbis content aggregated in your DegenFeed timeline.',
  keywords: ['orbis feed', 'orbis content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Orbis Feed — DegenFeed',
    description: 'Orbis content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/orbis',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/orbis' },
};

export default function OrbisFeedPage() {
  return (
    <>
      <Script id="breadcrumb-orbis-feed" type="application/ld+json">
        {JSON.stringify(orbisBreadcrumb)}
      </Script>
      <ProtocolFeed source="orbis" />
    </>
  );
}
