import type { Metadata } from 'next';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Feddy Communities',
      item: 'https://app.degenfeed.xyz/feddy',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Feddy Communities — Federated Groups on DegenFeed',
  description:
    'Discover Feddy Communities — ActivityPub-native federated groups on DegenFeed. Join crypto, tech, art, and gaming communities that span the fediverse.',
  keywords: [
    'feddy communities',
    'federated groups',
    'activitypub communities',
    'fediverse groups',
    'crypto community',
    'web3 groups',
    'decentralized social',
    'mastodon groups',
  ],
  openGraph: {
    title: 'Feddy — Federated Communities on DegenFeed',
    description:
      'Discover and create ActivityPub-native communities that federate across the Fediverse. Premium users can launch their own.',
    url: 'https://app.degenfeed.xyz/feddy',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Feddy Communities on DegenFeed',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Feddy — Federated Communities',
    description:
      'Discover and create federated communities on DegenFeed. ActivityPub-native, fediverse-compatible.',
    images: ['https://app.degenfeed.xyz/og-image.png'],
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feddy' },
};

export default function FeddyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="breadcrumb-feddy" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      {children}
    </>
  );
}
