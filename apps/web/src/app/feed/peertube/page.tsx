import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const peertubeBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'PeerTube',
      item: 'https://app.degenfeed.xyz/feed/peertube',
    },
  ],
};

export const metadata: Metadata = {
  title: 'PeerTube Feed — Decentralized Videos | DegenFeed',
  description:
    'Browse PeerTube videos and decentralized video content. ActivityPub-powered video platform aggregated in your DegenFeed timeline.',
  keywords: ['peertube feed', 'peertube videos', 'decentralized video', 'fediverse video'],
  openGraph: {
    title: 'PeerTube Feed — DegenFeed',
    description: 'PeerTube videos from across the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/peertube' },
};

export default function PeerTubeFeedPage() {
  return (
    <>
      <Script id="breadcrumb-peertube-feed" type="application/ld+json">
        {JSON.stringify(peertubeBreadcrumb)}
      </Script>
      <ProtocolFeed source="peertube" />
    </>
  );
}
