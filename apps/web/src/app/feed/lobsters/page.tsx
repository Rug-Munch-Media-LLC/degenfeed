import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const lobstersBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Lobsters',
      item: 'https://app.degenfeed.xyz/feed/lobsters',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Lobsters Tech Feed — Computing Discussions | DegenFeed',
  description: 'Browse Lobste.rs computing-focused link aggregation and tech discussions.',
  keywords: ['lobsters feed', 'tech news', 'programming', 'computing', 'developer community'],
  openGraph: {
    title: 'Lobsters Tech Feed — DegenFeed',
    description: 'Tech discussions from Lobste.rs aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/lobsters',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/lobsters' },
};

export default function LobstersFeedPage() {
  return (
    <>
      <Script id="breadcrumb-lobsters-feed" type="application/ld+json">
        {JSON.stringify(lobstersBreadcrumb)}
      </Script>
      <ProtocolFeed source="lobsters" />
    </>
  );
}
