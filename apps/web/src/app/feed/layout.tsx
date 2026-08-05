import type { Metadata } from 'next';
import Script from 'next/script';
import { fetchInitialFeedData } from '../../lib/feedApi';
import { FeedShell } from './FeedShell';

const breadcrumbStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
  ],
};

export const metadata: Metadata = {
  title: 'Feed — Web3 Social Feed Aggregator',
  description:
    'Your personalized web3 content feed aggregated from Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS. AI-powered cross-protocol timeline. The best decentralized social feed for crypto and web3 content.',
  keywords: [
    'crypto news feed',
    'web3 content aggregator',
    'multi-protocol feed',
    'nostr feed',
    'farcaster feed',
    'lens feed',
    'bluesky feed',
    'mastodon feed',
    'unified social feed',
    'cross protocol timeline',
  ],
  openGraph: {
    title: 'DegenFeed — Your Unified Web3 Social Feed',
    description:
      'Browse Nostr, Farcaster, Lens, Bluesky, Mastodon, and more in one AI-powered web3 feed. Cross-protocol timeline for crypto content.',
    url: 'https://app.degenfeed.xyz/feed',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed web3 social feed aggregating Nostr, Farcaster, Lens, Bluesky, Mastodon',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DegenFeed — Your Unified Web3 Feed',
    description:
      'Every social protocol, one feed. Aggregated Nostr, Farcaster, Lens, Bluesky, Mastodon.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed' },
};

async function getInitialFeedData() {
  // Fetch feed data server-side so the SSR HTML has content (no loading flash).
  // Uses the bounded preload helper in lib/feedApi.ts: hard 1.6s overall
  // budget, never blocks SSR on a cold/slow API.
  return fetchInitialFeedData();
}

export default async function FeedLayout({ children }: { children: React.ReactNode }) {
  const initialPosts = await getInitialFeedData();

  return (
    <>
      <Script id="breadcrumb-feed" type="application/ld+json">
        {JSON.stringify(breadcrumbStructuredData)}
      </Script>
      {initialPosts.length > 0 && (
        <Script id="feed-initial-data" type="application/json" data-initial-feed="true">
          {JSON.stringify(initialPosts)}
        </Script>
      )}
      <FeedShell>{children}</FeedShell>
    </>
  );
}
