import type { Metadata } from 'next';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

export const metadata: Metadata = {
  title: 'Bluesky — DegenFeed',
  description:
    'Browse the Bluesky timeline — skeets from the AT Protocol. Blue-branded Bluesky-native feed with Skeets, Custom Feeds, and Trending tabs.',
  openGraph: {
    title: 'Bluesky Feed — DegenFeed',
    description:
      'Browse the Bluesky timeline — skeets, custom feeds, and trending content from the AT Protocol.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/bluesky' },
};

export default function BlueskyPage() {
  return <ProtocolFeedPage protocol="bluesky" />;
}
