import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const hubzillaBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Hubzilla',
      item: 'https://app.degenfeed.xyz/feed/hubzilla',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Hubzilla Feed — Decentralized Content | DegenFeed',
  description: 'Browse Hubzilla content aggregated in your DegenFeed timeline.',
  keywords: ['hubzilla feed', 'hubzilla content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Hubzilla Feed — DegenFeed',
    description: 'Hubzilla content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/hubzilla',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/hubzilla' },
};

export default function HubzillaFeedPage() {
  return (
    <>
      <Script id="breadcrumb-hubzilla-feed" type="application/ld+json">
        {JSON.stringify(hubzillaBreadcrumb)}
      </Script>
      <ProtocolFeed source="hubzilla" />
    </>
  );
}
