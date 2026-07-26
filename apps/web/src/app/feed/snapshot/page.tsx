import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const snapshotBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Snapshot',
      item: 'https://app.degenfeed.xyz/feed/snapshot',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Snapshot DAO Governance Feed — Proposal Voting | DegenFeed',
  description:
    'Browse DAO governance proposals from Snapshot — DeFi, NFT & crypto protocol decisions.',
  keywords: ['snapshot feed', 'dao governance', 'dao proposals', 'voting', 'defi governance'],
  openGraph: {
    title: 'Snapshot DAO Governance Feed — DegenFeed',
    description: 'DAO governance proposals aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/snapshot',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/snapshot' },
};

export default function SnapshotFeedPage() {
  return (
    <>
      <Script id="breadcrumb-snapshot-feed" type="application/ld+json">
        {JSON.stringify(snapshotBreadcrumb)}
      </Script>
      <ProtocolFeed source="snapshot" />
    </>
  );
}
