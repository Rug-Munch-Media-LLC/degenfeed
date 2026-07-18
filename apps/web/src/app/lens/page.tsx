import type { Metadata } from 'next';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

export const metadata: Metadata = {
  title: 'Lens — DegenFeed',
  description:
    'Browse the Lens Protocol timeline — publications from the decentralized social graph on Polygon. Green-branded Lens-native feed with Publications, Mirrors, and Collects tabs.',
  openGraph: {
    title: 'Lens Feed — DegenFeed',
    description:
      'Browse the Lens Protocol timeline — publications, mirrors, and collects from the decentralized social graph.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/lens' },
};

export default function LensPage() {
  return <ProtocolFeedPage protocol="lens" />;
}
