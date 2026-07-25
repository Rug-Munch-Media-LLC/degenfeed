import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const lensBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Lens Protocol',
      item: 'https://app.degenfeed.xyz/feed/lens',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Lens Feed — Decentralized Social Graph Publications | DegenFeed',
  description:
    'Browse Lens Protocol publications, mirrors, and collects. User-owned social graph on Polygon aggregated in your DegenFeed timeline.',
  keywords: ['lens feed', 'lens protocol', 'decentralized social graph', 'lens publications'],
  openGraph: {
    title: 'Lens Feed — DegenFeed',
    description: 'Lens Protocol publications from the decentralized social graph.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/lens' },
};

export default function LensFeedPage() {
  return (
    <>
      <Script id="breadcrumb-lens-feed" type="application/ld+json">
        {JSON.stringify(lensBreadcrumb)}
      </Script>
      <ProtocolFeed source="lens" />
    </>
  );
}
