import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const sublinksBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Sublinks',
      item: 'https://app.degenfeed.xyz/feed/sublinks',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Sublinks Feed — Decentralized Content | DegenFeed',
  description: 'Browse Sublinks content aggregated in your DegenFeed timeline.',
  keywords: ['sublinks feed', 'sublinks content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Sublinks Feed — DegenFeed',
    description: 'Sublinks content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/sublinks',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/sublinks' },
};

export default function SublinksFeedPage() {
  return (
    <>
      <Script id="breadcrumb-sublinks-feed" type="application/ld+json">
        {JSON.stringify(sublinksBreadcrumb)}
      </Script>
      <ProtocolFeed source="sublinks" />
    </>
  );
}
