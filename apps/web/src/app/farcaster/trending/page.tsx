import type { Metadata } from 'next';
import Script from 'next/script';
import { PerPlatformTrending } from '../../../components/PerPlatformTrending';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Farcaster', item: 'https://app.degenfeed.xyz/farcaster' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Farcaster Trending',
      item: 'https://app.degenfeed.xyz/farcaster/trending',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Farcaster Trending — Trending Casts, Channels & Topics',
  description:
    'Trending Farcaster casts, channels, and topics ranked by engagement velocity. See what the Farcaster community is talking about right now.',
  keywords: ['farcaster trending', 'trending casts', 'farcaster channels', 'trending topics farcaster'],
  openGraph: {
    title: 'Farcaster Trending — Trending Casts, Channels & Topics | DegenFeed',
    description: 'Trending Farcaster casts, channels, and topics ranked by engagement velocity.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/farcaster/trending' },
};

export default function FarcasterTrendingPage() {
  return (
    <>
      <Script
        id="breadcrumb-farcaster-trending"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <PerPlatformTrending protocol="farcaster" />
    </>
  );
}
