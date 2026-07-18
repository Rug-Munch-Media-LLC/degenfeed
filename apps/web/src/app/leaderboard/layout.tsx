import type { Metadata } from 'next';
import Script from 'next/script';

const leaderboardBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Leaderboard', item: 'https://app.degenfeed.xyz/leaderboard' },
  ],
};

export const metadata: Metadata = {
  title: 'Leaderboard — Top Crypto Creators & Web3 Content Rankings',
  description:
    'Top crypto creators, web3 content, and communities across Nostr, Farcaster, Lens, Bluesky, Mastodon, and more. Ranked by engagement, crypto tips, and cross-protocol reach.',
  keywords: [
    'crypto creator rankings', 'web3 leaderboard', 'top crypto creators',
    'web3 content rankings', 'crypto social analytics', 'cross protocol analytics',
  ],
  openGraph: {
    title: 'Leaderboard — Top Crypto Creators & Web3 Rankings | DegenFeed',
    description:
      'Top crypto creators and web3 content ranked by engagement, tips, and cross-protocol reach.',
    url: 'https://app.degenfeed.xyz/leaderboard',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed leaderboard — top crypto creators and web3 content rankings',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leaderboard — Top Crypto Creators | DegenFeed',
    description:
      'Top crypto creators ranked by engagement, tips, and cross-protocol reach.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/leaderboard' },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-leaderboard" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(leaderboardBreadcrumb) }} />
      {children}
    </>
  );
}
