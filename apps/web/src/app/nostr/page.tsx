import type { Metadata } from 'next';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

export const metadata: Metadata = {
  title: 'Nostr — DegenFeed',
  description:
    'Browse the Nostr timeline — notes from the decentralized relay network. Purple-orange branded Nostr-native feed with Notes, Relays, and Zaps tabs.',
  openGraph: {
    title: 'Nostr Feed — DegenFeed',
    description:
      'Browse the Nostr timeline — notes, relays, and zapped content from the decentralized relay network.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/nostr' },
};

export default function NostrPage() {
  return <ProtocolFeedPage protocol="nostr" />;
}
