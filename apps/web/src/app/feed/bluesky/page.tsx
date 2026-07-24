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
  title: 'Bluesky Feed — AT Protocol Skeets | DegenFeed',
  description:
    'Browse Bluesky skeets and AT Protocol custom feeds aggregated from the network. Follow crypto content across the Bluesky ecosystem.',
  keywords: ['bluesky feed', 'at protocol feed', 'bluesky skeets', 'bluesky crypto'],
  openGraph: {
    title: 'Bluesky Feed — DegenFeed',
    description: 'AT Protocol skeets and custom feeds from Bluesky, in your unified timeline.',
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
