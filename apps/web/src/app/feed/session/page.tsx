import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const sessionBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Session',
      item: 'https://app.degenfeed.xyz/feed/session',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Session Feed — Decentralized Content | DegenFeed',
  description: 'Browse Session content aggregated in your DegenFeed timeline.',
  keywords: ['session feed', 'session content', 'decentralized social', 'fediverse'],
  openGraph: {
    title: 'Session Feed — DegenFeed',
    description: 'Session content aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/session',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/session' },
};

export default function SessionFeedPage() {
  return (
    <>
      <Script id="breadcrumb-session-feed" type="application/ld+json">
        {JSON.stringify(sessionBreadcrumb)}
      </Script>
      <ProtocolFeed source="session" />
    </>
  );
}
