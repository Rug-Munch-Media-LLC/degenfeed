import type { Metadata } from 'next';
import Script from 'next/script';
import { MediaFeed } from '../../../components/media/MediaFeed';

const videosBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Videos',
      item: 'https://app.degenfeed.xyz/feed/videos',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Video Feed — PeerTube & YouTube Videos | DegenFeed',
  description:
    'Watch videos from PeerTube, YouTube, Owncast recordings, and video embeds from every protocol. YouTube-style grid with thumbnails, duration, and channel info.',
  keywords: [
    'peertube feed',
    'crypto videos',
    'fediverse video',
    'decentralized video',
    'youtube videos',
    'video aggregator',
    'web3 video feed',
  ],
  openGraph: {
    title: 'Video Feed — DegenFeed',
    description: 'Videos from PeerTube, YouTube, and every protocol.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/videos' },
};

export default function VideosFeedPage() {
  return (
    <>
      <Script id="breadcrumb-videos-feed" type="application/ld+json">
        {JSON.stringify(videosBreadcrumb)}
      </Script>
      <MediaFeed defaultFilter="videos" hideHeader={false} />
    </>
  );
}
