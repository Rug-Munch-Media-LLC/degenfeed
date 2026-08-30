import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../components/feed/ProtocolFeed';

const lemmyBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Lemmy Feed',
      item: 'https://app.degenfeed.xyz/lemmy',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Lemmy Feed — Browse Community Discussions & Link Aggregations | DegenFeed',
  description:
    'Browse the Lemmy timeline — community discussions, link aggregations, and trending posts from the fediverse. Lemmy feed with cross-post to Nostr, Farcaster, Lens, Bluesky. The best Lemmy web client and fediverse feed aggregator.',
  keywords: [
    'lemmy feed',
    'lemmy web client',
    'fediverse discussion',
    'lemmy communities',
    'link aggregation',
    'lemmy crypto',
  ],
  openGraph: {
    title: 'Lemmy Feed — Browse Community Discussions | DegenFeed',
    description:
      'Browse Lemmy community discussions and link aggregations from the fediverse. The best Lemmy web client and fediverse feed aggregator.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/lemmy' },
};

export default function LemmyPage() {
  return (
    <>
      <Script id="breadcrumb-lemmy" type="application/ld+json">
        {JSON.stringify(lemmyBreadcrumb)}
      </Script>
      <ProtocolFeed source="lemmy" />
    </>
  );
}
