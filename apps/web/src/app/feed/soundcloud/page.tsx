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
      name: 'SoundCloud',
      item: 'https://app.degenfeed.xyz/feed/soundcloud',
    },
  ],
};

export const metadata: Metadata = {
  title: 'SoundCloud — Music Tracks & Mixes | DegenFeed',
  description: 'Electronic music, mixes and tracks from SoundCloud curators and artists.',
  keywords: ['soundcloud feed', 'decentralized social', 'fediverse', 'soundcloud'],
  openGraph: {
    title: 'SoundCloud — DegenFeed',
    description: 'Electronic music, mixes and tracks from SoundCloud curators and artists.',
    url: 'https://app.degenfeed.xyz/feed/soundcloud',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/soundcloud' },
};

export default function SoundcloudFeedPage() {
  return (
    <>
      <Script id="breadcrumb-soundcloud-feed" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      <ProtocolFeed source="soundcloud" />
    </>
  );
}
