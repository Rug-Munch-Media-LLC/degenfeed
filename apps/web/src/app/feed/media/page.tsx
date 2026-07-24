import type { Metadata } from 'next';
import Script from 'next/script';
import { MediaFeed } from '../../../components/media/MediaFeed';

const mediaBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Media Hub',
      item: 'https://app.degenfeed.xyz/feed/media',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Media Hub — Images, Videos & Live Streams | DegenFeed',
  description:
    'Unified media feed aggregating images from Bluesky, Pixelfed, Zora NFTs, Nostr, videos from PeerTube and YouTube, and live streams from Owncast and Twitch. Pinterest-style masonry grid with lightbox viewer.',
  keywords: [
    'decentralized media feed',
    'bluesky images',
    'pixelfed photos',
    'zora nfts',
    'nostr images',
    'peertube videos',
    'live streaming',
    'web3 media hub',
  ],
  openGraph: {
    title: 'Media Hub — DegenFeed',
    description:
      'Images, videos, and live streams from every protocol in one gorgeous masonry grid.',
    url: 'https://app.degenfeed.xyz/feed/media',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-media.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Media Hub — unified visual feed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Media Hub — DegenFeed',
    description: 'Every image, video, and live stream across all protocols.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/media' },
};

export default function MediaFeedPage() {
  return (
    <>
      <Script id="breadcrumb-media-feed" type="application/ld+json">
        {JSON.stringify(mediaBreadcrumb)}
      </Script>
      <MediaFeed />
    </>
  );
}
