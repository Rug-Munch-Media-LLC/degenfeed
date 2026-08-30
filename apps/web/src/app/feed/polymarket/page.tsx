import type { Metadata } from 'next';
import Script from 'next/script';
import { ProtocolFeed } from '../../../components/feed/ProtocolFeed';

const polymarketBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://app.degenfeed.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Feed', item: 'https://app.degenfeed.xyz/feed' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Polymarket',
      item: 'https://app.degenfeed.xyz/feed/polymarket',
    },
  ],
};

export const metadata: Metadata = {
  title: 'Polymarket Prediction Market Feed — Odds & Volume | DegenFeed',
  description:
    'Prediction market odds, trending markets and resolution status from Polymarket — crypto, politics & macro forecasts.',
  keywords: [
    'polymarket feed',
    'prediction markets',
    'market odds',
    'polymarket volume',
    'crypto predictions',
  ],
  openGraph: {
    title: 'Polymarket Prediction Markets — DegenFeed',
    description: 'Live prediction market odds and volume aggregated in your DegenFeed timeline.',
    url: 'https://app.degenfeed.xyz/feed/polymarket',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/feed/polymarket' },
};

export default function PolymarketFeedPage() {
  return (
    <>
      <Script id="breadcrumb-polymarket-feed" type="application/ld+json">
        {JSON.stringify(polymarketBreadcrumb)}
      </Script>
      <ProtocolFeed source="polymarket" />
    </>
  );
}
