import type { Metadata } from 'next';
import Script from 'next/script';

const digestBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Daily Digest',
      item: 'https://app.degenfeed.xyz/digest',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Crypto Daily Digest — Web3 News Summary & Blockchain Roundup | DegenFeed',
  description:
    'Daily and weekly crypto digest of the best web3 social content. Curated blockchain news summary, trending posts, and top discussions across Nostr, Farcaster, Lens, Bluesky, Mastodon.',
  keywords: [
    'crypto daily digest',
    'web3 news summary',
    'blockchain daily roundup',
    'crypto curation',
    'web3 daily brief',
    'cross protocol digest',
    'crypto newsletter',
  ],
  openGraph: {
    title: 'Crypto Daily Digest — Web3 News Summary | DegenFeed',
    description:
      'Daily curated crypto digest with trending posts and discussions across Nostr, Farcaster, Lens, Bluesky, Mastodon.',
    url: 'https://app.degenfeed.xyz/digest',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed crypto daily digest — web3 news summary across all protocols',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Daily Digest — Web3 News Summary | DegenFeed',
    description:
      'Daily curated crypto digest with trending posts across Nostr, Farcaster, Lens, Bluesky.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/digest' },
};

export default function DigestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-digest" type="application/ld+json">
        {JSON.stringify(digestBreadcrumb)}
      </Script>
      {children}
    </>
  );
}
