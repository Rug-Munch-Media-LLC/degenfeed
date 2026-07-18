import type { Metadata } from 'next';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

export const metadata: Metadata = {
  title: 'Mastodon — DegenFeed',
  description:
    'Browse the Mastodon timeline — toots from the fediverse. Elephant-branded Mastodon-native feed with Toots, Local, and Federated tabs.',
  openGraph: {
    title: 'Mastodon Feed — DegenFeed',
    description:
      'Browse the Mastodon timeline — toots, local posts from social.degenfeed.xyz, and federated content.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/mastodon' },
};

export default function MastodonPage() {
  return <ProtocolFeedPage protocol="mastodon" />;
}
