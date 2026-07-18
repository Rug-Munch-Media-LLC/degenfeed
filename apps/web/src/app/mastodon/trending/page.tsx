import type { Metadata } from 'next';
import Script from 'next/script';
import { PerPlatformTrending } from '../../../components/PerPlatformTrending';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Mastodon', item: 'https://app.degenfeed.xyz/mastodon' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Mastodon Trending',
      item: 'https://app.degenfeed.xyz/mastodon/trending',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Mastodon Trending — Trending Toots, Hashtags & Topics',
  description:
    'Trending Mastodon toots, hashtags, and topics ranked by engagement velocity. See what the fediverse is talking about right now.',
  keywords: ['mastodon trending', 'trending toots', 'fediverse trending', 'trending hashtags mastodon', 'activitypub trending'],
  openGraph: {
    title: 'Mastodon Trending — Trending Toots, Hashtags & Topics | DegenFeed',
    description: 'Trending Mastodon toots, hashtags, and topics ranked by engagement velocity across the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/mastodon/trending' },
};

export default function MastodonTrendingPage() {
  return (
    <>
      <Script id="breadcrumb-mastodon-trending" type="application/ld+json">{
        JSON.stringify(breadcrumb)
      }</Script>
      <PerPlatformTrending protocol="mastodon" />
    </>
  );
}
