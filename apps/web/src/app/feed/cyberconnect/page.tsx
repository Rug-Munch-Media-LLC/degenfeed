import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const cyberconnectBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'CyberConnect',
      item: 'https://app.degenfeed.xyz/feed/cyberconnect',
    },
  ],
};

export const metadata: Metadata = {
  title: 'CyberConnect Feed — Decentralized Content | DegenFeed',
  description: 'Browse CyberConnect content aggregated in your DegenFeed timeline.',
  keywords: ['cyberconnect feed', 'cyberconnect content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'CyberConnect Feed — DegenFeed',
    description: 'CyberConnect content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/cyberconnect',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/cyberconnect' },
};

export default function CyberConnectFeedPage() {
  return (
    <>
      <Script id="breadcrumb-cyberconnect-feed" type="application/ld+json">
        {JSON.stringify(cyberconnectBreadcrumb)}
      </Script>
      <ProtocolFeed source="cyberconnect" />
    </>
  );
}
