import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const misskeyBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Misskey',
      item: 'https://app.degenfeed.xyz/feed/misskey',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Misskey Feed — Decentralized Content | DegenFeed',
  description: 'Browse Misskey content aggregated in your DegenFeed timeline.',
  keywords: ['misskey feed', 'misskey content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Misskey Feed — DegenFeed',
    description: 'Misskey content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/misskey',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/misskey' },
};

export default function MisskeyFeedPage() {
  return (
    <>
      <Script id="breadcrumb-misskey-feed" type="application/ld+json">
        {JSON.stringify(misskeyBreadcrumb)}
      </Script>
      <ProtocolFeed source="misskey" />
    </>
  );
}
