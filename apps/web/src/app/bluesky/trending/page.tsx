import type { Metadata } from 'next';
import Script from 'next/script';
import { PerPlatformTrending } from '../../../components/PerPlatformTrending';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Bluesky', item: 'https://app.degenfeed.xyz/bluesky' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Bluesky Trending',
      item: 'https://app.degenfeed.xyz/bluesky/trending',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Bluesky Trending — Trending Skeets, Custom Feeds & Topics',
  description:
    'Trending Bluesky skeets, custom feeds, and topics ranked by engagement velocity. See what the AT Protocol community is talking about right now.',
  keywords: ['bluesky trending', 'trending skeets', 'bluesky custom feeds', 'trending topics bluesky', 'at protocol trending'],
  openGraph: {
    title: 'Bluesky Trending — Trending Skeets, Custom Feeds & Topics | DegenFeed',
    description: 'Trending Bluesky skeets, custom feeds, and topics ranked by engagement velocity.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/bluesky/trending' },
};

export default function BlueskyTrendingPage() {
  return (
    <>
      <Script
        id="breadcrumb-bluesky-trending"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <PerPlatformTrending protocol="bluesky" />
    </>
  );
}
