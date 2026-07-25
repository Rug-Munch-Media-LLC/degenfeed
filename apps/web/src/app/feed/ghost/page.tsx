import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const ghostBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Ghost',
      item: 'https://app.degenfeed.xyz/feed/ghost',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Ghost Feed — Decentralized Content | DegenFeed',
  description: 'Browse Ghost content aggregated in your DegenFeed timeline.',
  keywords: ['ghost feed', 'ghost content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Ghost Feed — DegenFeed',
    description: 'Ghost content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/ghost',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/ghost' },
};

export default function GhostFeedPage() {
  return (
    <>
      <Script id="breadcrumb-ghost-feed" type="application/ld+json">
        {JSON.stringify(ghostBreadcrumb)}
      </Script>
      <ProtocolFeed source="ghost" />
    </>
  );
}
