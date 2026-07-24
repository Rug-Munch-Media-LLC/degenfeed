import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

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
  title: 'Video Feed — PeerTube & Crypto Videos | DegenFeed',
  description:
    'Watch the latest crypto videos from PeerTube and across the fediverse. Decentralized video platform content aggregated in your feed.',
  keywords: ['peertube feed', 'crypto videos', 'fediverse video', 'decentralized video'],
  openGraph: {
    title: 'Video Feed — DegenFeed',
    description: 'PeerTube videos and crypto content from across the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/videos' },
};

export default function VideosFeedPage() {
  return (
    <>
      <Script id="breadcrumb-videos-feed" type="application/ld+json">
        {JSON.stringify(videosBreadcrumb)}
      </Script>
      <ProtocolFeed source="peertube" />
    </>
  );
}
