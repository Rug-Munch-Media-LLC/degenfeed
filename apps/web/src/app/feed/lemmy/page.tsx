import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const lemmyBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Lemmy Communities',
      item: 'https://app.degenfeed.xyz/feed/lemmy',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Lemmy Feed — Community Discussions | DegenFeed',
  description:
    'Browse Lemmy community discussions and link aggregations. Open-source Reddit alternative on the fediverse, curated for crypto topics.',
  keywords: ['lemmy feed', 'lemmy communities', 'fediverse discussion', 'lemmy crypto'],
  openGraph: {
    title: 'Lemmy Feed — DegenFeed',
    description: 'Lemmy community discussions aggregated from the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/lemmy' },
};

export default function LemmyFeedPage() {
  return (
    <>
      <Script id="breadcrumb-lemmy-feed" type="application/ld+json">
        {JSON.stringify(lemmyBreadcrumb)}
      </Script>
      <ProtocolFeed source="lemmy" />
    </>
  );
}
