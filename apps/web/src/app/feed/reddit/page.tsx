import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const redditBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Reddit',
      item: 'https://app.degenfeed.xyz/feed/reddit',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Reddit Feed — Crypto Subreddits | DegenFeed',
  description:
    'Browse crypto subreddit discussions aggregated from Redlib. Bitcoin, Ethereum, Solana, NFT, and DeFi subreddits in one feed.',
  keywords: ['reddit crypto feed', 'crypto subreddits', 'bitcoin reddit', 'defi reddit'],
  openGraph: {
    title: 'Reddit Feed — DegenFeed',
    description: 'Crypto subreddit discussions aggregated from Redlib.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/reddit' },
};

export default function RedditFeedPage() {
  return (
    <>
      <Script id="breadcrumb-reddit-feed" type="application/ld+json">
        {JSON.stringify(redditBreadcrumb)}
      </Script>
      <ProtocolFeed source="reddit" />
    </>
  );
}
