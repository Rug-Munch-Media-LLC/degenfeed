import type { Metadata } from 'next';
import Script from 'next/script';
import { PieFedFeedClient } from './PieFedFeedClient';

const piefedBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'PieFed',
      item: 'https://app.degenfeed.xyz/feed/piefed',
    },
  ],
};

export const metadata: Metadata = {
  title: 'PieFed Feed — Federated Link Aggregation | DegenFeed',
  description:
    'Browse PieFed community posts and link aggregations. Open-source Reddit alternative on the fediverse, self-hosted at links.degenfeed.xyz.',
  keywords: ['piefed feed', 'piefed communities', 'fediverse link aggregator', 'piefed crypto'],
  openGraph: {
    title: 'PieFed Feed — DegenFeed',
    description: 'PieFed link aggregator content from the fediverse.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/piefed' },
};

export default function PieFedFeedPage() {
  return (
    <>
      <Script id="breadcrumb-piefed-feed" type="application/ld+json">
        {JSON.stringify(piefedBreadcrumb)}
      </Script>
      <PieFedFeedClient />
    </>
  );
}
