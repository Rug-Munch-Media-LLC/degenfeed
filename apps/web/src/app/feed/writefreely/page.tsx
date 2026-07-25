import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const writefreelyBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'WriteFreely',
      item: 'https://app.degenfeed.xyz/feed/writefreely',
    },
  ],
};

export const metadata: Metadata = {
  title: 'WriteFreely Feed — Decentralized Content | DegenFeed',
  description: 'Browse WriteFreely content aggregated in your DegenFeed timeline.',
  keywords: ['writefreely feed', 'writefreely content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'WriteFreely Feed — DegenFeed',
    description: 'WriteFreely content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/writefreely',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/writefreely' },
};

export default function WriteFreelyFeedPage() {
  return (
    <>
      <Script id="breadcrumb-writefreely-feed" type="application/ld+json">
        {JSON.stringify(writefreelyBreadcrumb)}
      </Script>
      <ProtocolFeed source="writefreely" />
    </>
  );
}
