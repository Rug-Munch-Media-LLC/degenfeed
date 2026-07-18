import type { Metadata } from 'next';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

const trendingBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Trending', item: 'https://app.degenfeed.xyz/trending' },
  ],
};

export const metadata: Metadata = {
  title: 'Trending — Web3 Trending Topics & Crypto Social Trends',
  description:
    'Trending crypto topics across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS. See what the web3 social graph is talking about right now. Real-time blockchain social media trends.',
  keywords: [
    'crypto trending topics', 'web3 social trends', 'blockchain trending',
    'crypto hashtags', 'web3 viral content', 'cross protocol trending',
  ],
  openGraph: {
    title: 'Trending — Web3 Trending Topics & Crypto Social Trends | DegenFeed',
    description:
      'See what the web3 social graph is talking about now. Trending topics across Nostr, Farcaster, Lens, Bluesky, Mastodon.',
    url: 'https://app.degenfeed.xyz/trending',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Trending web3 topics and crypto social trends on DegenFeed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trending — Web3 Crypto Trends | DegenFeed',
    description:
      'See what the web3 social graph is talking about right now. Real-time crypto trends.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/trending' },
};

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-trending" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(trendingBreadcrumb) }} />
      {children}
    </>
  );
}
