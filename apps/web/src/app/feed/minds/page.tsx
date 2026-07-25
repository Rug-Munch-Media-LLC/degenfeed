import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const mindsBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Minds',
      item: 'https://app.degenfeed.xyz/feed/minds',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Minds Feed — Decentralized Content | DegenFeed',
  description: 'Browse Minds content aggregated in your DegenFeed timeline.',
  keywords: ['minds feed', 'minds content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Minds Feed — DegenFeed',
    description: 'Minds content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/minds',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/minds' },
};

export default function MindsFeedPage() {
  return (
    <>
      <Script id="breadcrumb-minds-feed" type="application/ld+json">
        {JSON.stringify(mindsBreadcrumb)}
      </Script>
      <ProtocolFeed source="minds" />
    </>
  );
}
