import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const tallyBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Tally',
      item: 'https://app.degenfeed.xyz/feed/tally',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Tally DAO Governance Feed — Treasury & Proposals | DegenFeed',
  description: 'Browse DAO governance proposals and treasury management from Tally.',
  keywords: [
    'tally feed',
    'dao treasury',
    'dao governance',
    'delegate voting',
    'protocol governance',
  ],
  openGraph: {
    title: 'Tally DAO Governance Feed — DegenFeed',
    description: 'DAO governance activity from Tally aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/tally',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/tally' },
};

export default function TallyFeedPage() {
  return (
    <>
      <Script id="breadcrumb-tally-feed" type="application/ld+json">
        {JSON.stringify(tallyBreadcrumb)}
      </Script>
      <ProtocolFeed source="tally" />
    </>
  );
}
