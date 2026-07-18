import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

const nostrBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Nostr Feed', item: 'https://app.degenfeed.xyz/nostr' },
  ],
};

export const metadata: Metadata = {
  title: 'Nostr Feed — Browse Notes, Relays & Zaps | DegenFeed',
  description:
    'Browse the Nostr timeline — notes, relays, and zapped content from the decentralized relay network. Nostr feed with cross-post to Farcaster, Lens, Bluesky, Mastodon. The best Nostr web client and Nostr feed aggregator.',
  keywords: [
    'nostr feed', 'nostr web client', 'nostr notes', 'nostr relays',
    'nostr kind 1', 'nostr zap', 'nostr nip 05', 'decentralized relay network',
  ],
  openGraph: {
    title: 'Nostr Feed — Browse Notes, Relays & Zaps | DegenFeed',
    description:
      'Browse Nostr notes, relays, and zaps. Cross-post to Farcaster, Lens, Bluesky, Mastodon. The best Nostr web client.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/nostr' },
};

export default function NostrPage() {
  return (
    <>
      <Script id="breadcrumb-nostr" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(nostrBreadcrumb) }} />
      <ProtocolFeedPage protocol="nostr" />
    </>
  );
}
