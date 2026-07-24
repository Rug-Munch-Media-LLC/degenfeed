import type { Metadata } from 'next';
import Script from 'next/script';
import { BlueskyMediaView } from './BlueskyMediaView';

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
  title: 'Bluesky Media — AT Protocol Photos & Videos | DegenFeed',
  description:
    'Instagram-style media gallery for Bluesky. Browse crypto photos, videos, and trending content from the AT Protocol network in a beautiful grid layout.',
  keywords: [
    'bluesky media',
    'bluesky photos',
    'bluesky images',
    'bluesky videos',
    'at protocol feed',
    'bluesky skeets',
    'bluesky crypto',
    'decentralized social media',
  ],
  openGraph: {
    title: 'Bluesky Media — DegenFeed',
    description:
      'Photos, videos, and trending content from Bluesky. Instagram-style gallery for the AT Protocol.',
    url: 'https://app.degenfeed.xyz/feed/bluesky',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Bluesky Media Gallery on DegenFeed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bluesky Media — DegenFeed',
    description: 'Beautiful media gallery for Bluesky content. Photos, videos, trending.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/bluesky' },
};

export default function BlueskyMediaPage() {
  return (
    <>
      <Script id="breadcrumb-bluesky-media" type="application/ld+json">
        {JSON.stringify(blueskyBreadcrumb)}
      </Script>
      <BlueskyMediaView />
    </>
  );
}
