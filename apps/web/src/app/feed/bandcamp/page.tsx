import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Bandcamp',
      item: 'https://app.degenfeed.xyz/feed/bandcamp',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Bandcamp — Indie Music & Album Releases | DegenFeed',
  description: 'Indie music albums and new releases from Bandcamp artists across genres.',
  keywords: ['bandcamp feed', 'decentralized social', 'fediverse', 'bandcamp'],
  openGraph: {
    title: 'Bandcamp — DegenFeed',
    description: 'Indie music albums and new releases from Bandcamp artists across genres.',
    url: 'https://app.degenfeed.xyz/feed/bandcamp',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/bandcamp' },
};

export default function BandcampFeedPage() {
  return (
    <>
      <Script id="breadcrumb-bandcamp-feed" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      <ProtocolFeed source="bandcamp" />
    </>
  );
}
