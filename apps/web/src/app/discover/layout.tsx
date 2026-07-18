import type { Metadata } from 'next';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

const discoverBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Discover',
      item: 'https://app.degenfeed.xyz/discover',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Discover — Web3 Content Discovery & Trending Crypto Posts',
  description:
    'Discover trending crypto posts, web3 communities, and creators across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more. The best crypto content discovery platform and decentralized social media aggregator.',
  keywords: [
    'crypto content discovery',
    'web3 trending posts',
    'discover crypto communities',
    'web3 social discovery',
    'trending crypto content',
    'cross protocol discovery',
  ],
  openGraph: {
    title: 'Discover — Web3 Content Discovery & Trending Crypto Posts | DegenFeed',
    description:
      'Discover trending crypto posts, web3 communities, and creators across Nostr, Farcaster, Lens, Bluesky, Mastodon.',
    url: 'https://app.degenfeed.xyz/discover',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Discover trending crypto posts and web3 communities on DegenFeed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discover — Web3 Content Discovery | DegenFeed',
    description:
      'Discover trending crypto posts and communities across Nostr, Farcaster, Lens, Bluesky, Mastodon.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/discover' },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-discover" type="application/ld+json">{
        JSON.stringify(discoverBreadcrumb)
      }</Script>
      {children}
    </>
  );
}
