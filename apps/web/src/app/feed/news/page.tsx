import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const newsBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    { '@type': 'ListItem', position: 3, name: 'News', item: 'https://app.degenfeed.xyz/feed/news' },
  ],
};

export const metadata: Metadata = {
  title: 'Crypto News — RSS Feed Aggregator | DegenFeed',
  description:
    'Latest crypto news aggregated from 350+ RSS sources. Bitcoin, Ethereum, Solana, DeFi, NFT, and web3 news in one feed.',
  keywords: ['crypto news feed', 'rss aggregator', 'bitcoin news', 'defi news', 'web3 news'],
  openGraph: {
    title: 'Crypto News — DegenFeed',
    description: 'Crypto news from 350+ RSS sources, aggregated daily.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/news' },
};

export default function NewsFeedPage() {
  return (
    <>
      <Script id="breadcrumb-news-feed" type="application/ld+json">
        {JSON.stringify(newsBreadcrumb)}
      </Script>
      <ProtocolFeed source="rss" />
    </>
  );
}
