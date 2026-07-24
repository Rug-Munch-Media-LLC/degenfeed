import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const blueskyBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Bluesky',
      item: 'https://app.degenfeed.xyz/feed/bluesky',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Bluesky Feed — AT Protocol Social | DegenFeed',
  description:
    'Browse Bluesky posts, photos, and trending content from the AT Protocol. Decentralized social media aggregated in your DegenFeed timeline.',
  keywords: [
    'bluesky feed',
    'at protocol',
    'bluesky skeets',
    'bluesky crypto',
    'decentralized social',
  ],
  openGraph: {
    title: 'Bluesky Feed — DegenFeed',
    description: 'Bluesky content from the AT Protocol, aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/bluesky',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/bluesky' },
};

export default function BlueskyFeedPage() {
  return (
    <>
      <Script id="breadcrumb-bluesky-feed" type="application/ld+json">
        {JSON.stringify(blueskyBreadcrumb)}
      </Script>
      <ProtocolFeed source="bluesky" />
    </>
  );
}
