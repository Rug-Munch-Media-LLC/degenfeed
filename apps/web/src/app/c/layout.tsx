import type { Metadata } from 'next';
import Script from 'next/script';

const communitiesBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Communities',
      item: 'https://app.degenfeed.xyz/communities',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Web3 Communities — Cross-Protocol Crypto Social Groups | DegenFeed',
  description:
    'Browse cross-protocol web3 communities across Nostr, Farcaster, Lemmy, Mastodon, Bluesky, and Lens. Discover decentralized communities, crypto groups, and token-gated collectives.',
  keywords: [
    'web3 communities',
    'lemmy communities',
    'decentralized communities',
    'crypto reddit alternative',
    'federated communities',
    'nostr communities',
    'farcaster channels',
    'cross protocol communities',
  ],
  openGraph: {
    title: 'Web3 Communities — Cross-Protocol Crypto Social Groups | DegenFeed',
    description:
      'Browse cross-protocol communities across Nostr, Farcaster, Lemmy, Mastodon, Bluesky, Lens.',
    url: 'https://app.degenfeed.xyz/communities',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed web3 communities — cross-protocol crypto social groups',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Web3 Communities — Crypto Social Groups | DegenFeed',
    description:
      'Browse cross-protocol communities across Nostr, Farcaster, Lemmy, and the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/communities' },
};

export default function CommunitiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        id="breadcrumb-communities"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(communitiesBreadcrumb) }}
      />
      {children}
    </>
  );
}
