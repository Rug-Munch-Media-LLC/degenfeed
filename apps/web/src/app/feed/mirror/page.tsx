import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const mirrorBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Mirror',
      item: 'https://app.degenfeed.xyz/feed/mirror',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Mirror Feed — Decentralized Content | DegenFeed',
  description: 'Browse Mirror content aggregated in your DegenFeed timeline.',
  keywords: ['mirror feed', 'mirror content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Mirror Feed — DegenFeed',
    description: 'Mirror content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/mirror',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/mirror' },
};

export default function MirrorFeedPage() {
  return (
    <>
      <Script id="breadcrumb-mirror-feed" type="application/ld+json">
        {JSON.stringify(mirrorBreadcrumb)}
      </Script>
      <ProtocolFeed source="mirror" />
    </>
  );
}
