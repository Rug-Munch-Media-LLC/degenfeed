import type { Metadata } from 'next';
import Script from 'next/script';

const videoBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Video Hub',
      item: 'https://app.degenfeed.xyz/video',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Video Hub — Discover Videos Across YouTube, PeerTube, Shorts & Live',
  description:
    'Browse the unified video hub: YouTube crypto content, PeerTube decentralized videos, short-form vertical videos, and live streams — all in one Netflix-style browsing experience. Every video labeled with its source.',
  keywords: [
    'video hub',
    'web3 video platform',
    'youtube crypto',
    'peertube aggregator',
    'decentralized video',
    'crypto video feed',
    'web3 video aggregator',
    'federated video',
    'video discovery',
    'content discovery',
  ],
  openGraph: {
    title: 'Video Hub — Discover Videos | DegenFeed',
    description:
      'Discover videos across YouTube, PeerTube, Shorts, and Live — all categorized and labeled by source.',
    url: 'https://app.degenfeed.xyz/video',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Video Hub — Netflix-style video discovery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Video Hub — DegenFeed',
    description:
      'Discover videos across YouTube, PeerTube, Shorts, and Live — all categorized and labeled by source.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/video' },
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-video" type="application/ld+json">
        {JSON.stringify(videoBreadcrumb)}
      </Script>
      {children}
    </>
  );
}
