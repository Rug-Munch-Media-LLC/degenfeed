import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const rssBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'RSS/News',
      item: 'https://app.degenfeed.xyz/feed/rss',
    },
  ],
};

export const metadata: Metadata = {
  title: 'RSS/News Feed — Aggregated Crypto News | DegenFeed',
  description:
    'Browse RSS feed content aggregated from 350+ crypto news sources. Bitcoin, Ethereum, Solana, DeFi, NFT, and web3 news in one feed.',
  keywords: ['rss feed', 'crypto news', 'news aggregator', 'bitcoin news', 'defi news'],
  openGraph: {
    title: 'RSS/News Feed — DegenFeed',
    description: 'Crypto news from 350+ RSS sources, aggregated in your DegenFeed timeline.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/rss' },
};

export default function RssFeedPage() {
  return (
    <>
      <Script id="breadcrumb-rss-feed" type="application/ld+json">
        {JSON.stringify(rssBreadcrumb)}
      </Script>
      <ProtocolFeed source="rss" />
    </>
  );
}
