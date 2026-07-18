import type { Metadata } from 'next';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

export const metadata: Metadata = {
  title: 'Farcaster — DegenFeed',
  description:
    'Browse the Farcaster timeline — casts from the on-chain social network. Purple-branded Farcaster-native feed with Casts, Channels, and Trending tabs.',
  openGraph: {
    title: 'Farcaster Feed — DegenFeed',
    description:
      'Browse the Farcaster timeline — casts, channels, and trending content from the on-chain social network.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/farcaster' },
};

export default function FarcasterPage() {
  return <ProtocolFeedPage protocol="farcaster" />;
}
