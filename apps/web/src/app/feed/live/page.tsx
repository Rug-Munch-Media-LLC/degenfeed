import type { Metadata } from 'next';
import Script from 'next/script';
import { MediaFeed } from '../../../components/media/MediaFeed';

const liveBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Live Streams',
      item: 'https://app.degenfeed.xyz/feed/live',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Live Streams — Decentralized Streaming Hub | DegenFeed',
  description:
    'Watch live streams from Owncast, PeerTube Live, YouTube Live, Twitch, and more. Decentralized live streaming aggregated in one place with viewer counts and chat integration.',
  keywords: [
    'live streaming',
    'owncast',
    'peertube live',
    'youtube live',
    'twitch',
    'decentralized streaming',
    'web3 live',
    'crypto live streams',
  ],
  openGraph: {
    title: 'Live Streams — DegenFeed',
    description: 'All live streams from every platform in one hub.',
    url: 'https://app.degenfeed.xyz/feed/live',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-live.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Live Streaming Hub',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Streams — DegenFeed',
    description: 'Every live stream across all platforms.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/live' },
};

export default function LiveFeedPage() {
  return (
    <>
      <Script id="breadcrumb-live-feed" type="application/ld+json">
        {JSON.stringify(liveBreadcrumb)}
      </Script>
      <MediaFeed defaultFilter="live" hideHeader={false} />
    </>
  );
}
