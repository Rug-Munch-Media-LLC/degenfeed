import type { Metadata } from 'next';
import Script from 'next/script';

const videosBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Videos', item: 'https://app.degenfeed.xyz/videos' },
  ],
};

export const metadata: Metadata = {
  title: 'Videos — Web3 & Crypto Video Feed | YouTube & PeerTube Aggregator',
  description:
    'Crypto and web3 video content aggregated from YouTube RSS feeds, PeerTube, and federated instances. Tutorials, interviews, live streams, and crypto deep dives. The best web3 video platform and decentralized video aggregator.',
  keywords: [
    'web3 video platform',
    'peertube crypto',
    'crypto youtube alternative',
    'decentralized video',
    'crypto video feed',
    'web3 video aggregator',
    'federated video',
  ],
  openGraph: {
    title: 'Videos — Web3 & Crypto Video Feed | YouTube & PeerTube Aggregator',
    description:
      'Crypto and web3 videos from YouTube RSS, PeerTube, and federated video instances. Tutorials, interviews, live streams.',
    url: 'https://app.degenfeed.xyz/videos',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed web3 video feed aggregating YouTube crypto and PeerTube decentralized videos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Videos — Web3 Crypto Video Feed | DegenFeed',
    description:
      'Crypto and web3 videos from YouTube RSS, PeerTube, and federated video instances.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/videos' },
};

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-videos" type="application/ld+json">{
        JSON.stringify(videosBreadcrumb)
      }</Script>
      {children}
    </>
  );
}
