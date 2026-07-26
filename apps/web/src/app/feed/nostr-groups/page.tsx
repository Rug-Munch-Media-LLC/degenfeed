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
      name: 'Nostr Groups (NIP-29)',
      item: 'https://app.degenfeed.xyz/feed/nostr-groups',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Nostr Groups — Decentralized Communities (NIP-29) | DegenFeed',
  description: 'Group chats and community discussions from the Nostr NIP-29 protocol.',
  keywords: ['nostr-groups feed', 'decentralized social', 'fediverse', 'nostr-groups'],
  openGraph: {
    title: 'Nostr Groups (NIP-29) — DegenFeed',
    description: 'Group chats and community discussions from the Nostr NIP-29 protocol.',
    url: 'https://app.degenfeed.xyz/feed/nostr-groups',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/nostr-groups' },
};

export default function NostrGroupsFeedPage() {
  return (
    <>
      <Script id="breadcrumb-nostr-groups-feed" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      <ProtocolFeed source="nostr-groups" />
    </>
  );
}
