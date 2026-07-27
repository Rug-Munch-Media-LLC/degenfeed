import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const pushBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Push Protocol',
      item: 'https://app.degenfeed.xyz/feed/push',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Push Protocol Feed — Decentralized Content | DegenFeed',
  description: 'Browse Push Protocol content aggregated in your DegenFeed timeline.',
  keywords: ['push feed', 'push content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Push Protocol Feed — DegenFeed',
    description: 'Push Protocol content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/push',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/push' },
};

export default function PushProtocolFeedPage() {
  return (
    <>
      <Script id="breadcrumb-push-feed" type="application/ld+json">
        {JSON.stringify(pushBreadcrumb)}
      </Script>
      <ProtocolFeed source="push" />
    </>
  );
}
