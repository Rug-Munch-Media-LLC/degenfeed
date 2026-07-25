import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const headscaleBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Headscale',
      item: 'https://app.degenfeed.xyz/feed/headscale',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Headscale Feed — Decentralized Content | DegenFeed',
  description: 'Browse Headscale content aggregated in your DegenFeed timeline.',
  keywords: ['headscale feed', 'headscale content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Headscale Feed — DegenFeed',
    description: 'Headscale content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/headscale',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/headscale' },
};

export default function HeadscaleFeedPage() {
  return (
    <>
      <Script id="breadcrumb-headscale-feed" type="application/ld+json">
        {JSON.stringify(headscaleBreadcrumb)}
      </Script>
      <ProtocolFeed source="headscale" />
    </>
  );
}
