import type { Metadata } from 'next';
import Script from 'next/script';
import { PerPlatformTrending } from '../../../components/PerPlatformTrending';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Nostr', item: 'https://app.degenfeed.xyz/nostr' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Nostr Trending',
      item: 'https://app.degenfeed.xyz/nostr/trending',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Nostr Trending — Trending Notes, Relays & Topics',
  description:
    'Trending Nostr notes, relays, and topics ranked by engagement velocity. See what the Nostr relay network is talking about right now.',
  keywords: ['nostr trending', 'trending notes', 'nostr relays', 'trending topics nostr', 'nostr zaps trending'],
  openGraph: {
    title: 'Nostr Trending — Trending Notes, Relays & Topics | DegenFeed',
    description: 'Trending Nostr notes, relays, and topics ranked by engagement velocity.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/nostr/trending' },
};

export default function NostrTrendingPage() {
  return (
    <>
      <Script id="breadcrumb-nostr-trending" type="application/ld+json">{
        JSON.stringify(breadcrumb)
      }</Script>
      <PerPlatformTrending protocol="nostr" />
    </>
  );
}
