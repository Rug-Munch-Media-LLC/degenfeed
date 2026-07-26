import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const atprotoBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'AT Protocol',
      item: 'https://app.degenfeed.xyz/feed/atproto',
    },
  ],
};

export const metadata: Metadata = {
  title: 'AT Protocol Feed — Bluesky Content | DegenFeed',
  description:
    'Browse AT Protocol content, Bluesky posts, and federated feeds aggregated in your DegenFeed timeline.',
  keywords: ['at protocol feed', 'bluesky', 'atproto', 'federated social'],
  openGraph: {
    title: 'AT Protocol Feed — DegenFeed',
    description: 'AT Protocol content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/atproto',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/atproto' },
};

export default function ATProtoFeedPage() {
  return (
    <>
      <Script id="breadcrumb-atproto-feed" type="application/ld+json">
        {JSON.stringify(atprotoBreadcrumb)}
      </Script>
      <ProtocolFeed source="atproto" />
    </>
  );
}
