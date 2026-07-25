import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const forgejoBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Forgejo',
      item: 'https://app.degenfeed.xyz/feed/forgejo',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Forgejo Feed — Decentralized Content | DegenFeed',
  description: 'Browse Forgejo content aggregated in your DegenFeed timeline.',
  keywords: ['forgejo feed', 'forgejo content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Forgejo Feed — DegenFeed',
    description: 'Forgejo content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/forgejo',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/forgejo' },
};

export default function ForgejoFeedPage() {
  return (
    <>
      <Script id="breadcrumb-forgejo-feed" type="application/ld+json">
        {JSON.stringify(forgejoBreadcrumb)}
      </Script>
      <ProtocolFeed source="forgejo" />
    </>
  );
}
