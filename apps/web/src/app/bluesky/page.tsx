import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

const blueskyBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Bluesky Feed',
      item: 'https://app.degenfeed.xyz/bluesky',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Bluesky Feed — Browse AT Protocol Skeets & Custom Feeds | DegenFeed',
  description:
    'Browse the Bluesky timeline — skeets, custom feeds, and trending content from the AT Protocol. Bluesky feed with cross-post to Nostr, Farcaster, Lens, Mastodon. The best Bluesky web client.',
  keywords: [
    'bluesky feed',
    'bluesky web client',
    'bluesky skeets',
    'at protocol feed',
    'bluesky custom feeds',
    'bluesky aggregator',
  ],
  openGraph: {
    title: 'Bluesky Feed — Browse AT Protocol Skeets & Custom Feeds | DegenFeed',
    description:
      'Browse Bluesky skeets, custom feeds, and trending content from the AT Protocol. Cross-post to Nostr, Farcaster, Lens, Mastodon. Best Bluesky web client.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/bluesky' },
};

export default function BlueskyPage() {
  return (
    <>
      <Script id="breadcrumb-bluesky" type="application/ld+json">
        {JSON.stringify(blueskyBreadcrumb)}
      </Script>
      <ProtocolFeedPage protocol="bluesky" />
    </>
  );
}
