import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Twitch',
      item: 'https://app.degenfeed.xyz/feed/twitch',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Twitch — Live Streams & Trending Clips | DegenFeed',
  description: 'Live streams, gaming content and trending clips from Twitch creators.',
  keywords: ['twitch feed', 'decentralized social', 'fediverse', 'twitch'],
  openGraph: {
    title: 'Twitch — DegenFeed',
    description: 'Live streams, gaming content and trending clips from Twitch creators.',
    url: 'https://app.degenfeed.xyz/feed/twitch',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/twitch' },
};

export default function TwitchFeedPage() {
  return (
    <>
      <Script id="breadcrumb-twitch-feed" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      <ProtocolFeed source="twitch" />
    </>
  );
}
