import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const mastodonBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Mastodon',
      item: 'https://app.degenfeed.xyz/feed/mastodon',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Mastodon Feed — ActivityPub Toots & Fediverse | DegenFeed',
  description:
    'Browse Mastodon toots and ActivityPub content aggregated from the fediverse. Follow crypto communities across instances in one unified feed.',
  keywords: ['mastodon feed', 'activitypub feed', 'fediverse toots', 'mastodon crypto'],
  openGraph: {
    title: 'Mastodon Feed — DegenFeed',
    description: 'ActivityPub content from the fediverse, aggregated in your DegenFeed timeline.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/mastodon' },
};

export default function MastodonFeedPage() {
  return (
    <>
      <Script id="breadcrumb-mastodon-feed" type="application/ld+json">
        {JSON.stringify(mastodonBreadcrumb)}
      </Script>
      <ProtocolFeed source="mastodon" />
    </>
  );
}
