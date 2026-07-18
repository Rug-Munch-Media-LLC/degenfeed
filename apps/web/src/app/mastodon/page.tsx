import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeedPage } from '../../components/ProtocolFeedPage';

const mastodonBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Mastodon Feed',
      item: 'https://app.degenfeed.xyz/mastodon',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Mastodon Feed — Browse Fediverse Toots & ActivityPub | DegenFeed',
  description:
    'Browse the Mastodon timeline — toots, local posts, and federated content from the fediverse. Mastodon feed with cross-post to Nostr, Farcaster, Lens, Bluesky. The best Mastodon web client and ActivityPub feed aggregator.',
  keywords: [
    'mastodon feed',
    'mastodon web client',
    'fediverse social',
    'mastodon toots',
    'activitypub feed',
    'fediverse aggregator',
  ],
  openGraph: {
    title: 'Mastodon Feed — Browse Fediverse Toots & ActivityPub | DegenFeed',
    description:
      'Browse Mastodon toots, local posts from social.degenfeed.xyz, and federated ActivityPub content. Cross-post to Nostr, Farcaster, Lens, Bluesky.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/mastodon' },
};

export default function MastodonPage() {
  return (
    <>
      <Script id="breadcrumb-mastodon" type="application/ld+json">{
        JSON.stringify(mastodonBreadcrumb)
      }</Script>
      <ProtocolFeedPage protocol="mastodon" />
    </>
  );
}
