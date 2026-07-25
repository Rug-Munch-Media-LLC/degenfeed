import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const huddle01Breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Huddle01',
      item: 'https://app.degenfeed.xyz/feed/huddle01',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Huddle01 Feed — Decentralized Content | DegenFeed',
  description: 'Browse Huddle01 content aggregated in your DegenFeed timeline.',
  keywords: ['huddle01 feed', 'huddle01 content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Huddle01 Feed — DegenFeed',
    description: 'Huddle01 content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/huddle01',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/huddle01' },
};

export default function Huddle01FeedPage() {
  return (
    <>
      <Script id="breadcrumb-huddle01-feed" type="application/ld+json">
        {JSON.stringify(huddle01Breadcrumb)}
      </Script>
      <ProtocolFeed source="huddle01" />
    </>
  );
}
