import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

const farcasterBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Farcaster Feed', item: 'https://app.degenfeed.xyz/farcaster' },
  ],
};

export const metadata: Metadata = {
  title: 'Farcaster Feed — Browse Casts, Channels & Frames | DegenFeed',
  description:
    'Browse the Farcaster timeline — casts, channels, frames, and trending content from the on-chain social network. Farcaster feed with cross-post to Nostr, Lens, Bluesky. The best Farcaster web client.',
  keywords: [
    'farcaster feed', 'farcaster web client', 'farcaster casts',
    'farcaster channels', 'farcaster frames', 'farcaster hub',
    'onchain social network',
  ],
  openGraph: {
    title: 'Farcaster Feed — Browse Casts, Channels & Frames | DegenFeed',
    description:
      'Browse the Farcaster timeline — casts, channels, frames, and trending content. Cross-post to Nostr, Lens, Bluesky. The best Farcaster web client.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/farcaster' },
};

export default function FarcasterPage() {
  return (
    <>
      <Script id="breadcrumb-farcaster" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(farcasterBreadcrumb) }} />
      <ProtocolFeedPage protocol="farcaster" />
    </>
  );
}
