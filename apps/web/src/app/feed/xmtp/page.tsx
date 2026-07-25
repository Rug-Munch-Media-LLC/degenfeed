import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const xmtpBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'XMTP',
      item: 'https://app.degenfeed.xyz/feed/xmtp',
    },
  ],
};

export const metadata: Metadata = {
  title: 'XMTP Feed — Decentralized Content | DegenFeed',
  description: 'Browse XMTP content aggregated in your DegenFeed timeline.',
  keywords: ['xmtp feed', 'xmtp content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'XMTP Feed — DegenFeed',
    description: 'XMTP content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/xmtp',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/xmtp' },
};

export default function XMTPFeedPage() {
  return (
    <>
      <Script id="breadcrumb-xmtp-feed" type="application/ld+json">
        {JSON.stringify(xmtpBreadcrumb)}
      </Script>
      <ProtocolFeed source="xmtp" />
    </>
  );
}
