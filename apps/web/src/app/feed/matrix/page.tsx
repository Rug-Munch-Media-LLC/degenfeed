import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const matrixBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Matrix',
      item: 'https://app.degenfeed.xyz/feed/matrix',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Matrix Feed — Decentralized Content | DegenFeed',
  description: 'Browse Matrix content aggregated in your DegenFeed timeline.',
  keywords: ['matrix feed', 'matrix content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Matrix Feed — DegenFeed',
    description: 'Matrix content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/matrix',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/matrix' },
};

export default function MatrixFeedPage() {
  return (
    <>
      <Script id="breadcrumb-matrix-feed" type="application/ld+json">
        {JSON.stringify(matrixBreadcrumb)}
      </Script>
      <ProtocolFeed source="matrix" />
    </>
  );
}
