export const runtime = 'edge';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import NewsLoading from './loading';
import NewsClient from './NewsClient';
import type { NewsMeta, NewsStory, StoryCluster } from './types';

export const revalidate = 300; // 5 min

export const metadata: Metadata = {
  title: 'News',
  description:
    'Intelligent news aggregation from 50+ sources across RSS, Nostr, Farcaster, Bluesky, Reddit, and newsletters — ranked by quality, recency, sentiment, and your interests.',
  openGraph: {
    title: 'News — DegenFeed',
    description: 'Intelligent crypto, web3, and AI news aggregation from 50+ sources. No paywalls.',
    url: 'https://app.degenfeed.xyz/news',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed News',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'News — DegenFeed',
    description: 'Intelligent crypto, web3, and AI news aggregation from 50+ sources. No paywalls.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/news' },
};

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') || 'app.degenfeed.xyz';
  const protocol = h.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

async function NewsData() {
  const url = `${await getBaseUrl()}/api/news/feed?limit=50&sort=score`;
  const res = await fetch(url, {
    credentials: 'include',
    next: { revalidate: 0 },
    cache: 'no-store',
    headers: { 'cache-control': 'no-store' },
  });
  const json = (await res.json()) as {
    data?: NewsStory[];
    clusters?: StoryCluster[];
    meta?: NewsMeta;
    error?: string;
  };

  if (!res.ok || json.error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-xl border border-red-900/50 bg-red-900/10 py-12 text-center">
          <div className="mb-2 text-4xl text-red-400">!</div>
          <p className="text-red-300">{json.error || 'Failed to fetch news'}</p>
        </div>
      </div>
    );
  }

  return (
    <NewsClient
      initialStories={json.data || []}
      initialMeta={json.meta || null}
      initialClusters={json.clusters || []}
    />
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={<NewsLoading />}>
      <NewsData />
    </Suspense>
  );
}

// Re-export types from the client for convenience
export type { NewsMeta, NewsStory, StoryCluster };
