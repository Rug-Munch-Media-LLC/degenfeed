import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const nostrBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Nostr',
      item: 'https://app.degenfeed.xyz/feed/nostr',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Nostr Feed — Notes & Zaps | DegenFeed',
  description:
    'Browse Nostr notes, zaps, and long-form content across relays. Decentralized social messaging aggregated into one feed.',
  keywords: ['nostr feed', 'nostr notes', 'zaps', 'nostr relays'],
  openGraph: {
    title: 'Nostr Feed — DegenFeed',
    description: 'Nostr notes and zaps from across the relay network, in your DegenFeed timeline.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/nostr' },
};

export default function NostrFeedPage() {
  return (
    <>
      <Script id="breadcrumb-nostr-feed" type="application/ld+json">
        {JSON.stringify(nostrBreadcrumb)}
      </Script>
      <ProtocolFeed source="nostr" />
    </>
  );
}
