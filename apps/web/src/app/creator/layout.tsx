import type { Metadata } from 'next';
import Script from 'next/script';

const creatorBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Creator Studio',
      item: 'https://app.degenfeed.xyz/creator',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Creator Studio — Web3 Creator Analytics & Cross-Protocol Publishing',
  description:
    'Your unified web3 creator dashboard: cross-protocol publishing, scheduling, analytics, and crypto monetization across Nostr, Farcaster, Lens, Bluesky, Mastodon.',
  keywords: [
    'crypto creator analytics',
    'web3 creator dashboard',
    'cross protocol publishing',
    'crypto content scheduling',
    'web3 monetization',
    'creator analytics web3',
  ],
  openGraph: {
    title: 'Creator Studio — Web3 Creator Analytics & Publishing | DegenFeed',
    description:
      'Cross-protocol creator dashboard for scheduling, crypto analytics, and web3 monetization.',
    url: 'https://app.degenfeed.xyz/creator',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Creator Studio — web3 creator analytics and cross-protocol publishing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Studio — Web3 Analytics | DegenFeed',
    description: 'Cross-protocol creator dashboard for scheduling, analytics, and monetization.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/creator' },
};

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-creator" type="application/ld+json">
        {JSON.stringify(creatorBreadcrumb)}
      </Script>
      {children}
    </>
  );
}
