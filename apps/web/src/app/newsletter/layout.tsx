import type { Metadata } from 'next';
import Script from 'next/script';

const newsletterBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Newsletter',
      item: 'https://app.degenfeed.xyz/newsletter',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Crypto Newsletter — Web3 Daily Digest & Blockchain News',
  description:
    'Subscribe to the DegenFeed crypto newsletter. Daily web3 news digest curated from Nostr, Farcaster, Lens, Bluesky, Mastodon, and more. The best blockchain newsletter for crypto content.',
  keywords: [
    'crypto newsletter',
    'web3 newsletter',
    'blockchain newsletter',
    'defi newsletter',
    'crypto daily digest',
    'web3 news roundup',
    'crypto email digest',
    'tech newsletter',
    'AI newsletter',
    'tech daily digest',
    'AI news roundup',
    'startup newsletter',
    'crypto news email',
    'daily tech news',
    'artificial intelligence newsletter',
  ],
  openGraph: {
    title: 'Crypto Newsletter — Web3 Daily Digest & Blockchain News | DegenFeed',
    description:
      'Subscribe to the DegenFeed crypto newsletter. Daily web3 news digest from 8 protocols.',
    url: 'https://app.degenfeed.xyz/newsletter',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed crypto newsletter — daily web3 digest and blockchain news',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Newsletter — Web3 Daily Digest | DegenFeed',
    description: 'Daily web3 news digest curated from Nostr, Farcaster, Lens, Bluesky, Mastodon.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/newsletter' },
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-newsletter" type="application/ld+json">
        {JSON.stringify(newsletterBreadcrumb)}
      </Script>
      {children}
    </>
  );
}
