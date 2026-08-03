import type { Metadata } from 'next';
import Script from 'next/script';
import { PodcastFeed } from '../../../components/feed/PodcastFeed';

const podcastBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Podcasts',
      item: 'https://app.degenfeed.xyz/feed/podcast',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Podcast Feed — Crypto & Web3 Shows | DegenFeed',
  description:
    'Aggregated crypto and web3 podcast episodes from Bankless, Unchained, Empire, 0xResearch, Bell Curve, Chopping Block, Lightspeed and more — with inline audio players.',
  keywords: ['podcast feed', 'crypto podcast', 'web3 podcast', 'bitcoin podcast', 'defi podcast'],
  openGraph: {
    title: 'Podcast Feed — DegenFeed',
    description: 'Top crypto & web3 podcast episodes aggregated in one feed, with audio players.',
    url: 'https://app.degenfeed.xyz/feed/podcast',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/podcast' },
};

export default function PodcastFeedPage() {
  return (
    <>
      <Script id="breadcrumb-podcast-feed" type="application/ld+json">
        {JSON.stringify(podcastBreadcrumb)}
      </Script>
      <PodcastFeed />
    </>
  );
}
