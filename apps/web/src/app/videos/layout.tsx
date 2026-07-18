import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Videos — DegenFeed',
  description:
    'Crypto and web3 video content aggregated from YouTube RSS feeds and PeerTube. Tutorials, interviews, live streams, and deep dives in a dark cyberpunk video grid.',
  openGraph: {
    title: 'Videos — DegenFeed',
    description: 'Crypto and web3 video content aggregated from YouTube and PeerTube.',
    url: 'https://app.degenfeed.xyz/videos',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Videos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Videos — DegenFeed',
    description: 'Crypto and web3 video content aggregated from YouTube and PeerTube.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/videos' },
};

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
