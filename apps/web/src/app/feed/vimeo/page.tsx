import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Vimeo',
      item: 'https://app.degenfeed.xyz/feed/vimeo',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Vimeo — Curated Professional Videos | DegenFeed',
  description:
    'High-quality curated videos including tech talks, creative content and documentaries.',
  keywords: ['vimeo feed', 'decentralized social', 'fediverse', 'vimeo'],
  openGraph: {
    title: 'Vimeo — DegenFeed',
    description:
      'High-quality curated videos including tech talks, creative content and documentaries.',
    url: 'https://app.degenfeed.xyz/feed/vimeo',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/vimeo' },
};

export default function VimeoFeedPage() {
  return (
    <>
      <Script id="breadcrumb-vimeo-feed" type="application/ld+json">
        {JSON.stringify(breadcrumb)}
      </Script>
      <ProtocolFeed source="vimeo" />
    </>
  );
}
